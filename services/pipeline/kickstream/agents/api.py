import heapq
from collections.abc import Callable
from operator import attrgetter

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from kickstream.agents.connectors import AgentConnectors
from kickstream.agents.registry import AgentSwitches, ConnectorDraft
from kickstream.contracts import AgentCatalog, ConnectorCheck, MatchIntelligence
from kickstream.domain.types import Mode
from kickstream.ports.store import MatchStore

MAX_PLAYS = 10
MAX_EXPLANATIONS = 6
MAX_HIGHLIGHTS = 40
MAX_RUNS = 20


class Switch(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    enabled: bool


class Instructions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    custom_instructions: str = Field(max_length=4000)  # the switches give the real limit and its message


class ConnectorBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=200)
    url: str = Field(max_length=1000)
    description: str = Field(default="", max_length=1000)
    header: str | None = Field(default=None, max_length=200)
    # Left out, the saved secret is kept; "" removes it. It is never sent back.
    secret: str | None = Field(default=None, max_length=1000)
    enabled: bool = True

    def draft(self) -> ConnectorDraft:
        return ConnectorDraft(
            name=self.name,
            url=self.url,
            description=self.description,
            header=self.header,
            secret=self.secret,
            enabled=self.enabled,
        )


def intelligence(store: MatchStore, match_id: str, mode: Mode, player: str | None) -> MatchIntelligence:
    """The latest output of every agent for one match, read from the match log."""
    latest: dict[str, BaseModel] = {}
    plays, explanations, highlights, runs = [], [], [], []
    minute = 0
    for item in store.read(match_id):
        minute = max(minute, item.minute)
        if item.type == "play":
            plays.append(item.payload)
        elif item.type == "explanation":
            if item.mode == mode:
                explanations.append(item.payload)
        elif item.type == "highlight":
            highlights.append(item.payload)
        elif item.type == "agent_run":
            runs.append(item.payload)
        elif item.type in ("tactics", "prediction", "pitch_scene", "players"):
            latest[item.type] = item.payload

    report = latest.get("players")
    tracked = None
    if report is not None and report.players:
        tracked = next((line for line in report.players if line.player_id == player), None)
        if tracked is None and player is None:
            tracked = max(report.players, key=lambda line: (line.rating, line.touches))
    return MatchIntelligence(
        match_id=match_id,
        minute=minute,
        plays=plays[-MAX_PLAYS:],
        tactics=latest.get("tactics"),
        prediction=latest.get("prediction"),
        explanations=explanations[-MAX_EXPLANATIONS:],
        pitch=latest.get("pitch_scene"),
        player=tracked,
        highlights=heapq.nlargest(MAX_HIGHLIGHTS, highlights, key=attrgetter("score")),
        runs=runs[-MAX_RUNS:],
    )


def build_agents_router(
    *,
    switches: AgentSwitches,
    store: MatchStore,
    match_exists: Callable[[str], bool],
    model: bool,
    connectors: AgentConnectors | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/agents")
    def get_agents() -> AgentCatalog:
        return switches.catalog(model=model)

    @router.put("/agents/{agent_id}")
    def put_agent(agent_id: str, body: Switch) -> AgentCatalog:
        switches.set(agent_id, body.enabled)
        return switches.catalog(model=model)

    @router.put("/agents/{agent_id}/instructions")
    def put_instructions(agent_id: str, body: Instructions) -> AgentCatalog:
        switches.set_instructions(agent_id, body.custom_instructions)
        return switches.catalog(model=model)

    @router.post("/agents/{agent_id}/connectors")
    def post_connector(agent_id: str, body: ConnectorBody) -> AgentCatalog:
        switches.add_connector(agent_id, body.draft())
        return switches.catalog(model=model)

    @router.put("/agents/{agent_id}/connectors/{connector_id}")
    def put_connector(agent_id: str, connector_id: str, body: ConnectorBody) -> AgentCatalog:
        switches.update_connector(agent_id, connector_id, body.draft())
        return switches.catalog(model=model)

    @router.delete("/agents/{agent_id}/connectors/{connector_id}")
    def delete_connector(agent_id: str, connector_id: str) -> AgentCatalog:
        switches.remove_connector(agent_id, connector_id)
        return switches.catalog(model=model)

    @router.post("/agents/{agent_id}/connectors/{connector_id}/check")
    async def check_connector(agent_id: str, connector_id: str) -> ConnectorCheck:
        if connectors is None:
            raise HTTPException(status_code=404, detail="Connectors are not set up.")
        return await connectors.check(agent_id, connector_id)

    @router.get("/matches/{match_id}/intelligence")
    def get_intelligence(match_id: str, mode: Mode = "fan", player: str | None = None) -> MatchIntelligence:
        if not match_exists(match_id):
            raise HTTPException(status_code=404, detail=f"unknown match {match_id}")
        return intelligence(store, match_id, mode, player or None)

    return router
