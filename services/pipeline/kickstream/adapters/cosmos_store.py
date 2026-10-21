"""The match log in Azure Cosmos DB: everything the pipeline records, kept after the process ends.

Live viewers read from memory. Each item is written to Cosmos DB behind them on a thread of its own, so a
slow or failing write never holds up the event loop. A match no longer in memory is read back from Cosmos DB.
Items are partitioned by match, one document per log item.
"""

import logging
import queue
import threading
from typing import Any

from azure.core.credentials import TokenCredential
from azure.core.exceptions import AzureError
from azure.cosmos import CosmosClient
from pydantic import BaseModel

from kickstream.adapters.memory_store import InMemoryMatchStore
from kickstream.domain.payloads import TYPE_NAMES
from kickstream.ports.store import LogItem

log = logging.getLogger(__name__)
PAYLOAD_TYPES: dict[str, type[BaseModel]] = {name: model for model, name in TYPE_NAMES.items()}
_STOP = object()


def cosmos_container(endpoint: str, database: str, container: str, credential: TokenCredential) -> Any:
    client = CosmosClient(endpoint, credential=credential)
    return client.get_database_client(database).get_container_client(container)


def to_document(item: LogItem) -> dict:
    return {
        "id": f"{item.match_id}:{item.id}",
        "match_id": item.match_id,
        "seq": item.id,
        "type": item.type,
        "minute": item.minute,
        "language": item.language,
        "mode": item.mode,
        "team_id": item.team_id,
        "player_id": item.player_id,
        "payload": item.payload_data,
    }


def from_document(document: dict) -> LogItem:
    return LogItem(
        id=document["seq"],
        match_id=document["match_id"],
        type=document["type"],
        minute=document["minute"],
        payload=PAYLOAD_TYPES[document["type"]].model_validate(document["payload"]),
        language=document.get("language"),
        mode=document.get("mode"),
        team_id=document.get("team_id"),
        player_id=document.get("player_id"),
    )


class CosmosMatchStore:
    def __init__(self, container: Any, *, remembered: int = 6, max_waiting: int = 10_000) -> None:
        self._container = container
        self._memory = InMemoryMatchStore(remembered)
        self._absent: set[str] = set()
        self._waiting: queue.Queue = queue.Queue(max_waiting)
        # Items still queued for Cosmos. A match dropped from memory is rebuilt from these as well,
        # so a slow write is not lost. The queue's own limit is the bound.
        self._unflushed: dict[str, dict[int, LogItem]] = {}
        self._lock = threading.Lock()
        self.failures = 0
        self._writer = threading.Thread(target=self._write, name="cosmos-match-log", daemon=True)
        self._writer.start()

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
        self._absent.discard(match_id)
        item = self._memory.append(
            match_id,
            type,
            minute,
            payload,
            language=language,
            mode=mode,
            team_id=team_id,
            player_id=player_id,
        )
        # Remembered before it is queued, so the writer cannot finish it untracked.
        self._remember(item)
        try:
            self._waiting.put_nowait(item)
        except queue.Full:
            self._forget(item)
            self.failures += 1
            log.warning(
                "the Cosmos DB writer is behind; %s item %s is kept in memory only", match_id, item.id
            )
        return item

    def read(self, match_id: str, after_id: int = 0) -> list[LogItem]:
        self._load(match_id)
        return self._memory.read(match_id, after_id)

    def has(self, match_id: str) -> bool:
        self._load(match_id)
        return self._memory.has(match_id)

    def flush(self) -> None:
        """Returns once every item appended so far has been written or has failed."""
        self._waiting.join()

    def close(self) -> None:
        self._waiting.put(_STOP)
        self._writer.join(timeout=10)

    def _load(self, match_id: str) -> None:
        if self._memory.has(match_id) or match_id in self._absent:
            return
        # Taken before the query, so an item written through while it runs is still here or already
        # in the answer: either way it comes back with the id it was given.
        pending = self._pending(match_id)
        try:
            documents = list(
                self._container.query_items(
                    query="SELECT * FROM c WHERE c.match_id = @match_id ORDER BY c.seq",
                    parameters=[{"name": "@match_id", "value": match_id}],
                    partition_key=match_id,
                )
            )
        except AzureError as exc:
            log.warning("could not read match %s from Cosmos DB: %s", match_id, exc)
            return
        by_id = {item.id: item for item in (from_document(document) for document in documents)}
        for item in pending:
            by_id.setdefault(item.id, item)
        if not by_id:
            self._absent.add(match_id)
            return
        self._memory.restore(match_id, list(by_id.values()))

    def _remember(self, item: LogItem) -> None:
        with self._lock:
            self._unflushed.setdefault(item.match_id, {})[item.id] = item

    def _forget(self, item: LogItem) -> None:
        with self._lock:
            pending = self._unflushed.get(item.match_id)
            if pending is None:
                return
            pending.pop(item.id, None)
            if not pending:
                del self._unflushed[item.match_id]

    def _pending(self, match_id: str) -> list[LogItem]:
        with self._lock:
            return list(self._unflushed.get(match_id, {}).values())

    def _write(self) -> None:
        while True:
            item = self._waiting.get()
            try:
                if item is _STOP:
                    return
                self._container.upsert_item(to_document(item))
            except (AzureError, ValueError) as exc:
                self.failures += 1
                log.warning("could not write %s item %s to Cosmos DB: %s", item.match_id, item.id, exc)
            finally:
                if item is not _STOP:
                    self._forget(item)
                self._waiting.task_done()
