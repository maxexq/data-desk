/**
 * Format SQL the way the in-game manual teaches: uppercase keywords, each root
 * keyword on its own line with its contents indented, and every JOIN's ON
 * condition on its own indented line. sql-formatter is loaded on demand.
 */
export async function formatSql(src: string): Promise<string> {
  const { format } = await import('sql-formatter');
  return format(src, { language: 'postgresql', keywordCase: 'upper', tabWidth: 2 }).replace(
    /^(\s*)(.*\bJOIN\b.*?)\s+ON\s+/gm,
    '$1$2\n$1  ON ',
  );
}
