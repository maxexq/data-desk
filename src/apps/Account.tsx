import { memo } from 'react';
import { useAccount, type Provider } from '../state/account';
import { Icon } from '../ui/icons';

const NAMES: Record<Provider, string> = { google: 'Google', github: 'GitHub' };

const when = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Log On to Data Desk", in the style of the old Windows logon box. */
export const AccountWindow = memo(function AccountWindow() {
  const a = useAccount();

  if (a.status === 'signed-in' && a.user)
    return (
      <div className="account">
        <div className="account-who">
          {a.user.avatarUrl ? (
            <img className="account-avatar" src={a.user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <Icon name="key" size={48} />
          )}
          <div>
            <b data-testid="account-name">{a.user.name}</b>
            <div className="dim th">เข้าสู่ระบบด้วย {NAMES[a.user.provider]}</div>
          </div>
        </div>
        <p className="th">ความคืบหน้า โน้ต แท็บ SQL และแอปที่ติดตั้ง ซิงก์ไปเก็บบนเซิร์ฟเวอร์อัตโนมัติ เปิดเกมจากเครื่องไหนก็เล่นต่อได้</p>
        <div className="statusbar">
          <span className="sunken cell mono" data-testid="sync-status">
            {a.sync === 'saving' ? 'Saving…' : a.sync === 'error' ? 'Sync failed · will retry' : a.savedAt ? `Saved ${when(a.savedAt)}` : 'Up to date'}
          </span>
        </div>
        <div className="account-actions">
          <button className="btn raised" onClick={() => void a.syncNow()}>
            <Icon name="reset" /> Sync now
          </button>
          <button className="btn raised" data-testid="logout" onClick={() => void a.logout()}>
            <Icon name="x" /> Log off
          </button>
        </div>
      </div>
    );

  return (
    <div className="account">
      <div className="account-who">
        <Icon name="key" size={48} />
        <div className="th">
          <b>Log On to Data Desk</b>
          <div className="dim">เข้าสู่ระบบเพื่อเก็บความคืบหน้าไว้บนเซิร์ฟเวอร์ แล้วเล่นต่อได้ทุกเครื่อง</div>
        </div>
      </div>
      <div className="account-providers">
        {a.providers.map((p) => (
          <button key={p} className="btn raised primary" data-provider={p} onClick={() => a.login(p)}>
            <Icon name="key" /> Sign in with {NAMES[p]}
          </button>
        ))}
      </div>
      <p className="th dim account-note">
        เก็บแค่ชื่อกับรูปโปรไฟล์ ไม่เก็บอีเมล ไม่โพสต์อะไรแทนคุณ ถ้าไม่เข้าสู่ระบบ เกมก็เล่นได้ปกติและเก็บความคืบหน้าไว้ในเบราว์เซอร์นี้
      </p>
    </div>
  );
});
