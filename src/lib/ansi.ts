import Convert from "ansi-to-html";

const converter = new Convert({
  fg: "#d4d4d4",
  bg: "transparent",
  newline: false,
  escapeXML: true,
});

/** Convert ANSI escape codes to HTML spans with inline color styles. */
export function parseAnsi(text: string): string {
  return converter.toHtml(text);
}

/** Strip all ANSI escape codes, returning plain text for search matching. */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
