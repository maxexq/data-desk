import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { HighlightStyle, bracketMatching, ensureSyntaxTree, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { formatSql } from '../lib/formatSql';
import { useGame } from '../state/game';
import type { EditorHandle } from './editorHandle';

export type Schema = Record<string, string[]>;

// Table and column names are excluded from auto-uppercase: the SQL grammar treats a few
// common names (time, name, role…) as keywords or types.
const identsOf = (schema: Schema) => new Set([...Object.keys(schema), ...Object.values(schema).flat()].map((x) => x.toLowerCase()));

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--kw)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--lit)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--num)' },
  { tag: [t.lineComment, t.blockComment], color: 'var(--com)', fontStyle: 'italic' },
  { tag: [t.name, t.typeName, t.standard(t.name)], color: 'var(--id)' },
  { tag: [t.operator, t.punctuation], color: 'var(--ink)' },
]);

// Syntax nodes written in capitals: keywords, plus the literals NULL, TRUE and FALSE.
const UPPERCASED = new Set(['Keyword', 'Null', 'Bool']);

/** Collect keyword tokens that are not yet uppercase, skipping the word under the cursor. */
function keywordFixes(state: EditorState, skipAt: number | null, idents: Set<string>) {
  const tree = ensureSyntaxTree(state, state.doc.length, 50);
  const changes: { from: number; to: number; insert: string }[] = [];
  tree?.iterate({
    enter(n) {
      if (!UPPERCASED.has(n.name) || n.to === skipAt) return;
      const word = state.sliceDoc(n.from, n.to);
      const up = word.toUpperCase();
      if (word !== up && !idents.has(word.toLowerCase())) changes.push({ from: n.from, to: n.to, insert: up });
    },
  });
  return changes;
}

/** Uppercase SQL keywords as soon as the user finishes typing (or pastes) them. */
const autoUppercase = (idents: () => Set<string>) =>
  EditorView.updateListener.of((u) => {
    if (!u.docChanged || !u.transactions.some((tr) => tr.isUserEvent('input'))) return;
    const view = u.view;
    queueMicrotask(() => {
      const changes = keywordFixes(view.state, view.state.selection.main.head, idents());
      if (changes.length) view.dispatch({ changes, userEvent: 'format.uppercase' });
    });
  });

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '24px', backgroundColor: 'transparent', color: 'var(--ink)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: "'VT323', monospace", lineHeight: '1.15', overflow: 'auto' },
  '.cm-content': { padding: '8px 0', caretColor: 'var(--ink)' },
  '.cm-line': { padding: '0 12px' },
  '.cm-cursor': { borderLeft: '3px solid var(--ink)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#c9c2ee !important' },
  '.cm-matchingBracket': { backgroundColor: '#ffe9a8', outline: 'none' },
  '.cm-placeholder': { color: 'var(--lo)' },
  '.cm-tooltip': {
    fontFamily: "'VT323', monospace",
    fontSize: '20px',
    backgroundColor: 'var(--chrome)',
    border: '2px solid var(--dk)',
    borderRadius: '0',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--title)', color: '#fff' },
  '.cm-completionIcon': { display: 'none' },
});

const sqlFor = (schema: Schema) => sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true });

function setDoc(view: EditorView, text: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: text.length } });
  view.focus();
}

async function format(view: EditorView, idents: Set<string>) {
  const src = view.state.doc.toString();
  if (!src.trim()) return;
  try {
    const out = await formatSql(src);
    if (out !== src) setDoc(view, out);
  } catch {
    // Not parseable yet: still normalise keyword case, and say why layout was skipped.
    const changes = keywordFixes(view.state, null, idents);
    if (changes.length) view.dispatch({ changes, userEvent: 'format.uppercase' });
    useGame.getState().say('จัดบรรทัดไม่ได้เพราะคำสั่งยังไม่สมบูรณ์ แก้ให้รันได้ก่อนแล้วลองใหม่');
  }
}

export interface SqlEditorProps {
  /** Text to start with. Read once: remount (change `key`) to show another document. */
  doc: string;
  onChange: (sql: string) => void;
  onRun: () => void;
  /** Tables and columns for autocomplete. */
  schema: Schema;
  /** Filled in on mount so toolbar buttons can drive this editor. */
  handle: EditorHandle;
  label?: string;
}

export default function SqlEditor(props: SqlEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const language = useRef(new Compartment()).current;
  const idents = useRef(identsOf(props.schema));
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    const { doc, handle, schema, label = 'SQL editor' } = latest.current;
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [
          keymap.of([
            { key: 'Mod-Enter', run: () => (latest.current.onRun(), true) },
            { key: 'Shift-Alt-f', run: () => (void format(v, idents.current), true) },
            ...closeBracketsKeymap,
            ...completionKeymap,
            ...historyKeymap,
            indentWithTab,
            ...defaultKeymap,
          ]),
          history(),
          language.of(sqlFor(schema)),
          syntaxHighlighting(highlight),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ icons: false }),
          EditorView.lineWrapping,
          placeholder('SELECT ... FROM ...'),
          autoUppercase(() => idents.current),
          theme,
          EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false', autocapitalize: 'off' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) latest.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    handle.setDoc = (text) => setDoc(v, text);
    handle.format = () => format(v, idents.current);
    v.focus();
    return () => {
      handle.setDoc = () => {};
      handle.format = async () => {};
      view.current = null;
      v.destroy();
    };
  }, [language]);

  // Keep autocomplete in step with the database (tables created or dropped by the player).
  useEffect(() => {
    idents.current = identsOf(props.schema);
    view.current?.dispatch({ effects: language.reconfigure(sqlFor(props.schema)) });
  }, [props.schema, language]);

  return <div ref={host} className="editor sunken" />;
}
