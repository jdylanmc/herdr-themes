import json
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
files = sorted((root / "themes").glob("*.json"))
assert {path.stem for path in files} == expected, "Unexpected theme files"

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
    print(f"OK {path.name}")
