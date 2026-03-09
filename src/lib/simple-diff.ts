/**
 * Simple line-by-line unified diff generator.
 * Produces output compatible with UnifiedDiffViewer.
 */
export function createUnifiedDiff(
  oldText: string,
  newText: string,
  oldLabel: string,
  newLabel: string,
): string {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  const hunks = buildHunks(oldLines, newLines, lcs);

  if (hunks.length === 0) return "";

  const output: string[] = [];
  output.push(`--- ${oldLabel}`);
  output.push(`+++ ${newLabel}`);

  for (const hunk of hunks) {
    output.push(hunk.header);
    for (const line of hunk.lines) {
      output.push(line);
    }
  }

  return output.join("\n");
}

interface Hunk {
  header: string;
  lines: string[];
}

function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function buildHunks(oldLines: string[], newLines: string[], dp: number[][]): Hunk[] {
  // Backtrack LCS to produce diff lines
  const diffLines: { type: "same" | "add" | "remove"; text: string; oldIdx: number; newIdx: number }[] = [];

  let i = oldLines.length;
  let j = newLines.length;

  const stack: typeof diffLines = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "same", text: oldLines[i - 1], oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "add", text: newLines[j - 1], oldIdx: i, newIdx: j - 1 });
      j--;
    } else {
      stack.push({ type: "remove", text: oldLines[i - 1], oldIdx: i - 1, newIdx: j });
      i--;
    }
  }
  stack.reverse();

  // Group into hunks with 3 lines of context
  const CONTEXT = 3;
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;
  let oldStart = 0;
  let newStart = 0;
  let oldCount = 0;
  let newCount = 0;
  let trailingSame = 0;

  for (const line of stack) {
    if (line.type === "same") {
      if (currentHunk) {
        trailingSame++;
        currentHunk.lines.push(` ${line.text}`);
        oldCount++;
        newCount++;
        if (trailingSame > CONTEXT * 2) {
          // Close hunk
          // Trim trailing context beyond CONTEXT
          const excess = trailingSame - CONTEXT;
          currentHunk.lines.splice(currentHunk.lines.length - excess);
          oldCount -= excess;
          newCount -= excess;
          currentHunk.header = `@@ -${oldStart + 1},${oldCount} +${newStart + 1},${newCount} @@`;
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    } else {
      if (!currentHunk) {
        // Start new hunk — include preceding context
        const contextStart = Math.max(0, stack.indexOf(line) - CONTEXT);
        currentHunk = { header: "", lines: [] };
        oldStart = line.oldIdx;
        newStart = line.newIdx;
        oldCount = 0;
        newCount = 0;

        // Add leading context
        for (let c = contextStart; c < stack.indexOf(line); c++) {
          if (stack[c].type === "same") {
            currentHunk.lines.push(` ${stack[c].text}`);
            oldCount++;
            newCount++;
            oldStart = Math.min(oldStart, stack[c].oldIdx);
            newStart = Math.min(newStart, stack[c].newIdx);
          }
        }
      }
      trailingSame = 0;
      if (line.type === "remove") {
        currentHunk.lines.push(`-${line.text}`);
        oldCount++;
      } else {
        currentHunk.lines.push(`+${line.text}`);
        newCount++;
      }
    }
  }

  if (currentHunk) {
    // Trim trailing same lines beyond context
    if (trailingSame > CONTEXT) {
      const excess = trailingSame - CONTEXT;
      currentHunk.lines.splice(currentHunk.lines.length - excess);
      oldCount -= excess;
      newCount -= excess;
    }
    currentHunk.header = `@@ -${oldStart + 1},${oldCount} +${newStart + 1},${newCount} @@`;
    hunks.push(currentHunk);
  }

  return hunks;
}
