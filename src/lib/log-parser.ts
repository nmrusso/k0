import { stripAnsi } from "./ansi";

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace" | "unknown";

export interface ParsedLogLine {
  raw: string;
  level: LogLevel;
  timestamp?: string;
  message: string;
}

export interface LogParserConfig {
  /** JSON field names to check for log level (in priority order) */
  jsonLevelFields: string[];
  /** Map of raw level strings to normalized LogLevel */
  levelMapping: Record<string, LogLevel>;
}

export const DEFAULT_CONFIG: LogParserConfig = {
  jsonLevelFields: ["level", "severity", "log_level", "loglevel", "levelname"],
  levelMapping: {
    // error variants
    error: "error",
    err: "error",
    fatal: "error",
    critical: "error",
    panic: "error",
    alert: "error",
    emerg: "error",
    emergency: "error",
    // warn variants
    warn: "warn",
    warning: "warn",
    // info variants
    info: "info",
    information: "info",
    notice: "info",
    // debug variants
    debug: "debug",
    // trace variants
    trace: "trace",
    verbose: "trace",
  },
};

const TEXT_LEVEL_PATTERNS: [RegExp, LogLevel][] = [
  [/\b(ERROR|ERR|FATAL|CRITICAL|PANIC|ALERT|EMERG|EMERGENCY)\b/i, "error"],
  [/\b(WARN|WARNING)\b/i, "warn"],
  [/\b(INFO|INFORMATION|NOTICE)\b/i, "info"],
  [/\b(DEBUG)\b/i, "debug"],
  [/\b(TRACE|VERBOSE)\b/i, "trace"],
];

// ISO 8601: 2024-01-15T10:30:00Z or 2024-01-15T10:30:00.123+00:00
const ISO_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/;
// Bracket-wrapped: [2024-01-15 10:30:00] or [2024-01-15 10:30:00.123 +0000] or [10:30:00]
const BRACKET_TIMESTAMP_RE = /\[(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\s*[+-]\d{4})?|\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/;
// Standalone date-space-time: 2024-01-15 10:30:00 (no T separator, not inside brackets)
const DATETIME_SPACE_RE = /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\s*[+-]\d{4})?/;

/** Normalize a timestamp string so it can be parsed by `new Date()`. */
function normalizeTimestamp(raw: string): string {
  // "2024-01-15 10:30:00.123 +0000" → "2024-01-15T10:30:00.123+00:00"
  let ts = raw.trim();
  // Replace first space between date and time with T
  ts = ts.replace(/^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})/, "$1T$2");
  // Normalize timezone: " +0000" → "+00:00"
  ts = ts.replace(/\s*([+-])(\d{2})(\d{2})$/, "$1$2:$3");
  return ts;
}

function extractTimestamp(text: string): string | undefined {
  const isoMatch = text.match(ISO_TIMESTAMP_RE);
  if (isoMatch) return isoMatch[0];
  const bracketMatch = text.match(BRACKET_TIMESTAMP_RE);
  if (bracketMatch) return normalizeTimestamp(bracketMatch[1]);
  const spaceMatch = text.match(DATETIME_SPACE_RE);
  if (spaceMatch) return normalizeTimestamp(spaceMatch[0]);
  return undefined;
}

function normalizeLevelString(raw: string, mapping: Record<string, LogLevel>): LogLevel {
  const lower = raw.toLowerCase();
  return mapping[lower] ?? "unknown";
}

function tryParseJson(
  text: string,
  config: LogParserConfig,
): { level: LogLevel; message: string; timestamp?: string } | null {
  // Quick check: must start with { to even try
  const trimmed = text.trimStart();
  if (trimmed[0] !== "{") return null;

  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;

    // Extract level
    let level: LogLevel = "unknown";
    for (const field of config.jsonLevelFields) {
      const val = obj[field];
      if (typeof val === "string" && val.length > 0) {
        level = normalizeLevelString(val, config.levelMapping);
        if (level !== "unknown") break;
      }
    }

    // Extract message
    const message =
      typeof obj.message === "string"
        ? obj.message
        : typeof obj.msg === "string"
          ? obj.msg
          : text;

    // Extract timestamp
    const timestamp =
      typeof obj.timestamp === "string"
        ? obj.timestamp
        : typeof obj.time === "string"
          ? obj.time
          : typeof obj.ts === "string"
            ? obj.ts
            : typeof obj["@timestamp"] === "string"
              ? obj["@timestamp"]
              : undefined;

    return { level, message, timestamp };
  } catch {
    return null;
  }
}

function detectTextLevel(text: string, config: LogParserConfig): LogLevel {
  for (const [pattern, defaultLevel] of TEXT_LEVEL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Try mapping first, fall back to default
      const mapped = normalizeLevelString(match[1], config.levelMapping);
      return mapped !== "unknown" ? mapped : defaultLevel;
    }
  }
  return "unknown";
}

export function parseLogLine(line: string, config: LogParserConfig = DEFAULT_CONFIG): ParsedLogLine {
  const plain = stripAnsi(line);

  // Try JSON first
  const jsonResult = tryParseJson(plain, config);
  if (jsonResult) {
    return {
      raw: line,
      level: jsonResult.level,
      timestamp: jsonResult.timestamp ?? extractTimestamp(plain),
      message: jsonResult.message,
    };
  }

  // Fallback: text pattern detection
  const level = detectTextLevel(plain, config);
  const timestamp = extractTimestamp(plain);

  return {
    raw: line,
    level,
    timestamp,
    message: plain,
  };
}

export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  error: "border-red-500",
  warn: "border-yellow-500",
  info: "border-blue-500",
  debug: "border-gray-500",
  trace: "border-gray-600",
  unknown: "border-transparent",
};

export const LOG_LEVEL_TEXT_COLORS: Record<LogLevel, string> = {
  error: "text-red-400",
  warn: "text-yellow-400",
  info: "text-blue-400",
  debug: "text-gray-400",
  trace: "text-gray-500",
  unknown: "text-muted-foreground",
};

export const ALL_LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "debug", "trace", "unknown"];
