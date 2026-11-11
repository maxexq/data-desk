// The social-share image (public/og.png), drawn with the game's own components and CSS.
// Rebuild with: node scripts/og/render.mjs
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/vt323/400.css';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import '@fontsource/ibm-plex-sans-thai/700.css';
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import { APP_NAME } from '../../src/config';
import { Grid } from '../../src/ui/Grid';
import { Icon, type IconName } from '../../src/ui/icons';
import { MascotArt } from '../../src/ui/MascotArt';
import { SqlCode } from '../../src/ui/SqlCode';
import './og.css';

const SQL = `WITH monthly AS (
  SELECT st.name, SUM(s.amount_baht) AS total
  FROM sales AS s
  JOIN staff AS st ON st.id = s.staff_id
  GROUP BY st.name
)
SELECT name, total,
  RANK() OVER (ORDER BY total DESC)
FROM monthly;`;

function Win({ title, icon, className, children }: { title: string; icon: IconName; className: string; children: React.ReactNode }) {
  return (
    <section className={`win raised is-top ${className}`}>
      <header className="win-title">
        <Icon name={icon} />
        <span className="win-name">{title}</span>
        <span className="ctl raised">
          <Icon name="min" size={12} />
        </span>
        <span className="ctl raised">
          <Icon name="max" size={12} />
        </span>
        <span className="ctl raised">
          <Icon name="x" size={12} />
        </span>
      </header>
      <div className="win-body">{children}</div>
    </section>
  );
}

function Og() {
  return (
    <div className="desktop og" data-ready>
      <div className="og-icons">
        {(
          [
            ['inbox', 'inbox'],
            ['terminal', 'console'],
            ['shelf', 'shareware'],
            ['music', 'music'],
          ] as [IconName, string][]
        ).map(([icon, label]) => (
          <div key={label} className="desk-icon">
            <span className="desk-art">
              <Icon name={icon} size={48} />
            </span>
            <span className="desk-label">{label}</span>
          </div>
        ))}
      </div>

      <Win title="Welcome" icon="inbox" className="og-hero">
        <div className="og-hero-body">
          <h1>{APP_NAME}</h1>
          <p className="og-sub th">เกมฝึก SQL บนเดสก์ท็อปย้อนยุค</p>
          <p className="og-sub2 th">รับงานเป็น ticket ตั้งแต่ SELECT แรก จนถึงออกแบบตาราง migration และแก้ query ช้า บน PostgreSQL จริงในเบราว์เซอร์</p>
          <div className="og-chips mono">
            {['SELECT', 'JOIN', 'GROUP BY', 'CTE', 'WINDOW', 'INDEX', 'MIGRATION'].map((k) => (
              <span key={k}>{k}</span>
            ))}
          </div>
        </div>
      </Win>

      <Win title="SQL Console" icon="terminal" className="og-console">
        <div className="og-console-body">
          <SqlCode code={SQL} />
          <div className="sunken og-result">
            <Grid
              columns={['name', 'total', 'rank']}
              values={[
                ['Fah', 1284, 1],
                ['Tar', 1190, 2],
                ['Beam', 1032, 3],
              ]}
            />
          </div>
        </div>
      </Win>

      <div className="og-mascot">
        <div className="og-bubble th">ติดตรงไหน ถามน้องข้าวเหนียวได้!</div>
        <MascotArt mood="happy" size={132} />
      </div>

      <footer className="taskbar raised">
        <span className="btn raised start">
          <Icon name="inbox" size={20} /> {APP_NAME}
        </span>
        <div className="tasks">
          <span className="btn raised task pressed">
            <Icon name="terminal" /> <span>SQL Console</span>
          </span>
          <span className="btn raised task">
            <Icon name="ticket" /> <span>T-103</span>
          </span>
        </div>
        <div className="tray sunken mono">
          <span>data-desk.pages.dev</span>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('og')!).render(<Og />);
