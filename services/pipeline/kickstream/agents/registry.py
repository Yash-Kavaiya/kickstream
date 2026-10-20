"""The agents, in the order a payload is offered to them, which of them are switched on, and what the studio
has added to each: its own instructions and the connectors it may call."""

import logging
import uuid
from dataclasses import dataclass
from urllib.parse import urlsplit

from kickstream.agents.base import Declared
from kickstream.agents.explain import ExplainabilityAgent
from kickstream.agents.highlights import HighlightsAgent
from kickstream.agents.interpreter import EventInterpreter
from kickstream.agents.prediction import PredictionAgent
from kickstream.agents.tactics import TacticalAnalyst
from kickstream.agents.tracking import PlayerTracker
from kickstream.agents.visualize import VisualizationAgent
from kickstream.contracts import AgentCatalog, AgentConnector
from kickstream.domain.errors import Refusal
from kickstream.ports.output import RecordStore

log = logging.getLogger(__name__)

# An agent comes after every agent it listens to, so one pass down the list settles a payload.
DECLARED: tuple[Declared, ...] = (
    EventInterpreter.declared,
    TacticalAnalyst.declared,
    PredictionAgent.declared,
    PlayerTracker.declared,
    VisualizationAgent.declared,
    HighlightsAgent.declared,
    ExplainabilityAgent.declared,
)
AGENT_IDS = tuple(declared.id for declared in DECLARED)
MAX_INSTRUCTIONS = 2000
MAX_CONNECTORS = 3  # per agent


class AgentError(Refusal):
    """A change to the agents that is refused."""


@dataclass(frozen=True)
class ConnectorDraft:
    """A connector as the studio enters it. `secret` None keeps the one saved; "" removes it."""

    name: str
    url: str
    description: str = ""
    header: str | None = None
    secret: str | None = None
    enabled: bool = True


def _connector(raw: object) -> AgentConnector | None:
    try:
        return AgentConnector.model_validate(raw)
    except ValueError:
        return None


class AgentSwitches:
    """Which agents are switched off, each agent's own instructions and its connectors. Kept in a record, so a
    restart keeps them. A connector's secret is kept apart, in `secrets`, and is never shown again."""

    def __init__(self, store: RecordStore | None = None, secrets: RecordStore | None = None) -> None:
        self._store = store
        self._secrets_store = secrets
        saved = (store.load() if store else None) or {}
        off = saved.get("off", [])
        self._off = (
            {agent_id for agent_id in off if agent_id in AGENT_IDS} if isinstance(off, list) else set()
        )
        instructions = saved.get("instructions", {})
        self._instructions: dict[str, str] = {
            agent_id: text[:MAX_INSTRUCTIONS]
            for agent_id, text in (instructions.items() if isinstance(instructions, dict) else [])
            if agent_id in AGENT_IDS and isinstance(text, str) and text.strip()
        }
        connectors = saved.get("connectors", {})
        self._connectors: dict[str, list[AgentConnector]] = {}
        for agent_id, items in connectors.items() if isinstance(connectors, dict) else []:
            if agent_id in AGENT_IDS and isinstance(items, list):
                valid = [item for item in map(_connector, items) if item is not None]
                if valid:
                    self._connectors[agent_id] = valid[:MAX_CONNECTORS]
        kept = (secrets.load() if secrets else None) or {}
        self._secrets: dict[str, str] = {key: value for key, value in kept.items() if isinstance(value, str)}

    def enabled(self, agent_id: str) -> bool:
        return agent_id not in self._off

    def _known(self, agent_id: str) -> None:
        if agent_id not in AGENT_IDS:
            raise AgentError(404, "agent", f"There is no agent called {agent_id}.")

    def _save(
        self,
        off: set[str],
        instructions: dict[str, str],
        connectors: dict[str, list[AgentConnector]],
        secrets: dict[str, str] | None = None,
    ) -> None:
        """Saves, then takes the change. A save that fails changes nothing."""
        connectors = {agent_id: items for agent_id, items in connectors.items() if items}
        record: dict = {"off": sorted(off)}
        if instructions:
            record["instructions"] = instructions
        if connectors:
            record["connectors"] = {
                agent_id: [item.model_dump() for item in items] for agent_id, items in connectors.items()
            }
        try:
            if secrets is not None and self._secrets_store is not None:
                self._secrets_store.save(secrets)
            if self._store is not None:
                self._store.save(record)
        except OSError as exc:
            raise AgentError(503, "agent", "The change could not be saved. Nothing was changed.") from exc
        self._off, self._instructions, self._connectors = off, instructions, connectors
        if secrets is not None:
            self._secrets = secrets

    def set(self, agent_id: str, enabled: bool) -> None:
        self._known(agent_id)
        changed = (self._off - {agent_id}) if enabled else (self._off | {agent_id})
        self._save(changed, self._instructions, self._connectors)

    def instructions(self, agent_id: str) -> str:
        """The studio's own instructions for the agent; empty when none were given."""
        return self._instructions.get(agent_id, "")

    def set_instructions(self, agent_id: str, text: str) -> None:
        self._known(agent_id)
        text = text.strip()
        if len(text) > MAX_INSTRUCTIONS:
            raise AgentError(
                422, "custom_instructions", f"Instructions can be at most {MAX_INSTRUCTIONS} characters."
            )
        changed = {key: value for key, value in self._instructions.items() if key != agent_id}
        if text:
            changed[agent_id] = text
        self._save(self._off, changed, self._connectors)

    def connectors(self, agent_id: str) -> list[AgentConnector]:
        return list(self._connectors.get(agent_id, []))

    def connector(self, agent_id: str, connector_id: str) -> AgentConnector:
        self._known(agent_id)
        found = next((item for item in self._connectors.get(agent_id, []) if item.id == connector_id), None)
        if found is None:
            raise AgentError(404, "connector", f"There is no connector {connector_id} on this agent.")
        return found

    def secret(self, connector_id: str) -> str | None:
        return self._secrets.get(connector_id)

    def add_connector(self, agent_id: str, draft: ConnectorDraft) -> AgentConnector:
        self._known(agent_id)
        items = self.connectors(agent_id)
        if len(items) >= MAX_CONNECTORS:
            raise AgentError(422, "connector", f"An agent can have at most {MAX_CONNECTORS} connectors.")
        made = _made(uuid.uuid4().hex[:10], draft, has_secret=bool(draft.secret))
        secrets = {**self._secrets, made.id: draft.secret} if draft.secret else None
        self._save(self._off, self._instructions, {**self._connectors, agent_id: [*items, made]}, secrets)
        return made

    def update_connector(self, agent_id: str, connector_id: str, draft: ConnectorDraft) -> AgentConnector:
        before = self.connector(agent_id, connector_id)
        secrets = None
        has_secret = before.has_secret
        if draft.secret is not None:
            secrets = {key: value for key, value in self._secrets.items() if key != connector_id}
            if draft.secret:
                secrets[connector_id] = draft.secret
            has_secret = bool(draft.secret)
        made = _made(connector_id, draft, has_secret=has_secret)
        items = [made if item.id == connector_id else item for item in self.connectors(agent_id)]
        self._save(self._off, self._instructions, {**self._connectors, agent_id: items}, secrets)
        return made

    def remove_connector(self, agent_id: str, connector_id: str) -> None:
        self.connector(agent_id, connector_id)
        items = [item for item in self.connectors(agent_id) if item.id != connector_id]
        secrets = {key: value for key, value in self._secrets.items() if key != connector_id}
        self._save(self._off, self._instructions, {**self._connectors, agent_id: items}, secrets)

    def catalog(self, *, model: bool) -> AgentCatalog:
        return AgentCatalog(
            agents=[
                declared.spec(self.enabled(declared.id)).model_copy(
                    update={
                        "custom_instructions": self.instructions(declared.id),
                        "connectors": self.connectors(declared.id),
                    }
                )
                for declared in DECLARED
            ],
            model=model,
        )


def _made(connector_id: str, draft: ConnectorDraft, *, has_secret: bool) -> AgentConnector:
    name, url = draft.name.strip(), draft.url.strip()
    if not name:
        raise AgentError(422, "name", "A connector needs a name.")
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise AgentError(422, "url", "A connector's address must start with http:// or https://.")
    if parts.username or parts.password:
        raise AgentError(422, "url", "Put a key in the secret, not in the address.")
    header = (draft.header or "").strip() or None
    if header is not None and not header.replace("-", "").isalnum():
        raise AgentError(422, "header", "A header name has only letters, digits and dashes.")
    try:
        return AgentConnector(
            id=connector_id,
            name=name,
            url=url,
            description=draft.description.strip(),
            header=header,
            has_secret=has_secret,
            enabled=draft.enabled,
        )
    except ValueError as exc:
        raise AgentError(422, "connector", "A connector's name, address or description is too long.") from exc
