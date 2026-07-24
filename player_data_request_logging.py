from __future__ import annotations

import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request

import owner_player_contract_sync


def install_player_data_request_logging() -> None:
    def request_player_data_page(
        shard_number: int,
        before_player_id: int | None,
    ) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"limit": owner_player_contract_sync.PAGE_LIMIT}
        if before_player_id is not None:
            params["beforePlayerId"] = before_player_id

        request = Request(
            f"{owner_player_contract_sync.PLAYERS_URL}?{urlencode(params)}",
            headers={
                "Accept": "application/json",
                "User-Agent": "mfl-front-office-player-data-import/1.0",
            },
        )
        cursor_label = "latest" if before_player_id is None else str(before_player_id)
        label = (
            f"Player data shard {shard_number} request "
            f"beforePlayerId={cursor_label}"
        )

        for attempt in range(owner_player_contract_sync.RETRIES + 1):
            try:
                with owner_player_contract_sync.urlopen(
                    request,
                    timeout=owner_player_contract_sync.REQUEST_TIMEOUT_SECONDS,
                ) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                return owner_player_contract_sync._players_from_payload(payload)
            except HTTPError as error:
                body = error.read().decode("utf-8", errors="replace")
                failure = f"HTTP {error.code}: {body}"
            except (URLError, TimeoutError) as error:
                failure = str(error)
            except json.JSONDecodeError as error:
                failure = f"invalid JSON: {error}"

            if attempt == owner_player_contract_sync.RETRIES:
                raise RuntimeError(
                    f"{label} failed after "
                    f"{owner_player_contract_sync.RETRIES + 1} attempts: {failure}"
                )
            print(
                f"{label} failed; retrying in "
                f"{owner_player_contract_sync.RETRY_DELAY_SECONDS}s "
                f"({attempt + 1}/{owner_player_contract_sync.RETRIES})",
                flush=True,
            )
            time.sleep(owner_player_contract_sync.RETRY_DELAY_SECONDS)

        raise RuntimeError(f"{label} failed after retries")

    owner_player_contract_sync._request_players_page = request_player_data_page
