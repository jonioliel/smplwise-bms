"""`python -m smplwise` — run the API (uvicorn). Inside the add-on run.sh sets the environment."""
from __future__ import annotations

import os

import uvicorn

from .main import create_app


def main() -> None:
    host = os.environ.get("SW_HOST", "127.0.0.1")
    port = int(os.environ.get("SW_PORT", "8099"))
    uvicorn.run(create_app(), host=host, port=port, log_level=os.environ.get("SW_LOG_LEVEL", "info").lower(), proxy_headers=False)


if __name__ == "__main__":
    main()
