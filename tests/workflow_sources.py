"""Read the implementation wired to a workflow step, preserving existing contracts."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read_workflow(path: str) -> str:
    source = (ROOT / path).read_text(encoding="utf-8")
    pattern = r'^( +)run: bash "\$GITHUB_WORKSPACE/(?:builder/)?(scripts/workflows/[a-z0-9-]+\.sh)"$'
    def expand(match: re.Match) -> str:
        script = (ROOT / match[2]).read_text(encoding="utf-8")
        script = re.sub(r'^#![^\n]+\n', '', script).rstrip()
        return match[1] + 'run: |\n' + '\n'.join(match[1] + '  ' + line for line in script.splitlines())
    return re.sub(pattern, expand, source, flags=re.MULTILINE)
