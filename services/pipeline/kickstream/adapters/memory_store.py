from pydantic import BaseModel

from kickstream.domain.recent import make_room
from kickstream.ports.store import LogItem


class InMemoryMatchStore:
    """The logs of the newest matches. An older match is forgotten, so a pipeline running for days stays bounded."""

    def __init__(self, remembered: int = 6) -> None:
        self._logs: dict[str, list[LogItem]] = {}
        self._remembered = remembered

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
    ) -> LogItem:
        make_room(self._logs, match_id, self._remembered)
        log = self._logs.setdefault(match_id, [])
        # One past the highest id, not the length: a gap must not hand that id out again.
        item = LogItem(
            id=max((kept.id for kept in log), default=0) + 1,
            match_id=match_id,
            type=type,
            minute=minute,
            payload=payload,
            language=language,
            mode=mode,
            team_id=team_id,
            player_id=player_id,
        )
        log.append(item)
        return item

    def restore(self, match_id: str, items: list[LogItem]) -> None:
        """Put a match's log back as it was stored, keeping each item's id."""
        make_room(self._logs, match_id, self._remembered)
        self._logs[match_id] = sorted(items, key=lambda item: item.id)

    def read(self, match_id: str, after_id: int = 0) -> list[LogItem]:
        return [item for item in self._logs.get(match_id, []) if item.id > after_id]

    def has(self, match_id: str) -> bool:
        return match_id in self._logs
