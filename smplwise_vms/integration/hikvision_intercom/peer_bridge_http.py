"""Public HA-authenticated peer query bridge on the existing Supervisor path."""

from __future__ import annotations

import asyncio

from aiohttp import web
from homeassistant.components.http import KEY_HASS, HomeAssistantView
from homeassistant.core import callback

from .access.models import AccessError
from .const import DOMAIN
from .peer_bridge_api import PeerQueryBridge
from .trusted_actions.bridge_transport_origin import HTTP_QUERY_PATH
from .trusted_actions.validation import Refusal, strict_json

MAX_REQUEST_BYTES = 65_536


class PeerQueryView(HomeAssistantView):
    url = HTTP_QUERY_PATH
    name = "api:hikvision_intercom:peer_query"
    requires_auth = True

    async def post(self, request):
        try:
            async with asyncio.timeout(15):
                data = bytearray()
                async for block in request.content.iter_chunked(16_384):
                    if len(data) + len(block) > MAX_REQUEST_BYTES:
                        raise Refusal("request_too_large")
                    data.extend(block)
                message = strict_json(bytes(data), limit=MAX_REQUEST_BYTES)
                hass = request.app[KEY_HASS]
                bridge = hass.data.get(DOMAIN, {}).get("peer_bridge")
                if type(bridge) is not PeerQueryBridge:
                    raise Refusal("binding_denied")
                result = await PeerQueryBridge.http_query(bridge, request, message)
            # No awaited source/auth operation follows the final original guard.
            return web.json_response(result)
        except (Refusal, AccessError) as error:
            return web.json_response({"error": {"code": error.code}}, status=403)
        except (ValueError, TypeError, KeyError, UnicodeError, RecursionError):
            return web.json_response({"error": {"code": "invalid_fields"}}, status=400)
        except TimeoutError:
            return web.json_response({"error": {"code": "deadline_exceeded"}}, status=408)


@callback
def register_peer_bridge_http(hass):
    hass.http.register_view(PeerQueryView())
