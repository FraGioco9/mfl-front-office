#!/usr/bin/env python3
"""Static, exact-HEAD Python AST and unresolved callable inventory; no imports executed."""
import ast
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]).resolve()
expected = "f9d87424bec5c8c3e3e9c7dbf048888f1a83ce6b"
actual = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
if actual != expected:
    raise RuntimeError("Pinned main SHA changed")
files = [p for p in subprocess.check_output(["git", "-C", str(root), "ls-files", "-z"]).decode().split("\0") if p]
python_files = sorted(p for p in files if p.endswith(".py"))
if len(files) != 783 or len(python_files) != 66:
    raise RuntimeError("Expected 783 tracked / 66 Python sources")
known = set(files)
resolved, dynamic, errors = [], [], []
parsed = 0

def locate(module):
    base = (module or "").replace(".", "/")
    for suffix in (".py", "/__init__.py"):
        dest = base + suffix
        if dest in known:
            return dest
    return None

for file in python_files:
    source = (root / file).read_text(encoding="utf8")
    try:
        tree = ast.parse(source, filename=file)
        parsed += 1
    except SyntaxError as exc:
        errors.append({"file": file, "line": exc.lineno, "error": str(exc)})
        continue
    package = file.removesuffix(".py").replace("/", ".").rsplit(".", 1)[0] if "/" in file else ""
    if file.endswith("/__init__.py"):
        package = file[:-12].replace("/", ".")
    for node in ast.walk(tree):
        line = getattr(node, "lineno", 0)
        if isinstance(node, ast.Import):
            for alias in node.names:
                dest = locate(alias.name)
                if dest and dest != file:
                    resolved.append({"from": file, "to": dest, "line": line, "kind": "import"})
        elif isinstance(node, ast.ImportFrom):
            base = package.split(".")
            if node.level:
                anchor = ".".join(base[:max(0, len(base) - node.level + 1)])
                module = ".".join(x for x in (anchor, node.module or "") if x)
            else:
                module = node.module or ""
            for full in [module] + [module + "." + a.name for a in node.names]:
                dest = locate(full)
                if dest and dest != file:
                    resolved.append({"from": file, "to": dest, "line": line, "kind": "from-import"})
        elif isinstance(node, ast.Call):
            fn = node.func
            name = fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else ""
            if name in {"import_module","__import__","eval","exec","getattr","run","Popen","check_output","check_call","glob","rglob","iterdir","open"}:
                value = node.args[0].value if node.args and isinstance(node.args[0], ast.Constant) else None
                if name in {"import_module","__import__"} and isinstance(value, str):
                    dest = locate(value)
                    if dest:
                        resolved.append({"from": file, "to": dest, "line": line, "kind": "dynamic-literal-import"})
                        continue
                expr = ast.get_source_segment(source, node) or name
                dynamic.append({"file": file, "line": line, "kind": name, "expr": expr[:260]})

result = {"sha": expected, "eligible": len(python_files), "parsed": parsed,
          "errors": errors, "resolved": resolved, "dynamic": dynamic, "files": python_files}
out.mkdir(parents=True, exist_ok=True)
(out / "orphan-r1b-python-ast.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
print("ORPHAN_R1B_PYTHON_AST", json.dumps({"sha": expected, "eligible":len(python_files), "parsed":parsed, "errors":len(errors), "resolved":len(resolved), "dynamic":len(dynamic)}))
if errors:
    sys.exit(1)
