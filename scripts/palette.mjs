export function readJsonc(text, name) {
  const chars = [...text.replace(/^\uFEFF/, "")];
  let string = false;
  let escaped = false;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (string) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') string = false;
      continue;
    }
    if (char === '"') string = true;
    else if (char === "/" && chars[i + 1] === "/") {
      while (i < chars.length && !/[\r\n]/.test(chars[i])) chars[i++] = " ";
      i--;
    } else if (char === "/" && chars[i + 1] === "*") {
      chars[i++] = " ";
      chars[i++] = " ";
      while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) {
        if (!/[\r\n]/.test(chars[i])) chars[i] = " ";
        i++;
      }
      if (i === chars.length) throw new Error(`${name}: unterminated comment`);
      chars[i++] = " ";
      chars[i] = " ";
    }
  }
  string = false;
  escaped = false;
  for (let i = 0; i < chars.length; i++) {
    if (string) {
      if (escaped) escaped = false;
      else if (chars[i] === "\\") escaped = true;
      else if (chars[i] === '"') string = false;
    } else if (chars[i] === '"') string = true;
    else if (chars[i] === ",") {
      let next = i + 1;
      while (next < chars.length && /\s/.test(chars[next])) next++;
      if (chars[next] === "}" || chars[next] === "]") chars[i] = " ";
    }
  }
  let value;
  try {
    value = JSON.parse(chars.join(""));
  } catch (error) {
    throw new Error(`${name}: ${error.message}`, { cause: error });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name}: expected an object`);
  }
  return value;
}

export function opaque(value, background) {
  if (value === "white") value = "#ffffff";
  if (value === "black") value = "#000000";
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    throw new Error(`Unsupported color: ${JSON.stringify(value)}`);
  }
  let hex = value.slice(1);
  if (hex.length <= 4) hex = [...hex].map((digit) => digit + digit).join("");
  const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16);
    if (alpha === 1) return channel;
    if (!/^#[\da-f]{6}$/i.test(background)) {
      throw new Error(`Translucent color ${value} requires an opaque background`);
    }
    return Math.round(channel * alpha +
      parseInt(background.slice(index + 1, index + 3), 16) * (1 - alpha));
  });
  return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

export function mix(a, b, weight) {
  const bytes = [0, 2, 4].map((index) =>
    Math.round(parseInt(a.slice(index + 1, index + 3), 16) * (1 - weight) +
      parseInt(b.slice(index + 1, index + 3), 16) * weight));
  return "#" + bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function slug(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function paletteFileName(label) {
  const name = label.replace(/^(?:bearded(?:[\s-]*bear)?(?:[\s-]+theme)?[\s-]+)+/i, "");
  return `${slug(name)}.json`;
}

export function paletteKey(palette) {
  return JSON.stringify([
    palette.background, palette.foreground, palette.selection, palette.cursor, palette.ansi,
    Object.keys(palette.colors).sort().map((key) => [key, palette.colors[key]]),
  ]);
}

export function isHerdrLight(background) {
  return [0, 2, 4].reduce((sum, index, channel) =>
    sum + parseInt(background.slice(index + 1, index + 3), 16) / 255 *
      [0.2126, 0.7152, 0.0722][channel], 0) > 0.5;
}

export function mergeTheme(base, child) {
  return {
    ...base, ...child,
    colors: { ...base.colors, ...child.colors },
    tokenColors: [...(base.tokenColors ?? []), ...(child.tokenColors ?? [])],
  };
}

const ansiNames = [
  "Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White",
  "BrightBlack", "BrightRed", "BrightGreen", "BrightYellow",
  "BrightBlue", "BrightMagenta", "BrightCyan", "BrightWhite",
];
const darkAnsi = [
  "#000000", "#cd3131", "#0dbc79", "#e5e510", "#2472c8", "#bc3fbc", "#11a8cd", "#e5e5e5",
  "#666666", "#f14c4c", "#23d18b", "#f5f543", "#3b8eea", "#d670d6", "#29b8db", "#ffffff",
];
const lightAnsi = [
  "#000000", "#cd3131", "#00bc00", "#949800", "#0451a5", "#bc05bc", "#0598bc", "#555555",
  "#666666", "#cd3131", "#14ce14", "#b5ba00", "#0451a5", "#bc05bc", "#0598bc", "#a5a5a5",
];

export function convertTheme(theme, uiTheme) {
  if (!["vs", "vs-dark", "hc-light", "hc-black"].includes(uiTheme)) {
    throw new Error(`Unsupported appearance: ${uiTheme}`);
  }
  const light = ["vs", "hc-light"].includes(uiTheme);
  const defaults = light ? lightAnsi : darkAnsi;
  const colors = theme.colors ?? {};
  const inferred = new Set();
  const global = (theme.tokenColors ?? []).filter((entry) => !entry.scope)
    .reduce((settings, entry) => ({ ...settings, ...entry.settings }), {});
  const rawBackground = colors["editor.background"] ?? global.background;
  const editorBackground = opaque(rawBackground ?? (light ? "#ffffff" : "#1e1e1e"));
  if (!rawBackground) inferred.add("editor.background");
  const pick = (keys, fallback, background, outputName) => {
    for (const key of keys) {
      if (colors[key] != null) return opaque(colors[key], background);
    }
    inferred.add(outputName);
    return opaque(fallback, background);
  };
  const background = pick(["terminal.background"], editorBackground,
    editorBackground, "background");
  const editorForeground = colors["editor.foreground"] ?? global.foreground ??
    (light ? "#333333" : "#d4d4d4");
  const foreground = pick(["terminal.foreground"], editorForeground,
    background, "foreground");
  const panelForeground = opaque(colors.foreground ?? editorForeground, editorBackground);
  const surface = pick(["sideBar.background"], mix(editorBackground, panelForeground, 0.035),
    editorBackground, "surface");
  const canvas = editorBackground;
  const chrome = pick(["activityBar.background", "sideBar.background"],
    surface, surface, "chrome");
  const popover = pick(["editorWidget.background", "menu.background"],
    mix(canvas, panelForeground, 0.06), canvas, "popover");
  const raised = pick(["quickInput.background", "dropdown.background"],
    popover, surface, "raised");
  const selection = pick(["terminal.selectionBackground", "editor.selectionBackground"],
    mix(background, foreground, light ? 0.16 : 0.22), background, "selection");
  const accent = pick(["button.background", "activityBarBadge.background",
    "textLink.foreground", "focusBorder"], light ? "#0067b8" : "#3794ff",
    surface, "accent");
  const tokenForeground = (scopes) => {
    for (const wanted of scopes) {
      for (const entry of [...(theme.tokenColors ?? [])].reverse()) {
        const selectors = Array.isArray(entry.scope) ? entry.scope :
          typeof entry.scope === "string" ? entry.scope.split(",").map((part) => part.trim()) : [];
        if (selectors.includes(wanted) && entry.settings?.foreground &&
            entry.settings.foreground !== "inherit") {
          return entry.settings.foreground;
        }
      }
    }
    return undefined;
  };
  const semanticFallbacks = [
    background,
    colors["errorForeground"] ?? colors["editorError.foreground"],
    colors["gitDecoration.addedResourceForeground"] ?? tokenForeground(["string"]),
    colors["editorWarning.foreground"] ?? tokenForeground(["constant.numeric", "constant"]),
    colors["textLink.foreground"] ?? tokenForeground(["entity.name.function", "support.function"]),
    tokenForeground(["keyword", "storage.type", "storage"]),
    tokenForeground(["support.type", "entity.name.type", "constant.language"]),
    foreground,
    tokenForeground(["comment"]),
  ];
  const ansi = ansiNames.map((name, index) => {
    const key = `terminal.ansi${name}`;
    if (colors[key] != null) return opaque(colors[key], background);
    inferred.add(`ansi${index}`);
    const fallback = semanticFallbacks[index] ??
      (index >= 9 ? semanticFallbacks[index - 8] : undefined);
    return opaque(fallback ?? defaults[index], background);
  });
  const dim = pick(["disabledForeground", "editorLineNumber.foreground"],
    mix(surface, panelForeground, 0.55), surface, "dim");
  const ink = (fill) => {
    const luminance = [0, 2, 4].map((index) => {
      const channel = parseInt(fill.slice(index + 1, index + 3), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    return luminance > 0.179 ? "#000000" : "#ffffff";
  };
  const palette = {
    background, foreground, selection,
    cursor: pick(["terminalCursor.foreground", "editorCursor.foreground"],
      foreground, background, "cursor"),
    ansi,
    colors: {
      background, foreground: panelForeground, selection,
      canvas, chrome, surface, popover, raised,
      hover: pick(["list.hoverBackground"], mix(surface, panelForeground, 0.08), surface, "hover"),
      selected: pick(["list.activeSelectionBackground"], selection, surface, "selected"),
      border: pick(["panel.border", "editorGroup.border", "contrastBorder"],
        mix(surface, panelForeground, 0.15), surface, "border"),
      input: pick(["input.border", "dropdown.border", "editorWidget.border"],
        mix(surface, panelForeground, 0.25), surface, "input"),
      muted: pick(["descriptionForeground"], mix(surface, panelForeground, 0.75), surface, "muted"),
      dim, accent,
      accent_foreground: pick(["button.foreground"], ink(accent), accent, "accent_foreground"),
      solid: accent,
      solid_foreground: pick(["button.foreground"], ink(accent), accent, "solid_foreground"),
      working: ansi[4], blocked: ansi[3], done: ansi[2], idle: dim, unknown: ansi[5],
    },
  };
  if (palette.selection === background) {
    palette.selection = mix(background, foreground, 0.22);
    palette.colors.selection = palette.selection;
    inferred.add("selection");
  }
  return { palette, light, inferred: [...inferred].sort() };
}

function hsl(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs(sector % 2 - 1));
  const channels = [
    [chroma, x, 0], [x, chroma, 0], [0, chroma, x],
    [0, x, chroma], [x, 0, chroma], [chroma, 0, x],
  ][Math.floor(sector)];
  const offset = lightness - chroma / 2;
  return "#" + channels.map((channel) =>
    Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("");
}

export function originalPalette(profile) {
  const { hue, accentHue, light = false, contrast = false } = profile;
  const background = hsl(hue, 0.18, light ? 0.96 : contrast ? 0.055 : 0.115);
  const foreground = hsl(hue + 15, 0.15, light ? 0.19 : 0.89);
  const selection = hsl(accentHue, 0.3, light ? 0.83 : 0.29);
  const accent = hsl(accentHue, 0.67, light ? 0.36 : 0.69);
  const chromatic = [5, 135, 47, 215, 287, 177].map((base) =>
    hsl(base + profile.rotation, 0.55, light ? 0.35 : 0.7));
  const ansi = [
    light ? hsl(hue, 0.15, 0.16) : background, ...chromatic,
    light ? hsl(hue, 0.1, 0.48) : foreground,
    hsl(hue, 0.12, light ? 0.43 : 0.5),
    ...[5, 135, 47, 215, 287, 177].map((base) =>
      hsl(base + profile.rotation, 0.65, light ? 0.3 : 0.79)),
    hsl(hue, 0.12, 0.97),
  ];
  const surface = hsl(hue, 0.18, light ? 0.92 : contrast ? 0.09 : 0.15);
  const raised = hsl(hue, 0.17, light ? 0.87 : 0.2);
  const dim = hsl(hue, 0.12, light ? 0.44 : 0.57);
  return {
    background, foreground, selection, cursor: accent, ansi,
    colors: {
      background, foreground, selection,
      canvas: background, chrome: surface, surface, popover: surface, raised,
      hover: raised, selected: selection,
      border: hsl(hue, 0.16, light ? contrast ? 0.38 : 0.72 : contrast ? 0.6 : 0.3),
      input: hsl(hue, 0.16, light ? 0.58 : 0.45),
      muted: hsl(hue, 0.12, light ? 0.35 : 0.72), dim, accent,
      accent_foreground: light ? "#ffffff" : "#101010",
      solid: accent, solid_foreground: light ? "#ffffff" : "#101010",
      working: ansi[4], blocked: ansi[3], done: ansi[2], idle: dim, unknown: ansi[5],
    },
  };
}
