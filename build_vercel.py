from pathlib import Path
import gzip, shutil, subprocess, sys

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

# Restore the production CSS/JS and the 3D asset generator already versioned in payload/.
for src, dst in [
    ("payload/styles.css.gz", "styles.css"),
    ("payload/main.js.gz", "main.js"),
    ("payload/generate_assets.py.gz", "generate_assets_vercel.py"),
]:
    data = gzip.decompress((ROOT / src).read_bytes())
    (ROOT / dst).write_bytes(data)

# The original generator was authored in the local artifact workspace. Make it portable.
gen = ROOT / "generate_assets_vercel.py"
text = gen.read_text(encoding="utf-8")
text = text.replace("ROOT=Path('/mnt/data/rank-zero-web-v2')", "ROOT=Path(__file__).resolve().parent")
gen.write_text(text, encoding="utf-8")

subprocess.run([sys.executable, str(gen)], cwd=ROOT, check=True)

# Mobile/web preview: keep the real meshes, but ship 512px PBR maps instead of 1024px.
from PIL import Image
for p in (ROOT / "assets" / "textures").glob("*.png"):
    im = Image.open(p)
    if max(im.size) > 512:
        im = im.resize((512, 512), Image.Resampling.LANCZOS)
        im.save(p, optimize=True)

# Publish only the RANK ZERO site, isolating it from legacy files in this repository.
for name in ("index.html", "styles.css", "main.js"):
    shutil.copy2(ROOT / name, PUBLIC / name)
asset_dst = PUBLIC / "assets"
if asset_dst.exists():
    shutil.rmtree(asset_dst)
shutil.copytree(ROOT / "assets", asset_dst)

print("RANK ZERO web build ready:", PUBLIC)
