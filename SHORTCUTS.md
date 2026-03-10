# Keyboard Shortcuts

Press **`?`** anywhere in the app to open the interactive shortcuts guide.

---

## General

| Shortcut | Action |
|---|---|
| `Cmd+K` / `Ctrl+K` | Open Command Palette (search any resource by name) |
| `?` | Open keyboard shortcuts guide |
| `Escape` | Close active detail sheet or dialog |
| `r` | Refresh the current resource view |
| `/` | Focus the search / filter bar |

---

## Tabs

| Shortcut | Action |
|---|---|
| `Cmd+W` / `Ctrl+W` | Close the current tab |
| `Cmd+1` … `Cmd+9` | Switch to tab by position (1 = first, 9 = ninth) |

---

## Panel (bottom)

| Shortcut | Action |
|---|---|
| `Cmd+J` / `Ctrl+J` | Toggle the bottom panel open / closed |
| `Cmd+T` / `Ctrl+T` | Open a new terminal tab in the bottom panel |
| `Cmd+Shift+A` / `Ctrl+Shift+A` | Open the Activity log tab |

---

## Navigate — `g` chords

Press **`g`** first, then a second key within 800 ms.
A tooltip appears at the bottom of the screen while waiting for the second key.

| Chord | Destination |
|---|---|
| `g` `p` | Pods |
| `g` `d` | Deployments |
| `g` `s` | Services |
| `g` `i` | Ingresses |
| `g` `n` | Network overview |
| `g` `c` | ConfigMaps |
| `g` `e` | Events |
| `g` `h` | Helm Releases |

---

## Table navigation

These keys work when a resource table is focused (and you are **not** typing in an input).

| Shortcut | Action |
|---|---|
| `j` | Move focus to the next row |
| `k` | Move focus to the previous row |
| `Enter` | Open the detail panel for the focused row |
| `Escape` | Deselect focused row (press again to close detail) |
| `l` | Open logs for the focused pod (Pods table only) |

---

## Activity Log copy

| Interaction | Action |
|---|---|
| Hover over a log entry | Reveals **copy** button (copies the command) |
| Click a log entry | Expands to show the full kubectl-equivalent command |
| Click copy in expanded view | Copies the full command to clipboard |

---

## Notes

- Plain keys (`j`, `k`, `r`, `/`, `?`) are **ignored** when the cursor is inside an input field, terminal, or code editor — you can type freely without triggering shortcuts.
- Modifier shortcuts (`Cmd+…`, `Ctrl+…`) always fire regardless of focus.
- On macOS use `Cmd`; on Linux / Windows use `Ctrl`.
