#!/usr/bin/env python3
"""Render a browser-viewable progression email preview without a deployed image API.

Production emails use the server-generated progression portrait PNG endpoint.
This preview renderer instead loads the canonical portrait WebP in the browser,
crops source rows 0..499, removes transparent padding before the visible
silhouette on the left, then scales the remaining crop to 216px high for a
high-density raster while preserving its width-to-height proportions.
Transparent pixels to the right of the silhouette are preserved and may overflow
the reserved portrait slot.
"""

from __future__ import annotations

import argparse
import html
from pathlib import Path

import send_progression_emails as emails
from player_portraits import canonical_player_portrait_url


PREVIEW_PORTRAIT_SCRIPT = """
<script>
(() => {
  const HEIGHT = 216;
  const CROP_HEIGHT = 500;

  function transparentLeftInset(image, cropHeight) {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = cropHeight;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) return 0;

    sourceContext.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      cropHeight,
      0,
      0,
      image.naturalWidth,
      cropHeight,
    );

    try {
      const pixels = sourceContext.getImageData(
        0,
        0,
        image.naturalWidth,
        cropHeight,
      ).data;
      for (let x = 0; x < image.naturalWidth; x += 1) {
        for (let y = 0; y < cropHeight; y += 1) {
          const alpha = pixels[((y * image.naturalWidth) + x) * 4 + 3];
          if (alpha > 0) return x;
        }
      }
    } catch (_error) {
      // If a browser blocks pixel reads for a remote file:// preview, keep the
      // portrait visible and fall back to the full-width crop.
    }
    return 0;
  }

  function loadPortrait(canvas, sourceUrl, fallback, host, useCors) {
    const image = new Image();
    if (useCors) image.crossOrigin = "anonymous";

    image.onload = () => {
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;
      if (!sourceWidth || !sourceHeight) return;

      const cropHeight = Math.max(1, Math.min(CROP_HEIGHT, sourceHeight));
      const leftInset = transparentLeftInset(image, cropHeight);
      const alignedSourceWidth = Math.max(1, sourceWidth - leftInset);
      const targetWidth = Math.max(
        1,
        Math.round((alignedSourceWidth * HEIGHT) / cropHeight),
      );
      canvas.width = targetWidth;
      canvas.height = HEIGHT;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      if (host) host.style.width = "100%";

      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, targetWidth, HEIGHT);
      context.drawImage(
        image,
        leftInset,
        0,
        alignedSourceWidth,
        cropHeight,
        0,
        0,
        targetWidth,
        HEIGHT,
      );
      if (fallback) fallback.style.display = "none";
    };

    image.onerror = () => {
      if (useCors) {
        loadPortrait(canvas, sourceUrl, fallback, host, false);
        return;
      }
      canvas.style.display = "none";
      if (fallback) fallback.style.display = "table";
    };

    image.src = sourceUrl;
  }

  document.querySelectorAll("canvas[data-progression-preview-portrait]").forEach((canvas) => {
    const sourceUrl = canvas.dataset.progressionPreviewPortrait;
    const fallbackId = canvas.dataset.fallbackId;
    const fallback = fallbackId ? document.getElementById(fallbackId) : null;
    const host = canvas.parentElement;
    loadPortrait(canvas, sourceUrl, fallback, host, true);
  });
})();
</script>
""".strip()


def local_preview_identity_html(player: emails.PlayerImprovement) -> str:
    source_url = canonical_player_portrait_url(player.player_id)
    fallback_id = f"portrait-fallback-{html.escape(player.player_id)}"
    initials = html.escape(emails.player_initials(player))

    portrait = (
        '<div class="player-portrait-shell" style="position:relative;width:100%;background:#ffffff;overflow:hidden;">'
        f'<table id="{fallback_id}" role="presentation" width="100%" '
        'cellspacing="0" cellpadding="0" '
        'style="position:absolute;inset:0;width:100%;border-collapse:separate;background:transparent;">'
        '<tr><td align="center" valign="middle" '
        'style="width:100%;padding:32% 0;color:#60778a;font-size:75%;font-weight:700;line-height:1;">'
        f'{initials}</td></tr></table>'
        f'<canvas data-progression-preview-portrait="{html.escape(source_url)}" '
        f'data-fallback-id="{fallback_id}" width="{emails.PORTRAIT_SIZE_PX}" '
        f'height="{emails.PORTRAIT_SIZE_PX}" '
        'style="position:relative;display:block;width:100%;height:auto;background:transparent;"></canvas>'
        '</div>'
    )

    return (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="width:100%;border-collapse:collapse;table-layout:fixed;">'
        '<tr>'
        f'<td width="{emails.PLAYER_PORTRAIT_SLOT_PERCENT}%" valign="top" '
        f'style="width:{emails.PLAYER_PORTRAIT_SLOT_PERCENT}%;padding:0 4% 0 0;overflow:hidden;">'
        f'{portrait}</td>'
        '<td valign="top" style="padding:0;overflow-wrap:anywhere;">'
        f'<strong class="email-player-name" style="display:block;color:#17222b;">{html.escape(player.name)}</strong>'
        f'<span class="email-position" style="display:block;margin-top:.25em;color:#60778a;font-size:75%;">'
        f'{html.escape(player.positions)}</span>'
        '</td>'
        '</tr>'
        '</table>'
    )

def build_local_preview_html(
    players: list[emails.PlayerImprovement],
    theme: str = emails.DEFAULT_EMAIL_THEME,
) -> str:
    original_identity = emails.player_identity_html
    try:
        emails.player_identity_html = local_preview_identity_html
        rendered = emails.build_html("Test Email", players, theme)
    finally:
        emails.player_identity_html = original_identity

    return rendered.replace("</body>", f"{PREVIEW_PORTRAIT_SCRIPT}\n  </body>")


def write_local_preview(
    current_db: Path,
    output_path: Path,
    requested_player_id: str = "",
    requested_player_ids: str = "",
    theme: str = emails.DEFAULT_EMAIL_THEME,
) -> None:
    player_ids = emails.parse_preview_player_ids(
        requested_player_id,
        requested_player_ids,
    )
    players = emails.preview_players_from_database(current_db, player_ids)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_local_preview_html(players, theme), encoding="utf-8")
    print(
        f"Wrote progression email preview to {output_path} "
        f"with {len(players)} player{'s' if len(players) != 1 else ''}. No email was sent."
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Render a browser-viewable MFL progression email preview."
    )
    parser.add_argument("--current-db", default="mfl_database.db")
    parser.add_argument("--preview-output", default="progression-email-preview.html")
    parser.add_argument("--preview-player-id", default="")
    parser.add_argument("--preview-player-ids", default="")
    parser.add_argument(
        "--preview-theme",
        choices=("dark", "light"),
        default=emails.DEFAULT_EMAIL_THEME,
        help="Render the email using the saved MFL theme. Defaults to dark.",
    )
    args = parser.parse_args()

    current_db = Path(args.current_db)
    if not current_db.exists():
        print(f"Progression email preview skipped: current database not found at {current_db}.")
        return 1

    try:
        write_local_preview(
            current_db,
            Path(args.preview_output),
            args.preview_player_id,
            args.preview_player_ids,
            args.preview_theme,
        )
    except RuntimeError as error:
        print(f"Progression email preview failed: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
