import json
import hashlib
import re
from pathlib import Path


root = Path(__file__).resolve().parents[1]
expected = {
    "son-of-obsidian",
    "tokyo-night",
    "nord",
    "nebula-dark",
    "nebula-light",
}
catalog = json.loads((root / "catalog/vscode-top-20.json").read_text())
snapshot = json.loads((root / "sources/vscode-top-20.json").read_text())
assert len(snapshot["entries"]) == 20, "Expected 20 ranked listings"
assert [entry["rank"] for entry in snapshot["entries"]] == list(range(1, 21))
assert len(catalog["palettes"]) + len(catalog["omitted"]) == sum(
    len(entry["variants"]) for entry in snapshot["entries"]
), "Missing contributed variants"
generated = [Path(palette["file"]).stem for palette in catalog["palettes"]]
assert len(generated) == len(set(generated)), "Duplicate palette names"
expected.update(generated)
for entry in snapshot["entries"]:
    assert sum(
        palette["extension"] == entry["id"] for palette in catalog["palettes"]
    ) + sum(
        omitted["extension"] == entry["id"] for omitted in catalog["omitted"]
    ) == len(entry["variants"]), f"Missing variants for {entry['id']}"
    if "sourceDir" in entry:
        assert all((root / file).is_file() for file in entry["licenses"])
    if "correspondingSource" in entry:
        source = entry["correspondingSource"]
        assert hashlib.sha256((root / source["archive"]).read_bytes()).hexdigest() == source["sha256"]
files = sorted((root / "themes").glob("*.json"))
assert {path.stem for path in files} == expected, "Unexpected theme files"
gpl_files = {
    palette["file"] for palette in catalog["palettes"]
    if palette["license"] == "GPL-3.0-only"
}

for path in files:
    theme = json.loads(path.read_text())
    assert set(theme) == {
        "background", "foreground", "selection", "cursor", "ansi", "colors"
    }, f"{path.name}: unexpected or missing fields"
    assert len(theme["ansi"]) == 16, f"{path.name}: expected 16 ANSI colors"
    colors = [
        theme["background"], theme["foreground"], theme["selection"],
        theme["cursor"], *theme["ansi"], *theme["colors"].values(),
    ]
    assert all(
        isinstance(color, str) and re.fullmatch(r"#[0-9a-f]{6}", color)
        for color in colors
    ), f"{path.name}: invalid color"
    assert theme["foreground"] != theme["background"], path.name
    assert theme["selection"] != theme["background"], path.name
    if path.name in gpl_files:
        assert "GPL-3.0-only" in Path(str(path) + ".license").read_text(), path.name
print(f"OK: {len(files)} palettes; complete coverage of all 20 ranked listings")
