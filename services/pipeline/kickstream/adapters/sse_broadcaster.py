import asyncio

from kickstream.ports.store import LogItem

_CLOSED = object()


class _Feed:
    def __init__(self, maxsize: int, on_close) -> None:
        # One extra slot so the end marker always fits after an overflow.
        self.queue: asyncio.Queue = asyncio.Queue(maxsize + 1)
        self.maxsize = maxsize
        self.closed = False
        self._on_close = on_close

    def __aiter__(self):
        return self

    async def __anext__(self) -> LogItem:
        item = await self.queue.get()
        if item is _CLOSED:
            raise StopAsyncIteration
        return item

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self._on_close(self)
        while not self.queue.empty():
            self.queue.get_nowait()
        self.queue.put_nowait(_CLOSED)


class InProcessBroadcaster:
    """Fans a match log out to connected viewers. A viewer that falls behind is disconnected.

    Viewers are kept per match in an insertion-ordered set, so one leaving is O(1), and a match
    with no viewers left is forgotten.
    """

    def __init__(self) -> None:
        self._feeds: dict[str, dict[_Feed, None]] = {}

    def subscribe(self, match_id: str, maxsize: int = 512) -> _Feed:
        feeds = self._feeds.setdefault(match_id, {})
        feed = _Feed(maxsize, lambda closed: self._leave(match_id, closed))
        feeds[feed] = None
        return feed

    def publish(self, item: LogItem) -> None:
        for feed in list(self._feeds.get(item.match_id, ())):
            if feed.queue.qsize() >= feed.maxsize:
                feed.close()
            else:
                feed.queue.put_nowait(item)

    def _leave(self, match_id: str, feed: _Feed) -> None:
        feeds = self._feeds.get(match_id)
        if feeds is None:
            return
        feeds.pop(feed, None)
        if not feeds:
            del self._feeds[match_id]
