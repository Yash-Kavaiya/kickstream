"""An agent's connectors called over HTTP with urllib, so no dependency is needed."""

import asyncio
import http.client
import json
import urllib.error
import urllib.request
from collections.abc import Mapping

from kickstream.ports.connector import ConnectorFailure

USER_AGENT = "Kickstream"
MAX_BODY = 64 * 1024  # read no more of an answer than this


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A connector answers at the address it was given: a redirect elsewhere is not followed."""

    def redirect_request(self, *args, **kwargs):  # noqa: ANN002, ANN003 - urllib's signature
        return None


class HttpConnectorClient:
    def __init__(self, timeout_s: float = 8.0) -> None:
        self._timeout_s = timeout_s
        self._opener = urllib.request.build_opener(_NoRedirect)

    async def post(self, url: str, headers: Mapping[str, str], payload: dict) -> tuple[int, str]:
        return await asyncio.to_thread(self._post, url, dict(headers), payload)

    def _post(self, url: str, headers: dict[str, str], payload: dict) -> tuple[int, str]:
        request = urllib.request.Request(  # noqa: S310 - the studio's own http(s) address, checked when saved
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain",
                **headers,
            },
            method="POST",
        )
        try:
            with self._opener.open(request, timeout=self._timeout_s) as response:
                return response.status, response.read(MAX_BODY).decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            body = exc.read(MAX_BODY).decode("utf-8", errors="replace") if exc.fp else ""
            return exc.code, body
        except TimeoutError as exc:
            raise ConnectorFailure(f"It did not answer within {self._timeout_s:.0f} seconds.") from exc
        except (OSError, http.client.HTTPException) as exc:
            reason = getattr(exc, "reason", None) or exc
            raise ConnectorFailure(f"It could not be reached ({reason}).") from exc
