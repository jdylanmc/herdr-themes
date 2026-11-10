import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { convertTheme, isHerdrLight, mergeTheme, originalPalette, readJsonc } from "./palette.mjs";

const root = path.resolve(import.meta.dirname, "..");
const snapshot = JSON.parse(await readFile(path.join(root, "sources/vscode-top-20.json"), "utf8"));
const originals = JSON.parse(await readFile(path.join(root, "sources/originals.json"), "utf8"));
const catalog = [];
const names = new Set();
for (const entry of snapshot.entries) {
  const restricted = entry.license.startsWith("restricted:");
  if (!restricted) {
    for (const source of entry.sources) {
      const data = await readFile(path.join(root, source.file));
      if (createHash("sha256").update(data).digest("hex") !== source.sha256) {
        throw new Error(`Source changed: ${source.file}`);
      }
    }
  }
  for (const [index, variant] of entry.variants.entries()) {
    const load = async (relative, ancestry = new Set()) => {
      if (path.posix.isAbsolute(relative) || relative.startsWith("../") || relative === "..") {
        throw new Error(`Unsafe include: ${relative}`);
      }
      if (ancestry.has(relative)) throw new Error(`Circular include: ${relative}`);
      const next = new Set([...ancestry, relative]);
      const file = path.join(root, entry.sourceDir, relative);
      const theme = readJsonc(await readFile(file, "utf8"), file);
      if (!theme.include) return theme;
      const inherited = path.posix.normalize(path.posix.join(path.posix.dirname(relative), theme.include));
      return mergeTheme(await load(inherited, next), theme);
    };
    const record = {
      rank: entry.rank, extension: entry.id, version: entry.version,
      sourceLabel: variant.label, appearance: ["vs", "hc-light"].includes(variant.uiTheme) ? "light" : "dark",
      sourceUiTheme: variant.uiTheme,
      license: restricted ? "MIT" : entry.license,
    };
    let palette;
    if (restricted) {
      const profile = originals[entry.id]?.[index];
      if (!profile || Boolean(profile.light) !== (record.appearance === "light")) {
        throw new Error(`Missing or mismatched original profile: ${entry.id}/${index}`);
      }
      record.file = `${profile.name}.json`;
      record.kind = "independent original; not a port";
      palette = originalPalette(profile);
    } else {
      const result = convertTheme(await load(variant.path), variant.uiTheme);
      record.file = variant.file;
      record.kind = "port";
      record.inferred = result.inferred;
      record.source = `${entry.sourceDir}/${variant.path}`;
      palette = result.palette;
      if (entry.license === "GPL-3.0-only") {
        record.notice = `themes/${record.file}.license`;
        await writeFile(path.join(root, record.notice),
          `SPDX-License-Identifier: GPL-3.0-only\n\n` +
          `Modified ${snapshot.capturedAt.slice(0, 10)}: ${record.file} was converted from ` +
          `Bearded Theme ${entry.version} to Herdr colors.\n` +
          `Original source: ${record.source}\n` +
          `Complete corresponding source: ${entry.correspondingSource.archive}\n` +
          `Original license and notices: ${entry.licenses.join(", ")}\n`);
      }
    }
    const nativeAppearance = isHerdrLight(palette.background) ? "light" : "dark";
    if (nativeAppearance !== record.appearance) {
      record.appearanceNote = "Herdr classifies by terminal background; the source UI appearance label differs.";
      record.appearance = nativeAppearance;
    }
    if (names.has(record.file)) throw new Error(`Duplicate output name: ${record.file}`);
    names.add(record.file);
    await writeFile(path.join(root, "themes", record.file), JSON.stringify(palette, null, 2) + "\n");
    catalog.push(record);
  }
}
await mkdir(path.join(root, "catalog"), { recursive: true });
await writeFile(path.join(root, "catalog/vscode-top-20.json"), JSON.stringify({
  rankingUrl: snapshot.rankingUrl, capturedAt: snapshot.capturedAt,
  description: "All variants of the first 20 extension listings, in site order; restricted entries have independent original replacements.",
  palettes: catalog,
}, null, 2) + "\n");
const lines = [
  "# VS Code Themes: top 20 by install count",
  "",
  `Source order: ${snapshot.rankingUrl}, captured ${snapshot.capturedAt}.`,
  "The rank is the site's extension-listing order, not an ordering of individual variants.",
  "All dark, light and high-contrast contributions in each frozen package are included.",
  "",
  `${catalog.length} palettes: ${catalog.filter((entry) => entry.kind === "port").length} licensed ports and ` +
    `${catalog.filter((entry) => entry.kind !== "port").length} independent original replacements.`,
  "Font/italic variants keep separate names even when they have identical color palettes.",
  "The five pre-existing themes remain unchanged and are not part of this count.",
  "",
  "| Rank | Listing | Version | Variants | Treatment |",
  "| --- | --- | --- | --- | --- |",
];
for (const entry of snapshot.entries) {
  lines.push(`| ${entry.rank} | ${entry.name} (\`${entry.id}\`) | ${entry.version} | ` +
    `${entry.variants.length} | ${entry.license} |`);
}
lines.push("", "## Files", "",
  "All links below point to installable palette JSON, not editor extensions.",
  "Replacement labels identify which requested slot they cover, not a visual equivalence.",
  "");
for (const entry of snapshot.entries) {
  lines.push(`### ${entry.rank}. ${entry.name}`, "");
  for (const palette of catalog.filter((item) => item.extension === entry.id)) {
    lines.push(`- ${palette.sourceLabel}: [\`${palette.file}\`](../themes/${palette.file}) ` +
      `(${palette.appearance}${palette.kind === "port" ? "" : "; independent original"}` +
      `${palette.appearanceNote ? "; terminal background differs from source UI appearance" : ""})`);
  }
  lines.push("");
}
lines.push("## Sources and redistribution", "",
  "The frozen source manifest records package URLs, versions, package SHA-256 checksums,",
  "per-file source checksums, original paths and preserved license paths.",
  "The generated machine-readable catalog records each port's license and inferred mappings.",
  "Original profiles are authored independently in sources/originals.json; the two restricted",
  "packages' palette source files were not extracted or used to generate them.",
  "",
  "Bearded Theme ports remain GPL-3.0-only. Their original theme JSON files are under",
  "sources/vscode/BeardedBear.beardedtheme/ and the complete unmodified upstream source",
  "archive for the v10.1.0 release merge is under sources/upstream/. The converter in scripts/ is included",
  "so the Herdr mapping can also be rebuilt. Licenses and notices are under licenses/vscode/.",
  "Each modified GPL palette has an adjacent .json.license notice; these are not theme JSON",
  "and are not loaded by Herdr.",
  "Herdr's light/dark classification follows terminal background brightness, not the VS Code",
  "uiTheme label. The catalog preserves both and explicitly notes disagreements, including",
  "PowerShell ISE's dark-blue terminal within a light editor and several Bearded light variants.",
  "The upstream manifest misspells the case of Themanopia's filename; the source manifest",
  "explicitly records the corrected packaged filename.",
  "");
await writeFile(path.join(root, "catalog/README.md"), lines.join("\n"));
console.log(`Generated ${catalog.length} palettes from ${snapshot.entries.length} ranked listings`);
