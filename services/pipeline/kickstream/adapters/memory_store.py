from bisect import bisect_right
from operator import attrgetter

from pydantic import BaseModel

from kickstream.domain.recent import make_room
from kickstream.ports.store import LogItem

_by_id = attrgetter("id")


class InMemoryMatchStore:
    """The logs of the newest matches. An older match is forgotten, so a pipeline running for days stays bounded.

    Each log is kept in id order, so appending is O(1) and reading after an id is a binary search.
    """

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
            id=log[-1].id + 1 if log else 1,
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
        self._logs[match_id] = sorted(items, key=_by_id)

    def read(self, match_id: str, after_id: int = 0) -> list[LogItem]:
        log = self._logs.get(match_id, [])
        return log[bisect_right(log, after_id, key=_by_id) :]

    def has(self, match_id: str) -> bool:
        return match_id in self._logs
