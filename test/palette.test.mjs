import test from "node:test";
import assert from "node:assert/strict";
import { convertTheme, isHerdrLight, mergeTheme, opaque, originalPalette, paletteFileName, readJsonc } from "../scripts/palette.mjs";

test("JSONC preserves strings and accepts comments and trailing commas", () => {
  assert.deepEqual(readJsonc('{"url":"https://example.test",/* note */"x":1,}', "fixture"),
    { url: "https://example.test", x: 1 });
  assert.throws(() => readJsonc('{"x":}', "bad"), /bad:/);
  assert.throws(() => readJsonc('{"x":1} /* unclosed', "bad"), /unterminated/);
  assert.deepEqual(readJsonc('{"text":"a\\\\b\\\"//c", "list":[1, // hi\n],}', "escaped"),
    { text: 'a\\b"//c', list: [1] });
});

test("alpha colors composite on their actual surface and shorthand expands", () => {
  assert.equal(opaque("#ffffff80", "#000000"), "#808080");
  assert.equal(opaque("#abc"), "#aabbcc");
  assert.equal(opaque("white"), "#ffffff");
  assert.equal(opaque("#0000", "#123456"), "#123456");
  assert.throws(() => opaque("transparent", "#ffffff"), /Unsupported/);
});

test("included themes inherit colors and child token rules take precedence", () => {
  const theme = mergeTheme({
    colors: { "editor.background": "#123456", "terminal.ansiRed": "#ff0000" },
    tokenColors: [{ scope: "string", settings: { foreground: "#007700" } }],
  }, {
    colors: { "editor.background": "#101010" },
    tokenColors: [{ scope: "string", settings: { foreground: "#00bb00" } }],
  });
  const { palette, inferred } = convertTheme(theme, "vs-dark");
  assert.equal(palette.background, "#101010");
  assert.equal(palette.ansi[1], "#ff0000");
  assert.equal(palette.ansi[2], "#00bb00");
  assert(!inferred.includes("ansi1"));
  assert(inferred.includes("ansi2"));
});

test("terminal colors override editor colors; alpha selection uses terminal background", () => {
  const { palette } = convertTheme({ colors: {
    "editor.background": "#ffffff", "terminal.background": "#000000",
    "terminal.foreground": "#eeeeee", "terminal.selectionBackground": "#ffffff80",
    "list.hoverBackground": "#00000080", "sideBar.background": "#ffffff",
  } }, "vs-dark");
  assert.equal(palette.background, "#000000");
  assert.equal(palette.foreground, "#eeeeee");
  assert.equal(palette.selection, "#808080");
  assert.equal(palette.colors.hover, "#7f7f7f");
});

test("legacy global colors and high-contrast light appearance are preserved", () => {
  const { palette, light } = convertTheme({
    tokenColors: [{ settings: { background: "#ffffff", foreground: "#000000" } }],
  }, "hc-light");
  assert.equal(light, true);
  assert.equal(palette.background, "#ffffff");
  assert.equal(palette.foreground, "#000000");
  assert.notEqual(palette.selection, palette.background);
});

test("transparent selection receives a visible fallback", () => {
  const { palette, inferred } = convertTheme({
    colors: { "editor.background": "#111111", "terminal.selectionBackground": "#ffffff00" },
  }, "vs-dark");
  assert.notEqual(palette.selection, palette.background);
  assert(inferred.includes("selection"));
});

test("native appearance follows terminal background rather than source UI labels", () => {
  const { palette } = convertTheme({ colors: {
    "editor.background": "#ffffff", "terminal.background": "#012456",
  } }, "vs");
  assert.equal(isHerdrLight(palette.background), false);
  assert.equal(isHerdrLight("#f0f2f5"), true);
});

test("picker filenames use theme labels without collection branding", () => {
  assert.equal(paletteFileName("Bearded Theme Monokai Metallian"), "monokai-metallian.json");
  assert.equal(paletteFileName("Bearded-Bear Bearded-Theme Solarized"), "solarized.json");
  assert.equal(paletteFileName("Bearded Themanopia (Experimental)"), "themanopia-experimental.json");
  assert.equal(paletteFileName("GitHub Dark"), "github-dark.json");
});

test("independent originals cover both appearances and deliberate contrast variants", () => {
  const base = { hue: 18, accentHue: 172, rotation: 8 };
  const dark = originalPalette(base);
  const high = originalPalette({ ...base, contrast: true });
  const light = originalPalette({ ...base, light: true });
  assert.equal(dark.ansi.length, 16);
  assert.notEqual(dark.background, high.background);
  assert.notEqual(light.background, dark.background);
  assert.notEqual(high.colors.border, dark.colors.border);
});
