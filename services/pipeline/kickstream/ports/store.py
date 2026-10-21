from dataclasses import dataclass
from functools import cached_property
from typing import Protocol

from pydantic import BaseModel


@dataclass(frozen=True)
class LogItem:
    """One entry in a match log. The variant fields drive per-viewer filtering."""

    id: int
    match_id: str
    type: str
    minute: int
    payload: BaseModel
    language: str | None = None
    mode: str | None = None
    team_id: str | None = None
    player_id: str | None = None

    # Worked out once per item, however many viewers it is sent to.
    @cached_property
    def payload_data(self) -> dict:
        """The payload as JSON-ready data."""
        return self.payload.model_dump(mode="json")

    @cached_property
    def payload_json(self) -> str:
        """The payload as JSON text."""
        return self.payload.model_dump_json()


class MatchStore(Protocol):
    def append(
        self,
        match_id: str,
        type: str,
        minute: int,
        payload: BaseModel,
        *,
        language: str | None = None,
        mode: str | None = None,
        team_id: str | None = None,
        player_id: str | None = None,
    ) -> LogItem: ...

    def read(self, match_id: str, after_id: int = 0) -> list[LogItem]: ...

    def has(self, match_id: str) -> bool: ...
