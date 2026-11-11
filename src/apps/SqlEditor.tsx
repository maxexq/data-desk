import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { HighlightStyle, bracketMatching, ensureSyntaxTree, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { formatSql } from '../lib/formatSql';
import { schemaOf, useGame } from '../state/game';
import { editor } from './editorHandle';

// Table and column names of the open ticket. The SQL grammar treats a few common
// names (time, name, role…) as keywords or types, so they are excluded from auto-uppercase.
let idents = new Set<string>();

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
function keywordFixes(state: EditorState, skipAt: number | null) {
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
const autoUppercase = EditorView.updateListener.of((u) => {
  if (!u.docChanged || !u.transactions.some((tr) => tr.isUserEvent('input'))) return;
  const view = u.view;
  queueMicrotask(() => {
    const changes = keywordFixes(view.state, view.state.selection.main.head);
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

const language = new Compartment();
const sqlFor = (schema: Record<string, string[]>) => sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true });

let current: EditorView | null = null;

function setDoc(text: string) {
  const v = current;
  if (!v) return;
  v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text }, selection: { anchor: text.length } });
  v.focus();
}

async function format() {
  const v = current;
  if (!v) return;
  const src = v.state.doc.toString();
  if (!src.trim()) return;
  try {
    const out = await formatSql(src);
    if (out !== src) setDoc(out);
  } catch {
    // Not parseable yet: still normalise keyword case, and say why layout was skipped.
    const changes = keywordFixes(v.state, null);
    if (changes.length) v.dispatch({ changes, userEvent: 'format.uppercase' });
    useGame.getState().say('จัดบรรทัดไม่ได้เพราะคำสั่งยังไม่สมบูรณ์ แก้ให้รันได้ก่อนแล้วลองใหม่');
  }
}

editor.setDoc = setDoc;
editor.format = format;

/** `docKey` changes whenever a different tab (or ticket) should be shown. */
export default function SqlEditor({ tabId, docKey }: { tabId: string; docKey: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = useGame.getState();
    const doc = (game.active && game.tabsets[game.active]?.tabs.find((tb) => tb.id === tabId)?.sql) ?? '';
    const schema = schemaOf(game.tables);
    idents = new Set([...Object.keys(schema), ...Object.values(schema).flat()]);
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [
          keymap.of([
            { key: 'Mod-Enter', run: () => (void useGame.getState().run(tabId), true) },
            { key: 'Shift-Alt-f', run: () => (void format(), true) },
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
          autoUppercase,
          theme,
          EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', spellcheck: 'false', autocapitalize: 'off' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) useGame.getState().setSql(tabId, u.state.doc.toString());
          }),
        ],
      }),
    });
    current = view;
    view.focus();

    // Keep autocomplete in step with the workspace (tables created or dropped by the player).
    const unsubscribe = useGame.subscribe((s, prev) => {
      if (s.tables === prev.tables) return;
      const next = schemaOf(s.tables);
      idents = new Set([...Object.keys(next), ...Object.values(next).flat()]);
      view.dispatch({ effects: language.reconfigure(sqlFor(next)) });
    });

    return () => {
      unsubscribe();
      if (current === view) current = null;
      view.destroy();
    };
  }, [tabId, docKey]);

  return <div ref={host} className="editor sunken" />;
}
