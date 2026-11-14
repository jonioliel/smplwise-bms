"""Bound even the response bodies HTTPX consumes during Digest authentication."""

from collections.abc import AsyncIterator

import httpx

from ..exceptions import HikvisionValidationError
from ..media_lifetime import join_owned
from .effect_scope import check_request


class LimitedStream(httpx.AsyncByteStream):
    """Limit raw transport bytes before HTTPX can buffer an authentication reply."""

    def __init__(
        self, stream: httpx.AsyncByteStream, limit: int, *, request=None, transport=None
    ) -> None:
        self._stream = stream
        self._limit = limit
        self._request, self._transport = request, transport

    async def __aiter__(self) -> AsyncIterator[bytes]:
        total = 0
        async for chunk in self._stream:
            if self._request is not None:
                check_request(self._request, self._transport)
            total += len(chunk)
            if total > self._limit:
                raise HikvisionValidationError("Transport response exceeds size limit")
            yield chunk

    async def aclose(self) -> None:
        await self._stream.aclose()


class LimitedTransport(httpx.AsyncBaseTransport):
    """Delegate connections and TLS to HTTPX with an independent raw-body ceiling."""

    def __init__(
        self, transport: httpx.AsyncBaseTransport, limit: int, *, stream_path: str | None = None
    ) -> None:
        self._transport = transport
        self._limit = limit
        self._stream_path = stream_path

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        check_request(request, self)
        response = await self._transport.handle_async_request(request)
        try:
            check_request(request, self)
        except BaseException:
            await join_owned(response.aclose())
            raise
        if response.headers.get("content-encoding", "identity").casefold() != "identity":
            await response.aclose()
            raise HikvisionValidationError("Compressed probe responses are not accepted")
        if not (response.status_code == 200 and request.url.path == self._stream_path):
            response.stream = LimitedStream(
                response.stream, self._limit, request=request, transport=self
            )  # type: ignore[arg-type]
        return response

    async def aclose(self) -> None:
        await self._transport.aclose()
