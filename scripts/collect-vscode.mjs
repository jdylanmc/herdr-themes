import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readJsonc, slug } from "./palette.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cache = process.argv[2];
if (!cache) throw new Error("Usage: node scripts/collect-vscode.mjs <captured-source-directory>");
const snapshot = JSON.parse(await readFile(path.join(cache, "snapshot.json"), "utf8"));
const restricted = new Set(["Equinusocio.vsc-material-theme", "monokai.theme-monokai-pro-vscode"]);
const approved = new Set([
  "ms-vscode.cpptools-themes", "ms-vscode.PowerShell", "GitHub.github-vscode-theme",
  "zhuangtongfa.Material-theme", "dracula-theme.theme-dracula", "akamud.vscode-theme-onedark",
  "teabyii.ayu", "johnpapa.winteriscoming", "sdras.night-owl", "enkia.tokyo-night",
  "azemoh.one-monokai", "whizkydee.material-palenight-theme", "RobbOwen.synthwave-vscode",
  "ahmadawais.shades-of-purple", "wesbos.theme-cobalt2", "EliverLara.andromeda",
  "tal7aouy.theme", "BeardedBear.beardedtheme",
]);
for (const entry of snapshot.entries) {
  if (!approved.has(entry.id) && !restricted.has(entry.id)) {
    throw new Error(`License review required: ${entry.id}`);
  }
  const bytes = await readFile(path.join(cache, `${entry.id}.vsix`));
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
    throw new Error(`Checksum mismatch: ${entry.id}`);
  }
  const files = JSON.parse(execFileSync("python3", [
    path.join(root, "scripts/read-vsix.py"), path.join(cache, `${entry.id}.vsix`),
    restricted.has(entry.id) ? "metadata-only" : "sources",
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  const manifest = readJsonc(files["extension/package.json"], entry.id);
  entry.repository = typeof manifest.repository === "string" ?
    manifest.repository : manifest.repository?.url ?? null;
  entry.license = restricted.has(entry.id) ? "restricted: original replacements" :
    entry.id === "BeardedBear.beardedtheme" ? "GPL-3.0-only" : "MIT";
  if (entry.id === "BeardedBear.beardedtheme") {
    entry.correspondingSource = {
      revision: "65734e8f2e36fb825e3c6ecaf900777bc1322f73",
      url: "https://github.com/BeardedBear/bearded-theme/tree/65734e8f2e36fb825e3c6ecaf900777bc1322f73",
      archive: "sources/upstream/bearded-theme-v10.1.0.tar.gz",
      sha256: createHash("sha256").update(await readFile(path.join(root,
        "sources/upstream/bearded-theme-v10.1.0.tar.gz"))).digest("hex"),
    };
  }
  entry.variants = manifest.contributes.themes.map((theme) => ({
    label: theme.label ?? theme.id, uiTheme: theme.uiTheme,
    path: path.posix.normalize(theme.path),
    file: `${slug(entry.id.split(".")[0]).replace(/-vscode$/, "")}-${slug(theme.label ?? theme.id)}.json`,
  }));
  if (restricted.has(entry.id)) {
    console.log(`${entry.id}: metadata only; no theme colors extracted`);
    continue;
  }
  const sourceDir = `sources/vscode/${entry.id}`;
  entry.sourceDir = sourceDir;
  for (const variant of entry.variants) {
    if (files[`extension/${variant.path}`] != null) continue;
    const matches = Object.keys(files).filter((file) =>
      file.toLowerCase() === `extension/${variant.path}`.toLowerCase());
    if (matches.length !== 1) throw new Error(`${entry.id}: missing or ambiguous ${variant.path}`);
    variant.declaredPath = variant.path;
    variant.path = matches[0].slice("extension/".length);
    console.log(`${entry.id}: corrected packaged filename case: ${variant.path}`);
  }
  const visited = new Set();
  const copyTheme = async (relative) => {
    if (path.posix.isAbsolute(relative) || relative === ".." || relative.startsWith("../")) {
      throw new Error(`Unsafe source path: ${relative}`);
    }
    if (visited.has(relative)) return;
    visited.add(relative);
    const bytes = files[`extension/${relative}`];
    if (!bytes) throw new Error(`${entry.id}: missing ${relative}`);
    const theme = readJsonc(bytes, `${entry.id}/${relative}`);
    const destination = path.join(root, sourceDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    if (theme.include) await copyTheme(path.posix.normalize(
      path.posix.join(path.posix.dirname(relative), theme.include)));
  };
  for (const variant of entry.variants) await copyTheme(variant.path);
  entry.licenses = [];
  for (const [name, content] of Object.entries(files)) {
    if (/^extension\/(?:license|notice)[^/]*$/i.test(name)) {
      const file = `licenses/vscode/${entry.id}/${path.posix.basename(name)}`;
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), content);
      entry.licenses.push(file);
    }
  }
  if (!entry.licenses.some((name) => /license/i.test(name))) {
    throw new Error(`No redistribution license retained: ${entry.id}`);
  }
  entry.sources = [];
  for (const file of [...visited].sort()) {
    entry.sources.push({
      file: `${sourceDir}/${file}`,
      sha256: createHash("sha256").update(files[`extension/${file}`]).digest("hex"),
    });
  }
  console.log(`${entry.id}: ${entry.variants.length} variants; ${entry.license}`);
}
await mkdir(path.join(root, "sources"), { recursive: true });
await writeFile(path.join(root, "sources/vscode-top-20.json"), JSON.stringify(snapshot, null, 2) + "\n");
