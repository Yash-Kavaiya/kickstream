from dataclasses import dataclass
from typing import Protocol


class CommentaryError(Exception):
    """A commentary writer could not produce usable text."""


@dataclass(frozen=True)
class CommentaryContext:
    """What auto live is showing and every fact a writer may use. Nothing else may be stated."""

    scene: str
    kind: str
    agent: str | None
    blurb: str
    facts: tuple[tuple[str, str], ...]
    # Whether this is the scene arriving, or more said while it stays on air.
    opening: bool
    # The language the spoken line must use. Facts stay in English for the model to translate.
    language: str = "en"


class CommentaryWriter(Protocol):
    """Words a few sentences of live commentary for the scene on air."""

    model: str

    async def write(self, ctx: CommentaryContext) -> str: ...
