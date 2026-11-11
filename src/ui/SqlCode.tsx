import { memo } from 'react';

/** Tiny static highlighter for read-only snippets (the editor itself uses CodeMirror). */
export const SqlCode = memo(function SqlCode({ code }: { code: string }) {
  const parts = code.match(/'(?:[^']|'')*'|--.*|\b\d+\b|[A-Za-z_][A-Za-z_0-9]*|\s+|./g) ?? [];
  return (
    <pre className="code sunken mono">
      {parts.map((p, i) => {
        const cls = p.startsWith("'")
          ? 'lit'
          : p.startsWith('--')
            ? 'com'
            : /^\d/.test(p)
              ? 'numc'
              : /^[A-Z]{2,}$/.test(p)
                ? 'kw'
                : /^[a-z_]/.test(p)
                  ? 'idt'
                  : '';
        return cls ? (
          <span key={i} className={cls}>
            {p}
          </span>
        ) : (
          p
        );
      })}
    </pre>
  );
});
