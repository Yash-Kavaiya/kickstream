"""Calling an agent's connectors: the services the studio has connected to it, asked when the agent is."""

import asyncio
import json
import logging
import time
from collections.abc import Callable

from kickstream.agents.registry import AgentSwitches
from kickstream.contracts import AgentConnector, ConnectorCheck, CopilotSource
from kickstream.ports.connector import ConnectorClient, ConnectorFailure

log = logging.getLogger(__name__)
MAX_SNIPPET = 600
# Fields a JSON answer is read from, in this order; any other JSON is shown compacted.
TEXT_FIELDS = ("answer", "text", "result", "summary", "content", "message", "data")


def headers_for(connector: AgentConnector, secret: str | None) -> dict[str, str]:
    """The secret goes in the connector's own header, or as a bearer token when it names none."""
    if not secret:
        return {}
    if connector.header:
        return {connector.header: secret}
    return {"Authorization": f"Bearer {secret}"}


def readable(body: str) -> str:
    """The text worth showing from an answer: a JSON answer's text field, or the body itself, cut short."""
    text = body.strip()
    try:
        parsed = json.loads(text)
    except ValueError:
        parsed = None
    if isinstance(parsed, dict):
        field = next((parsed[name] for name in TEXT_FIELDS if parsed.get(name) not in (None, "")), parsed)
        text = (
            field if isinstance(field, str) else json.dumps(field, ensure_ascii=False, separators=(",", ":"))
        )
    elif parsed is not None and not isinstance(parsed, str):
        text = json.dumps(parsed, ensure_ascii=False, separators=(",", ":"))
    elif isinstance(parsed, str):
        text = parsed
    text = " ".join(text.split())
    return text if len(text) <= MAX_SNIPPET else text[: MAX_SNIPPET - 1].rstrip() + "…"


class AgentConnectors:
    """Asks an agent's switched-on connectors about a question, all at once, and keeps a budget per match."""

    def __init__(
        self,
        switches: AgentSwitches,
        client: ConnectorClient,
        *,
        names: dict[str, str],
        max_calls_per_match: int = 120,
        timeout_s: float = 10.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._switches = switches
        self._client = client
        self._names = names
        self._max_calls = max_calls_per_match
        self._timeout_s = timeout_s
        self._clock = clock
        self._spent: dict[str, int] = {}

    def _payload(self, agent_id: str, question: str, match_id: str | None) -> dict:
        return {
            "question": question,
            "agent": agent_id,
            "agent_name": self._names.get(agent_id, agent_id),
            "match_id": match_id,
            "source": "kickstream",
        }

    async def _ask(self, connector: AgentConnector, payload: dict) -> tuple[int, str]:
        headers = headers_for(connector, self._switches.secret(connector.id))
        return await asyncio.wait_for(self._client.post(connector.url, headers, payload), self._timeout_s)

    async def consult(
        self, agent_id: str, question: str, match_id: str | None
    ) -> tuple[list[CopilotSource], list[str]]:
        """Each answering connector as a source, and the problems of those that did not answer."""
        connectors = [item for item in self._switches.connectors(agent_id) if item.enabled]
        key = match_id or "none"
        room = self._max_calls - self._spent.get(key, 0)
        if not connectors:
            return [], []
        if room < len(connectors):
            return [], ["The connectors have been asked as often as one match allows."]
        self._spent[key] = self._spent.get(key, 0) + len(connectors)
        payload = self._payload(agent_id, question, match_id)
        answers = await asyncio.gather(
            *(self._ask(item, payload) for item in connectors), return_exceptions=True
        )
        sources, problems = [], []
        for connector, answer in zip(connectors, answers, strict=True):
            if isinstance(answer, BaseException):
                reason = str(answer) if isinstance(answer, ConnectorFailure) else "It did not answer in time."
                log.warning("connector %s of %s failed: %s", connector.name, agent_id, reason)
                problems.append(f"{connector.name}: {reason}")
                continue
            status, body = answer
            text = readable(body)
            if not 200 <= status < 300:
                problems.append(f"{connector.name} answered with an error ({status}).")
            elif not text:
                problems.append(f"{connector.name} answered with nothing.")
            else:
                sources.append(
                    CopilotSource(title=connector.name, url=connector.url, snippet=text, kind="connector")
                )
        return sources, problems

    async def check(self, agent_id: str, connector_id: str) -> ConnectorCheck:
        """One test call with a sample question, to see that the connector answers."""
        connector = self._switches.connector(agent_id, connector_id)
        started = self._clock()
        payload = self._payload(
            agent_id, "This is a test from Kickstream. What can you tell this agent?", None
        )
        try:
            status, body = await self._ask(connector, payload)
        except (ConnectorFailure, TimeoutError) as exc:
            reason = str(exc) or "It did not answer in time."
            return ConnectorCheck(ok=False, snippet="", problem=reason, ms=self._ms(started))
        text = readable(body)
        ok = 200 <= status < 300 and bool(text)
        problem = (
            None
            if ok
            else (
                f"It answered with an error ({status})."
                if not 200 <= status < 300
                else "It answered with nothing."
            )
        )
        return ConnectorCheck(ok=ok, status=status, snippet=text, problem=problem, ms=self._ms(started))

    def _ms(self, started: float) -> int:
        return max(0, round((self._clock() - started) * 1000))
