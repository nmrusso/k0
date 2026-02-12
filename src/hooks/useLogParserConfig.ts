import { useState, useEffect } from "react";
import { getConfig } from "@/lib/tauri-commands";
import { DEFAULT_CONFIG, type LogParserConfig } from "@/lib/log-parser";

export function useLogParserConfig(): LogParserConfig {
  const [config, setConfig] = useState<LogParserConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [fieldsRaw, mappingRaw] = await Promise.all([
          getConfig("log_parser_json_fields"),
          getConfig("log_parser_level_mapping"),
        ]);

        if (cancelled) return;

        let jsonLevelFields = DEFAULT_CONFIG.jsonLevelFields;
        if (fieldsRaw) {
          try {
            const parsed = JSON.parse(fieldsRaw);
            if (Array.isArray(parsed) && parsed.every((f: unknown) => typeof f === "string")) {
              jsonLevelFields = parsed;
            }
          } catch {
            // keep default
          }
        }

        let levelMapping = DEFAULT_CONFIG.levelMapping;
        if (mappingRaw) {
          try {
            const parsed = JSON.parse(mappingRaw);
            if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
              levelMapping = { ...DEFAULT_CONFIG.levelMapping, ...parsed };
            }
          } catch {
            // keep default
          }
        }

        setConfig({ jsonLevelFields, levelMapping });
      } catch {
        // keep default on error
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return config;
}
