import { describe, it, expect } from "vitest";
import { parseLogLine, DEFAULT_CONFIG, type LogParserConfig } from "./log-parser";

describe("parseLogLine", () => {
  describe("JSON log lines", () => {
    it("detects error level from JSON with 'level' field", () => {
      const line = '{"level":"error","message":"something failed","timestamp":"2024-01-15T10:30:00Z"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
      expect(result.message).toBe("something failed");
      expect(result.timestamp).toBe("2024-01-15T10:30:00Z");
    });

    it("detects warn level from JSON with 'severity' field", () => {
      const line = '{"severity":"WARNING","msg":"disk usage high"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("warn");
      expect(result.message).toBe("disk usage high");
    });

    it("detects info level from JSON with 'log_level' field", () => {
      const line = '{"log_level":"info","message":"server started","time":"2024-01-15T10:30:00Z"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("info");
      expect(result.message).toBe("server started");
      expect(result.timestamp).toBe("2024-01-15T10:30:00Z");
    });

    it("uses 'msg' field when 'message' is absent", () => {
      const line = '{"level":"debug","msg":"processing request"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("debug");
      expect(result.message).toBe("processing request");
    });

    it("handles fatal mapping to error", () => {
      const line = '{"level":"fatal","message":"cannot connect to database"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
    });

    it("handles critical mapping to error", () => {
      const line = '{"level":"CRITICAL","message":"out of memory"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
    });

    it("extracts @timestamp field", () => {
      const line = '{"level":"info","message":"ok","@timestamp":"2024-01-15T10:30:00.123Z"}';
      const result = parseLogLine(line);
      expect(result.timestamp).toBe("2024-01-15T10:30:00.123Z");
    });

    it("extracts ts field", () => {
      const line = '{"level":"info","message":"ok","ts":"2024-01-15T10:30:00Z"}';
      const result = parseLogLine(line);
      expect(result.timestamp).toBe("2024-01-15T10:30:00Z");
    });

    it("returns unknown level for unrecognized level value", () => {
      const line = '{"level":"custom_level","message":"test"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("unknown");
    });

    it("returns raw line as message when message/msg fields absent", () => {
      const line = '{"level":"info","data":"some data"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("info");
      expect(result.message).toBe(line);
    });

    it("handles JSON with leading whitespace", () => {
      const line = '  {"level":"error","message":"bad"}';
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
      expect(result.message).toBe("bad");
    });
  });

  describe("plain text log lines", () => {
    it("detects ERROR in text", () => {
      const line = "2024-01-15T10:30:00Z ERROR Failed to connect to database";
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
      expect(result.timestamp).toBe("2024-01-15T10:30:00Z");
    });

    it("detects WARN in text", () => {
      const line = "[2024-01-15 10:30:00] WARN Connection pool low";
      const result = parseLogLine(line);
      expect(result.level).toBe("warn");
      expect(result.timestamp).toBe("2024-01-15T10:30:00");
    });

    it("detects WARNING in text", () => {
      const line = "WARNING: disk space low";
      const result = parseLogLine(line);
      expect(result.level).toBe("warn");
    });

    it("detects INFO in text", () => {
      const line = "INFO: Server started on port 8080";
      const result = parseLogLine(line);
      expect(result.level).toBe("info");
    });

    it("detects DEBUG in text", () => {
      const line = "[DEBUG] Processing request #123";
      const result = parseLogLine(line);
      expect(result.level).toBe("debug");
    });

    it("detects TRACE in text", () => {
      const line = "TRACE entering function foo()";
      const result = parseLogLine(line);
      expect(result.level).toBe("trace");
    });

    it("detects FATAL in text", () => {
      const line = "FATAL: unrecoverable error";
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
    });

    it("detects PANIC in text", () => {
      const line = "PANIC goroutine stack dump";
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
    });

    it("returns unknown for no level pattern", () => {
      const line = "just some output text";
      const result = parseLogLine(line);
      expect(result.level).toBe("unknown");
    });

    it("case-insensitive text detection", () => {
      const line = "error: something went wrong";
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
    });

    it("extracts ISO timestamp from text", () => {
      const line = "2024-01-15T10:30:00.123+05:30 INFO started";
      const result = parseLogLine(line);
      expect(result.timestamp).toBe("2024-01-15T10:30:00.123+05:30");
    });

    it("extracts bracket timestamp from text", () => {
      const line = "[10:30:00] INFO started";
      const result = parseLogLine(line);
      expect(result.timestamp).toBe("10:30:00");
    });

    it("extracts bracket timestamp with timezone offset", () => {
      const line = "[2026-02-15 10:08:59.711 +0000] ERROR (SIGO-LOGGER): Error occurred";
      const result = parseLogLine(line);
      expect(result.timestamp).toBe("2026-02-15T10:08:59.711+00:00");
      expect(result.level).toBe("error");
      // Verify it's parseable by Date
      expect(new Date(result.timestamp!).getTime()).not.toBeNaN();
    });

    it("extracts bracket timestamp with negative timezone offset", () => {
      const line = "[2026-02-15 10:08:59.711 -0500] WARN something";
      const result = parseLogLine(line);
      expect(result.timestamp).toBe("2026-02-15T10:08:59.711-05:00");
      expect(new Date(result.timestamp!).getTime()).not.toBeNaN();
    });

    it("extracts space-separated datetime without brackets", () => {
      const line = "2026-02-15 10:08:59.711 +0000 ERROR something failed";
      const result = parseLogLine(line);
      expect(result.timestamp).toBe("2026-02-15T10:08:59.711+00:00");
      expect(new Date(result.timestamp!).getTime()).not.toBeNaN();
    });
  });

  describe("ANSI-colored lines", () => {
    it("strips ANSI before parsing level", () => {
      const line = "\x1b[31mERROR\x1b[0m something failed";
      const result = parseLogLine(line);
      expect(result.level).toBe("error");
      expect(result.raw).toBe(line); // raw preserved
    });

    it("strips ANSI from JSON lines", () => {
      const line = '\x1b[0m{"level":"warn","message":"test"}\x1b[0m';
      const result = parseLogLine(line);
      expect(result.level).toBe("warn");
      expect(result.message).toBe("test");
    });
  });

  describe("custom config", () => {
    it("uses custom JSON level fields", () => {
      const config: LogParserConfig = {
        jsonLevelFields: ["priority"],
        levelMapping: { ...DEFAULT_CONFIG.levelMapping, high: "error" },
      };
      const line = '{"priority":"high","message":"alert"}';
      const result = parseLogLine(line, config);
      expect(result.level).toBe("error");
    });

    it("uses custom level mapping", () => {
      const config: LogParserConfig = {
        jsonLevelFields: DEFAULT_CONFIG.jsonLevelFields,
        levelMapping: { ...DEFAULT_CONFIG.levelMapping, severe: "error" },
      };
      const line = '{"level":"severe","message":"bad"}';
      const result = parseLogLine(line, config);
      expect(result.level).toBe("error");
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const result = parseLogLine("");
      expect(result.level).toBe("unknown");
      expect(result.message).toBe("");
    });

    it("handles malformed JSON", () => {
      const line = '{"level":"error",broken}';
      const result = parseLogLine(line);
      // Falls back to text detection
      expect(result.level).toBe("error");
    });

    it("handles JSON array (not object)", () => {
      const line = '["error","message"]';
      const result = parseLogLine(line);
      expect(result.level).toBe("error"); // text pattern match
    });

    it("preserves raw line", () => {
      const line = "2024-01-15T10:30:00Z ERROR test";
      const result = parseLogLine(line);
      expect(result.raw).toBe(line);
    });
  });
});
