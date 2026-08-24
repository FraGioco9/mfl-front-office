from __future__ import annotations

from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label} fragment, found {count}")
    return source.replace(old, new, 1)


def write_if_changed(path: Path, original: str, updated: str) -> None:
    if original == updated:
        print(f"Unchanged {path}")
        return
    path.write_text(updated, encoding="utf-8")
    print(f"Migrated {path}")


pipeline_path = Path("run_flow_rebuild.py")
runner_path = Path("rebuild_database_runner.py")

pipeline_original = pipeline_path.read_text(encoding="utf-8").replace("\r\n", "\n")
runner_original = runner_path.read_text(encoding="utf-8").replace("\r\n", "\n")

pipeline = pipeline_original
runner = runner_original

pipeline = replace_once(
    pipeline,
    "from urllib.parse import urlencode\n",
    "from urllib.parse import urlencode, urlparse\n",
    "pipeline urllib.parse import",
)

pipeline = replace_once(
    pipeline,
    "RETRY_DELAY_SECONDS = 90.0\n\nflow_module.FLOW_STATIC_PLAYER_BATCH_SIZE = FLOW_BATCH_SIZE\n",
    '''RETRY_DELAY_SECONDS = 90.0\nMFL_API_TOKEN_HEADER = "X-MFL-Api-Token"\nMFL_API_HOSTS = frozenset({\n    "api.playmfl.com",\n    "z519wdyajg.execute-api.us-east-1.amazonaws.com",\n})\n_mfl_api_token = ""\n\nflow_module.FLOW_STATIC_PLAYER_BATCH_SIZE = FLOW_BATCH_SIZE\n''',
    "canonical MFL authentication constants",
)

pipeline = replace_once(
    pipeline,
    "def request_json(url: str, request_name: str, limiter: RateLimiter | None = None) -> Any:\n",
    '''def configure_mfl_api_token(token: str) -> None:\n    """Configure the token used for MFL-owned HTTP hosts."""\n    global _mfl_api_token\n    _mfl_api_token = str(token or "").strip()\n\n\ndef request_headers(url: str) -> dict[str, str]:\n    """Build canonical rebuild request headers, including scoped MFL authentication."""\n    headers = {\n        "Accept": "application/json",\n        "User-Agent": "mfl-front-office-rebuild/4.1",\n    }\n    hostname = (urlparse(str(url)).hostname or "").lower()\n    if _mfl_api_token and hostname in MFL_API_HOSTS:\n        headers[MFL_API_TOKEN_HEADER] = _mfl_api_token\n    return headers\n\n\ndef request_json(url: str, request_name: str, limiter: RateLimiter | None = None) -> Any:\n''',
    "canonical MFL authentication helpers",
)

pipeline = replace_once(
    pipeline,
    '        request = Request(url, headers={"Accept": "application/json", "User-Agent": "mfl-front-office-rebuild/4.1"})\n',
    "        request = Request(url, headers=request_headers(url))\n",
    "request header construction",
)

runner = replace_once(
    runner,
    "from urllib.parse import urlparse\n",
    "",
    "runner urlparse import",
)
runner = replace_once(
    runner,
    '''MFL_API_TOKEN_ENVIRONMENT_VARIABLE = "MFL_API_TOKEN"\nMFL_API_HOSTS = {\n    "api.playmfl.com",\n    "z519wdyajg.execute-api.us-east-1.amazonaws.com",\n}\n''',
    'MFL_API_TOKEN_ENVIRONMENT_VARIABLE = "MFL_API_TOKEN"\n',
    "runner MFL host duplication",
)
runner = replace_once(
    runner,
    '''def install_mfl_api_authentication() -> None:\n    """Add the configured MFL API token to requests handled by the rebuild pipeline."""\n    token = os.environ.get(MFL_API_TOKEN_ENVIRONMENT_VARIABLE, "").strip()\n    if not token:\n        raise RuntimeError(\n            f"{MFL_API_TOKEN_ENVIRONMENT_VARIABLE} is required for database rebuilds"\n        )\n\n    original_request = pipeline.Request\n\n    def authenticated_request(url: Any, *args: Any, **kwargs: Any) -> Any:\n        hostname = (urlparse(str(url)).hostname or "").lower()\n        if hostname in MFL_API_HOSTS:\n            headers = dict(kwargs.get("headers") or {})\n            headers["X-MFL-Api-Token"] = token\n            kwargs["headers"] = headers\n        return original_request(url, *args, **kwargs)\n\n    pipeline.Request = authenticated_request\n''',
    '''def install_mfl_api_authentication() -> None:\n    """Configure the canonical rebuild HTTP owner with the production MFL API token."""\n    token = os.environ.get(MFL_API_TOKEN_ENVIRONMENT_VARIABLE, "").strip()\n    if not token:\n        raise RuntimeError(\n            f"{MFL_API_TOKEN_ENVIRONMENT_VARIABLE} is required for database rebuilds"\n        )\n    pipeline.configure_mfl_api_token(token)\n''',
    "runner authentication monkey patch",
)

for required in [
    'MFL_API_TOKEN_HEADER = "X-MFL-Api-Token"',
    "def configure_mfl_api_token(token: str) -> None:",
    "def request_headers(url: str) -> dict[str, str]:",
    "headers[MFL_API_TOKEN_HEADER] = _mfl_api_token",
    "Request(url, headers=request_headers(url))",
]:
    if required not in pipeline:
        raise RuntimeError(f"Canonical pipeline authentication is missing: {required}")

for retired in ["pipeline.Request =", "original_request = pipeline.Request", "def authenticated_request(", "MFL_API_HOSTS = {"]:
    if retired in runner:
        raise RuntimeError(f"Runner still owns MFL request authentication through: {retired}")
if "pipeline.configure_mfl_api_token(token)" not in runner:
    raise RuntimeError("Runner does not configure the canonical MFL request owner")

write_if_changed(pipeline_path, pipeline_original, pipeline)
write_if_changed(runner_path, runner_original, runner)
