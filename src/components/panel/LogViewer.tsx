import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePanelStore, type PanelTab } from "@/stores/panelStore";
import { useLogStream } from "@/hooks/useLogStream";
import { useLogParserConfig } from "@/hooks/useLogParserConfig";
import { parseAnsi, stripAnsi } from "@/lib/ansi";
import {
  parseLogLine,
  LOG_LEVEL_COLORS,
  LOG_LEVEL_TEXT_COLORS,
  ALL_LOG_LEVELS,
  type LogLevel,
} from "@/lib/log-parser";
import { ArrowDownToLine, Trash2, Search, Loader2 } from "lucide-react";

const PAGE_SIZE = 500;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightMatch(html: string, query: string): string {
  if (!query) return html;
  const escaped = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  return html.replace(/(<[^>]*>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag;
    return text.replace(regex, '<mark class="bg-yellow-500/40 text-inherit">$1</mark>');
  });
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
  trace: "TRACE",
  unknown: "OTHER",
};

interface LogViewerProps {
  tab: PanelTab;
}

export function LogViewer({ tab }: LogViewerProps) {
  const setFollowing = usePanelStore((s) => s.setFollowing);
  const setSearchQuery = usePanelStore((s) => s.setSearchQuery);
  const setSelectedContainer = usePanelStore((s) => s.setSelectedContainer);
  const clearLogLines = usePanelStore((s) => s.clearLogLines);
  const setStreaming = usePanelStore((s) => s.setStreaming);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(
    () => new Set(ALL_LOG_LEVELS),
  );

  const parserConfig = useLogParserConfig();

  // Start log stream
  useLogStream(
    tab.id,
    tab.targetKind || "pod",
    tab.targetName || "",
    tab.selectedContainer,
  );

  // Parse all lines
  const parsedLines = useMemo(() => {
    const lines = tab.lines || [];
    return lines.map((line) => parseLogLine(line, parserConfig));
  }, [tab.lines, parserConfig]);

  // Count per level (from all lines, not filtered)
  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = {
      error: 0, warn: 0, info: 0, debug: 0, trace: 0, unknown: 0,
    };
    for (const parsed of parsedLines) {
      counts[parsed.level]++;
    }
    return counts;
  }, [parsedLines]);

  // Filter lines by search query AND active levels
  const filteredLines = useMemo(() => {
    const query = tab.searchQuery?.toLowerCase();
    return parsedLines.filter((parsed) => {
      if (!activeLevels.has(parsed.level)) return false;
      if (query && !stripAnsi(parsed.raw).toLowerCase().includes(query)) return false;
      return true;
    });
  }, [parsedLines, tab.searchQuery, activeLevels]);

  // Paginated: only show last `visibleCount` lines
  const totalFiltered = filteredLines.length;
  const showAll = visibleCount >= totalFiltered;
  const displayedLines = useMemo(() => {
    if (showAll) return filteredLines;
    return filteredLines.slice(totalFiltered - visibleCount);
  }, [filteredLines, visibleCount, totalFiltered, showAll]);

  // Pre-render ANSI HTML with optional search highlighting
  const renderedLines = useMemo(() => {
    const query = tab.searchQuery?.toLowerCase() || "";
    return displayedLines.map((parsed) => {
      let html = parseAnsi(parsed.raw);
      if (query) {
        html = highlightMatch(html, query);
      }
      return { html, level: parsed.level };
    });
  }, [displayedLines, tab.searchQuery]);

  // Auto-scroll when following
  useEffect(() => {
    if (tab.isFollowing && scrollRef.current && !isUserScrolling.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [renderedLines, tab.isFollowing]);

  // Reset visible count when following or when lines are cleared
  useEffect(() => {
    if (tab.isFollowing) {
      setVisibleCount(PAGE_SIZE);
    }
  }, [tab.isFollowing]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;

    isUserScrolling.current = !atBottom;

    if (!atBottom && tab.isFollowing) {
      setFollowing(tab.id, false);
    }

    // Load more when scrolled to top
    if (scrollTop < 50 && !showAll) {
      const prevHeight = scrollHeight;
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, totalFiltered));
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const newHeight = scrollRef.current.scrollHeight;
          scrollRef.current.scrollTop = newHeight - prevHeight + scrollTop;
        }
      });
    }
  }, [tab.id, tab.isFollowing, setFollowing, showAll, totalFiltered]);

  const handleFollow = () => {
    setFollowing(tab.id, true);
    setVisibleCount(PAGE_SIZE);
    isUserScrolling.current = false;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const handleContainerChange = (container: string) => {
    clearLogLines(tab.id);
    setSelectedContainer(tab.id, container);
    setStreaming(tab.id, true);
    setVisibleCount(PAGE_SIZE);
  };

  const handleClear = () => {
    clearLogLines(tab.id);
    setVisibleCount(PAGE_SIZE);
  };

  const toggleLevel = (level: LogLevel) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        {(tab.availableContainers?.length ?? 0) > 1 && (
          <Select
            value={tab.selectedContainer || ""}
            onValueChange={handleContainerChange}
          >
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue placeholder="Container" />
            </SelectTrigger>
            <SelectContent>
              {tab.availableContainers?.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Level filter pills */}
        <div className="flex items-center gap-0.5">
          {ALL_LOG_LEVELS.map((level) => {
            const active = activeLevels.has(level);
            const count = levelCounts[level];
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? `${LOG_LEVEL_TEXT_COLORS[level]} bg-muted`
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
                title={`${active ? "Hide" : "Show"} ${LEVEL_LABELS[level]} lines`}
              >
                {LEVEL_LABELS[level]}
                {count > 0 && (
                  <span className="tabular-nums">{count > 999 ? `${Math.floor(count / 1000)}k` : count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter logs..."
            value={tab.searchQuery || ""}
            onChange={(e) => setSearchQuery(tab.id, e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {tab.isStreaming && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {displayedLines.length.toLocaleString()}
            {!showAll && ` / ${totalFiltered.toLocaleString()}`} lines
          </span>
          <Button
            variant={tab.isFollowing ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={handleFollow}
            title="Follow"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleClear}
            title="Clear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-black/20 p-2 font-mono text-xs leading-5"
      >
        {!showAll && (
          <div className="mb-2 text-center text-xs text-muted-foreground">
            Showing last {displayedLines.length.toLocaleString()} of{" "}
            {totalFiltered.toLocaleString()} lines — scroll up to load more
          </div>
        )}
        {renderedLines.map(({ html, level }, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all text-foreground/90 hover:bg-muted/30 border-l-2 pl-1.5 ${LOG_LEVEL_COLORS[level]}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ))}
        {displayedLines.length === 0 && !tab.isStreaming && (
          <div className="py-8 text-center text-muted-foreground">
            No log output
          </div>
        )}
        {displayedLines.length === 0 && tab.isStreaming && (
          <div className="py-8 text-center text-muted-foreground">
            Waiting for logs...
          </div>
        )}
      </div>
    </div>
  );
}
