import json

from kickstream.contracts import Envelope, ViewerProfile
from kickstream.ports.store import LogItem

_HIGHLIGHTABLE = {"key_moment", "narrative", "highlight"}


def highlighted_for(item: LogItem, profile: ViewerProfile) -> bool | None:
    """Whether one log item is highlighted for one viewer, or None if it is another viewer's variant."""
    if item.language is not None and item.language != profile.language:
        return None
    if item.mode is not None and item.mode != profile.mode:
        return None
    favorite = (profile.club is not None and item.team_id == profile.club) or (
        profile.player is not None and item.player_id == profile.player
    )
    return item.type in _HIGHLIGHTABLE and favorite


def to_envelope(item: LogItem, profile: ViewerProfile) -> Envelope | None:
    """Shape one log item for one viewer, or drop it if it is another viewer's variant."""
    highlighted = highlighted_for(item, profile)
    if highlighted is None:
        return None
    # Built without validation: every field comes from a log item whose payload the bus has already validated.
    return Envelope.model_construct(
        id=item.id,
        type=item.type,
        match_id=item.match_id,
        minute=item.minute,
        highlighted=highlighted,
        payload=item.payload_data,
    )


def to_json(item: LogItem, profile: ViewerProfile) -> str | None:
    """`to_envelope` as JSON text. The payload, most of its size, is encoded once per item rather than per viewer."""
    highlighted = highlighted_for(item, profile)
    if highlighted is None:
        return None
    return (
        f'{{"id":{item.id},"type":{json.dumps(item.type)},"match_id":{json.dumps(item.match_id)},'
        f'"minute":{item.minute},"highlighted":{"true" if highlighted else "false"},"payload":{item.payload_json}}}'
    )
