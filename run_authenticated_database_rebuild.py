from __future__ import annotations

"""Run the database rebuild with authenticated MFL API requests."""

import os
import runpy
from typing import Any
from urllib.parse import urlparse

# rebuild_database installs the in-memory update_database compatibility module
# before importing run_flow_rebuild. Import it first so the authenticated
# entrypoint follows the same initialization order as the normal rebuild.
import rebuild_database  # noqa: F401
import run_flow_rebuild as pipeline


TOKEN_ENVIRONMENT_VARIABLE = "MFL_API_TOKEN"
MFL_API_HOSTS = {
    "api.playmfl.com",
    "z519wdyajg.execute-api.us-east-1.amazonaws.com",
}

_original_request = pipeline.Request


def authenticated_request(url: Any, *args: Any, **kwargs: Any) -> Any:
    """Add the MFL token header without exposing the token in source or logs."""
    hostname = (urlparse(str(url)).hostname or "").lower()
    if hostname in MFL_API_HOSTS:
        token = os.environ.get(TOKEN_ENVIRONMENT_VARIABLE, "").strip()
        if not token:
            raise RuntimeError(
                f"{TOKEN_ENVIRONMENT_VARIABLE} is required for MFL API requests"
            )
        headers = dict(kwargs.get("headers") or {})
        headers["X-MFL-Api-Token"] = token
        kwargs["headers"] = headers
    return _original_request(url, *args, **kwargs)


pipeline.Request = authenticated_request
runpy.run_module("rebuild_database_runner", run_name="__main__")
