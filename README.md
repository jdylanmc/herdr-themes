# Herdr Themes

Five palette-only themes for the native [Herdr app](https://herdr.dev):

| Theme | Appearance | Style |
| --- | --- | --- |
| `son-of-obsidian` | Dark | Charcoal, green, orange and gold |
| `tokyo-night` | Dark | Original Tokyo Night, blue and violet |
| `nord` | Dark | Arctic blue-grey and muted pastels |
| `nebula-dark` | Dark | Blue-black, cyan and violet |
| `nebula-light` | Light | Warm paper, turmeric and earthy accents |

These are community ports, not official upstream distributions.
They change terminal palettes and semantic panel colors only.
No mods, scripts, fonts, key bindings or layouts are installed.
No network access or running code is required by the themes.

![Palette swatches, not an app screenshot](preview.png)

## Install

Ask your agent:

> Read ~/.config/herdr-app/AGENTS.md, then add the palette-only themes from
> github.com/jdylanmc/herdr-themes. Copy themes/*.json into the Herdr themes
> directory without overwriting existing files. Keep my current theme and layout.

Or copy the desired JSON files from `themes/` to
`~/.config/herdr-app/themes/`. Herdr discovers them live.
Choose a palette in the theme picker when ready.

For automatic Nebula appearance switching, set your layout root's `theme`:

```json
{ "theme": { "light": "nebula-light", "dark": "nebula-dark" } }
```

Settings can provide the same mapping where the layout does not set a theme.
Installing files alone does not activate them.
Remove the added files to uninstall, after selecting another theme.

## Palette adaptations

Son of Obsidian maps editor syntax colors to the terminal's 16 ANSI slots;
its original editor theme does not define an ANSI palette.
Tokyo Night preserves the upstream Night terminal palette.
Nord uses its canonical colors, with Nord 2 for readable selection highlighting.
Nebula maps Obsidian surfaces, text, syntax and callout colors to Herdr tokens
and ANSI slots. Its warm light palette intentionally uses earthy hues rather
than inventing blue and cyan colors absent from the source.
Nebula's translucent selections and hover fills are composited onto its
primary background to produce opaque Herdr colors.
These ports do not change fonts or add syntax highlighting to terminal programs.

## Sources and licenses

| Theme | Source revision | License |
| --- | --- | --- |
| Son of Obsidian | [Rob Prouse's VS Code port](https://github.com/rprouse/theme-obsidian/blob/d76b1c3c16435ecc4d4bd5cab2e9430a3aa23a53/themes/son-of-obsidian-color-theme.json) | MIT |
| Tokyo Night | [folke/tokyonight.nvim Night](https://github.com/folke/tokyonight.nvim/blob/cdc07ac78467a233fd62c493de29a17e0cf2b2b6/extras/ghostty/tokyonight_night) | Apache-2.0 |
| Nord | [nordtheme/nord](https://github.com/nordtheme/nord/blob/1cef71605416a222e57225b544540ce0fcec18d4/src/nord.css) | MIT |
| Nebula | [Devaang Mandalia's Obsidian theme](https://github.com/devmandalia/Nebula/blob/8f28486f4b1bd60cdd7e5b82002df8cc2c0b5480/theme.css) | MIT |

Upstream license texts are preserved in `licenses/`.
Tokyo Night's JSON file is a modified format conversion of its upstream
terminal palette with additional Herdr panel and status color mappings.
All other JSON files are adaptations with the mappings described above.

## Validate

Run `python3 scripts/check.py` to validate all palettes.
