from pathlib import Path

path = Path("site/validate.mjs")
source = path.read_text(encoding="utf-8")
old = 'includes(siteDeploy, "--local-config site/vercel.production.json", "Production deployment must use the dedicated production Vercel config.");'
new = '\n'.join([
    'includes(siteDeploy, "working-directory: site", "Vercel deployment must run from the site project root.");',
    'includes(siteDeploy, "--local-config vercel.production.json", "Production deployment must use the dedicated production Vercel config relative to the site project root.");',
    'excludes(siteDeploy, "--local-config site/vercel.production.json", "Production deployment must not address the Vercel config from the repository root.");',
])
if old not in source:
    raise SystemExit("Expected Vercel deployment validator line was not found")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
