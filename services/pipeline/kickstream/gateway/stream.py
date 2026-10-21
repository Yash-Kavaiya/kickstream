from collections.abc import AsyncIterator
from contextlib import aclosing

from kickstream.contracts import Envelope, ViewerProfile
from kickstream.gateway.personalize import to_envelope, to_json
from kickstream.ports.broadcaster import Broadcaster
from kickstream.ports.store import LogItem, MatchStore

# Only the newest of these is of use to a page that has just arrived, and they are most of a match's
# log by size. A replay sends the newest of each and leaves out the ones it replaced.
LATEST_ONLY = frozenset({"pitch_scene", "players"})


def _replayed(items: list[LogItem]) -> list[LogItem]:
    newest = {item.type: item.id for item in items if item.type in LATEST_ONLY}
    return [item for item in items if item.type not in LATEST_ONLY or newest[item.type] == item.id]


async def follow_log(
    store: MatchStore, broadcaster: Broadcaster, match_id: str, after_id: int = 0
) -> AsyncIterator[LogItem]:
    """Replay the match log after `after_id`, then follow it live.

    The live feed is opened before the replay is read, so an item published in between is
    seen twice rather than missed; the ID check drops the second copy.
    """
    feed = broadcaster.subscribe(match_id)
    try:
        waiting = store.read(match_id, after_id)
        if not waiting and after_id > 0:
            logged = store.read(match_id)
            if after_id > (logged[-1].id if logged else 0):
                # An ID this log has not reached cannot have come from it. Replay everything
                # rather than stay silent until the log catches up.
                after_id, waiting = 0, logged
        last = waiting[-1].id if waiting else after_id
        for item in _replayed(waiting):
            yield item
        async for item in feed:
            if item.id <= last:
                continue
            last = item.id
            yield item
    finally:
        feed.close()


async def stream_items(
    store: MatchStore, broadcaster: Broadcaster, match_id: str, profile: ViewerProfile, after_id: int = 0
) -> AsyncIterator[Envelope]:
    """The match log as one viewer sees it: replayed after `after_id`, then followed live."""
    async with aclosing(follow_log(store, broadcaster, match_id, after_id)) as items:
        async for item in items:
            envelope = to_envelope(item, profile)
            if envelope is not None:
                yield envelope


async def stream_json(
    store: MatchStore, broadcaster: Broadcaster, match_id: str, profile: ViewerProfile, after_id: int = 0
) -> AsyncIterator[tuple[int, str]]:
    """`stream_items` as each envelope's id and JSON text, the form the stream routes send."""
    async with aclosing(follow_log(store, broadcaster, match_id, after_id)) as items:
        async for item in items:
            text = to_json(item, profile)
            if text is not None:
                yield item.id, text
