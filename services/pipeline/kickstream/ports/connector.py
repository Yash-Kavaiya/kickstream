"""What an agent's connectors need from outside: one HTTP call to a service the studio names."""

from collections.abc import Mapping
from typing import Protocol


class ConnectorFailure(Exception):
    """A connector could not be reached or did not answer. The message is written for the studio."""


class ConnectorClient(Protocol):
    async def post(self, url: str, headers: Mapping[str, str], payload: dict) -> tuple[int, str]:
        """POSTs the payload as JSON. Returns the status and the start of the body. Raises ConnectorFailure."""
