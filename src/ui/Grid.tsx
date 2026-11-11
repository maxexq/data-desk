import { memo } from 'react';
import type { Rows } from '../lib/pg';

export const Grid = memo(function Grid({ columns, values }: Rows) {
  return (
    <table className="grid">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {values.map((row, r) => (
          <tr key={r}>
            {row.map((v, c) => (
              <td key={c} className={typeof v === 'number' ? 'num' : typeof v === 'boolean' ? 'bool' : undefined}>
                {v === null ? <span className="null">NULL</span> : String(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
});
