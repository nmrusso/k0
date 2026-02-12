import { useRef, useEffect } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";

const k0Theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "12px",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    lineHeight: "1.6",
  },
  ".cm-gutters": {
    borderRight: "1px solid hsl(var(--border))",
    backgroundColor: "transparent",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--accent) / 0.3)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "hsl(var(--primary))",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.2) !important",
  },
}, { dark: true });

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function YamlEditor({ value, onChange, readOnly = false }: YamlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        yaml(),
        oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        k0Theme,
        updateListener,
        EditorState.readOnly.of(readOnly),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create the editor once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync value from outside (e.g. after fetch)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="h-[60vh] overflow-hidden rounded-md border border-input"
    />
  );
}
