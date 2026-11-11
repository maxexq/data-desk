// Illustrated evidence. All drawings are original SVG; each one teaches exactly one fact.
import type { ReactNode } from 'react';

const HAND = "'Mali','IBM Plex Sans Thai',sans-serif";
const PIX = "'VT323',monospace";
const INK = '#1c1a2e';

function Sticky({ x, y, rot, fill, lines, w = 132 }: { x: number; y: number; rot: number; fill: string; lines: string[]; w?: number }) {
  const h = 22 + lines.length * 19;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="3" y="4" width={w} height={h} fill="#00000033" />
      <rect width={w} height={h} fill={fill} stroke={INK} strokeWidth="2" />
      <rect x={w / 2 - 16} y="-7" width="32" height="12" fill="#ffffffaa" stroke={INK} strokeWidth="1" />
      {lines.map((l, i) => (
        <text key={i} x={w / 2} y={24 + i * 19} textAnchor="middle" fontFamily={HAND} fontSize="14" fontWeight="600" fill={INK}>
          {l}
        </text>
      ))}
    </g>
  );
}

/** A round doodle head. `extra` draws the hat/glasses on top. */
function Face({ x, y, fill, mouth = 'flat', extra }: { x: number; y: number; fill: string; mouth?: 'flat' | 'o' | 'smile'; extra?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-34 62 Q0 30 34 62 L34 74 L-34 74 Z" fill={fill} stroke={INK} strokeWidth="3" />
      <circle r="30" fill="#fff3bf" stroke={INK} strokeWidth="3" />
      <circle cx="-10" cy="-4" r="3.5" fill={INK} />
      <circle cx="10" cy="-4" r="3.5" fill={INK} />
      {mouth === 'flat' && <path d="M-8 12 H8" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {mouth === 'o' && <ellipse cx="0" cy="13" rx="5" ry="6" fill={INK} />}
      {mouth === 'smile' && <path d="M-9 9 Q0 20 9 9" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {extra}
    </g>
  );
}

function Bubble({ x, y, w, h, tail, lines }: { x: number; y: number; w: number; h: number; tail: 'left' | 'right'; lines: string[] }) {
  const tx = tail === 'left' ? 18 : w - 18;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="14" fill="#fff" stroke={INK} strokeWidth="3" />
      <path d={`M${tx - 8} ${h - 2} L${tx} ${h + 16} L${tx + 10} ${h - 2}`} fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x={tx - 7} y={h - 5} width="16" height="5" fill="#fff" />
      {lines.map((l, i) => (
        <text key={i} x={w / 2} y={24 + i * 19} textAnchor="middle" fontFamily={HAND} fontSize="14" fontWeight="600" fill={INK}>
          {l}
        </text>
      ))}
    </g>
  );
}

const Svg = ({ label, children }: { label: string; children: ReactNode }) => (
  <svg role="img" aria-label={label} viewBox="0 0 520 360" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    {children}
  </svg>
);

function Sign() {
  return (
    <Svg label="ภาพถ่ายประตูห้อง ป้ายเขียนว่า Server Room, Authorized Badges Only มีเครื่องรูดบัตรและโน้ตแปะเตือนเรื่องชานมไข่มุก">
      <rect width="520" height="360" fill="#5d6675" />
      <rect y="300" width="520" height="60" fill="#3d4450" />
      <rect x="250" y="20" width="200" height="290" fill="#93a0b4" stroke={INK} strokeWidth="4" />
      <rect x="268" y="40" width="164" height="110" fill="#a9b6c9" stroke={INK} strokeWidth="2" />
      <rect x="268" y="170" width="164" height="120" fill="#a9b6c9" stroke={INK} strokeWidth="2" />
      <rect x="416" y="156" width="22" height="10" fill="#e9ecef" stroke={INK} strokeWidth="2" />
      {/* plate */}
      <rect x="282" y="56" width="136" height="78" fill="#fff8dc" stroke={INK} strokeWidth="3" />
      <text x="350" y="86" textAnchor="middle" fontFamily={PIX} fontSize="27" fill={INK} textLength="116" lengthAdjust="spacingAndGlyphs">
        SERVER ROOM
      </text>
      <rect x="296" y="94" width="108" height="4" fill="#c92a2a" />
      <text x="350" y="114" textAnchor="middle" fontFamily={PIX} fontSize="15" fill={INK}>
        AUTHORIZED
      </text>
      <text x="350" y="128" textAnchor="middle" fontFamily={PIX} fontSize="15" fill={INK}>
        BADGES ONLY
      </text>
      {/* badge reader */}
      <rect x="196" y="150" width="40" height="64" fill="#2b2f38" stroke={INK} strokeWidth="3" />
      <rect x="204" y="158" width="24" height="12" fill="#51cf66" />
      <rect x="206" y="180" width="20" height="5" fill="#ced4da" />
      <rect x="206" y="192" width="20" height="5" fill="#ced4da" />
      <path d="M150 236 Q176 232 198 206" fill="none" stroke="#ffd43b" strokeWidth="4" strokeLinecap="round" />
      <path d="M186 204 L200 204 L198 218" fill="none" stroke="#ffd43b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <text x="18" y="246" fontFamily={HAND} fontSize="16" fontWeight="700" fill="#ffd43b">
        ติ๊ด! 1 ครั้ง
      </text>
      <text x="18" y="268" fontFamily={HAND} fontSize="16" fontWeight="700" fill="#ffd43b">
        = 1 แถวใน door_logs
      </text>
      <text x="18" y="290" fontFamily={HAND} fontSize="14" fontWeight="600" fill="#ffe8a1">
        (เข้า = in, ออก = out)
      </text>
      <Sticky x={22} y={30} rot={-5} fill="#ffe066" lines={['ห้ามเอาชานมไข่มุก', 'เข้าห้องนี้!!', '(อีกแล้ว)']} w={150} />
      <Sticky x={36} y={128} rot={4} fill="#fcc2d7" lines={['เซิร์ฟเวอร์ ≠', 'ราวตากผ้า']} w={120} />
      {/* crossed-out bubble tea */}
      <g transform="translate(468 232)">
        <path d="M-16 -22 L16 -22 L11 26 L-11 26 Z" fill="#f1e2c6" stroke={INK} strokeWidth="3" />
        <rect x="2" y="-40" width="5" height="34" fill="#f783ac" stroke={INK} strokeWidth="2" />
        <circle cx="-5" cy="16" r="4" fill={INK} />
        <circle cx="5" cy="18" r="4" fill={INK} />
        <circle cx="0" cy="8" r="4" fill={INK} />
        <circle r="38" fill="none" stroke="#e03131" strokeWidth="6" />
        <path d="M-27 -27 L27 27" stroke="#e03131" strokeWidth="6" />
      </g>
    </Svg>
  );
}

function Memo() {
  return (
    <Svg label="ประกาศฝ่ายบุคคล อธิบายว่าเลขบัตร badge_id เชื่อมตาราง suspects กับตาราง door_logs">
      <rect width="520" height="360" fill="#c9bfa5" />
      <rect x="20" y="12" width="480" height="336" fill="#fffdf5" stroke={INK} strokeWidth="3" />
      <rect x="20" y="12" width="480" height="34" fill="#ffd43b" stroke={INK} strokeWidth="3" />
      <text x="34" y="35" fontFamily={PIX} fontSize="20" fill={INK} textLength="250" lengthAdjust="spacingAndGlyphs">
        MANGO STICKY DATA CO. — HR MEMO #47
      </text>
      <text x="260" y="78" textAnchor="middle" fontFamily={HAND} fontSize="24" fontWeight="700" fill={INK}>
        บัตรพนักงาน = วิญญาณของคุณ
      </text>
      {/* suspects card */}
      <rect x="40" y="100" width="170" height="120" fill="#e7f5ff" stroke={INK} strokeWidth="3" />
      <rect x="40" y="100" width="170" height="24" fill="#3b5bdb" />
      <text x="50" y="118" fontFamily={PIX} fontSize="19" fill="#fff">
        suspects
      </text>
      <text x="50" y="146" fontFamily={PIX} fontSize="19" fill="#c2410c">
        badge_id
      </text>
      <text x="50" y="168" fontFamily={PIX} fontSize="19" fill={INK}>
        name
      </text>
      <text x="50" y="190" fontFamily={PIX} fontSize="19" fill={INK}>
        role
      </text>
      <text x="125" y="212" textAnchor="middle" fontFamily={HAND} fontSize="13" fill="#5c5873">
        "คุณคือใคร"
      </text>
      {/* door_logs card */}
      <rect x="310" y="100" width="170" height="142" fill="#fff0f6" stroke={INK} strokeWidth="3" />
      <rect x="310" y="100" width="170" height="24" fill="#c2255c" />
      <text x="320" y="118" fontFamily={PIX} fontSize="19" fill="#fff">
        door_logs
      </text>
      <text x="320" y="146" fontFamily={PIX} fontSize="19" fill="#c2410c">
        badge_id
      </text>
      <text x="320" y="168" fontFamily={PIX} fontSize="19" fill={INK}>
        time
      </text>
      <text x="320" y="190" fontFamily={PIX} fontSize="19" fill={INK}>
        door
      </text>
      <text x="320" y="212" fontFamily={PIX} fontSize="19" fill={INK}>
        direction
      </text>
      <text x="395" y="234" textAnchor="middle" fontFamily={HAND} fontSize="13" fill="#5c5873">
        "คุณไปไหนมา"
      </text>
      {/* link */}
      <path d="M210 141 H310" stroke="#c2410c" strokeWidth="4" strokeDasharray="8 6" />
      <circle cx="210" cy="141" r="6" fill="#c2410c" />
      <circle cx="310" cy="141" r="6" fill="#c2410c" />
      <rect x="214" y="156" width="92" height="26" fill="#ffe066" stroke={INK} strokeWidth="2" transform="rotate(-4 260 169)" />
      <text x="260" y="175" textAnchor="middle" fontFamily={HAND} fontSize="14" fontWeight="700" fill={INK} transform="rotate(-4 260 169)">
        เลขเดียวกัน!
      </text>
      <text x="40" y="270" fontFamily={HAND} fontSize="15" fontWeight="600" fill={INK}>
        • ประตูไม่รู้จักชื่อคุณ ประตูรู้จักแค่เลขบัตร
      </text>
      <text x="40" y="294" fontFamily={HAND} fontSize="15" fontWeight="600" fill={INK}>
        • อยากรู้ว่าเลขไหนคือใคร ต้องเอาสองตารางมาเทียบกัน
      </text>
      <text x="40" y="330" fontFamily={HAND} fontSize="14" fontWeight="700" fill="#c92a2a">
        ทำบัตรหาย ปรับข้าวเหนียวมะม่วง 3 กล่อง (ส่งที่โต๊ะ HR)
      </text>
      {/* mango */}
      <g transform="translate(456 312)">
        <path d="M-20 4 Q-18 -18 4 -18 Q24 -16 20 6 Q14 22 -6 20 Q-20 18 -20 4 Z" fill="#ffc94d" stroke={INK} strokeWidth="3" />
        <path d="M2 -18 Q4 -28 14 -28" fill="none" stroke="#2f9e44" strokeWidth="4" strokeLinecap="round" />
        <circle cx="-5" cy="-2" r="2.5" fill={INK} />
        <circle cx="7" cy="-2" r="2.5" fill={INK} />
        <path d="M-3 6 Q1 10 5 6" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </Svg>
  );
}

function Interview() {
  return (
    <Svg label="การ์ตูนสามช่องของคำให้การ: Mara บอกว่ากลับบ้านสองทุ่มครึ่ง, Dev บอกว่ากลับตั้งแต่หนึ่งทุ่ม, Otto บอกว่าเดินตรวจทั้งคืน">
      <rect width="520" height="360" fill="#fff9db" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={12 + i * 170} y="12" width="158" height="262" fill={['#e6fcf5', '#e7f5ff', '#fff4e6'][i]} stroke={INK} strokeWidth="4" />
      ))}
      {/* Mara */}
      <Bubble x={22} y={22} w={138} h={66} tail="left" lines={['กลับบ้านตั้งแต่', 'สองทุ่มครึ่งค่ะ', 'ถามแมวฉันได้']} />
      <Face
        x={70}
        y={170}
        fill="#63e6be"
        mouth="flat"
        extra={
          <g>
            <circle cx="-10" cy="-4" r="10" fill="none" stroke={INK} strokeWidth="3" />
            <circle cx="10" cy="-4" r="10" fill="none" stroke={INK} strokeWidth="3" />
            <path d="M-28 -18 Q0 -44 28 -18" fill="#862e9c" stroke={INK} strokeWidth="3" />
          </g>
        }
      />
      <g transform="translate(132 222)">
        <path d="M-14 -8 L-14 -22 L-5 -12 L5 -12 L14 -22 L14 -8 Q16 12 0 12 Q-16 12 -14 -8 Z" fill="#ffa94d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="-5" cy="-2" r="2" fill={INK} />
        <circle cx="5" cy="-2" r="2" fill={INK} />
      </g>
      <text x="92" y="262" textAnchor="middle" fontFamily={HAND} fontSize="12" fill="#5c5873">
        แมว: "เมี้ยว" (ไม่ยืนยัน)
      </text>
      {/* Dev */}
      <Bubble x={192} y={22} w={138} h={66} tail="left" lines={['กลับตั้งแต่', 'หนึ่งทุ่มครับ', 'นอนแล้ว Zzz']} />
      <Face
        x={252}
        y={170}
        fill="#74c0fc"
        mouth="smile"
        extra={
          <g>
            <path d="M-30 -10 Q-28 -40 6 -36 Q30 -32 30 -10 Z" fill="#e03131" stroke={INK} strokeWidth="3" />
            <path d="M22 -12 H46" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          </g>
        }
      />
      <text x="306" y="150" fontFamily={HAND} fontSize="20" fontWeight="700" fill="#3b5bdb">
        z
      </text>
      <text x="316" y="134" fontFamily={HAND} fontSize="15" fontWeight="700" fill="#3b5bdb">
        z
      </text>
      {/* Otto */}
      <Bubble x={362} y={22} w={138} h={66} tail="right" lines={['ตรวจทุกห้องทั้งคืน', '…รวมตู้เย็นด้วย', '2 รอบ']} />
      <Face
        x={420}
        y={170}
        fill="#ffd43b"
        mouth="o"
        extra={
          <g>
            <path d="M-32 -16 H32 L26 -40 H-26 Z" fill="#364fc7" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <rect x="-7" y="-34" width="14" height="10" fill="#ffd43b" stroke={INK} strokeWidth="2" />
            <path d="M-36 -16 H36" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          </g>
        }
      />
      {/* footer note */}
      <rect x="12" y="286" width="496" height="62" fill="#fff" stroke={INK} strokeWidth="3" strokeDasharray="10 6" />
      <text x="260" y="312" textAnchor="middle" fontFamily={HAND} fontSize="16" fontWeight="700" fill={INK}>
        คำให้การของทุกคนถูกพิมพ์ลงตาราง statements แล้ว
      </text>
      <text x="260" y="336" textAnchor="middle" fontFamily={HAND} fontSize="15" fontWeight="600" fill="#c92a2a">
        คนพูดอะไรก็ได้ แต่ประตูไม่โกหก
      </text>
    </Svg>
  );
}

function Syslog() {
  const L = [
    ['21:41:57', 'console tty1 login OK', '#b2f2bb'],
    ['21:42:10', '$ rm -rf /data/archive', '#ff8787'],
    ['21:42:48', '18,204 files removed', '#b2f2bb'],
    ['21:43:02', 'console tty1 logout', '#b2f2bb'],
  ];
  return (
    <Svg label="ภาพหน้าจอ log ของเซิร์ฟเวอร์ คำสั่งลบถูกพิมพ์เวลา 21:42:10 จากคีย์บอร์ดในห้อง">
      <rect width="520" height="360" fill="#0f0f13" />
      <rect width="520" height="26" fill="#2b2f38" />
      <circle cx="16" cy="13" r="5" fill="#ff6b6b" />
      <circle cx="34" cy="13" r="5" fill="#ffd43b" />
      <circle cx="52" cy="13" r="5" fill="#51cf66" />
      <text x="260" y="19" textAnchor="middle" fontFamily={PIX} fontSize="17" fill="#ced4da">
        srv-mango-01 : /var/log/syslog
      </text>
      {L.map(([time, text, color], i) => (
        <g key={i}>
          <text x="18" y={66 + i * 34} fontFamily={PIX} fontSize="24" fill="#ffd43b" textLength="84" lengthAdjust="spacingAndGlyphs">
            {time}
          </text>
          <text x="118" y={66 + i * 34} fontFamily={PIX} fontSize="24" fill={color}>
            {text}
          </text>
        </g>
      ))}
      <text x="118" y="190" fontFamily={HAND} fontSize="13" fill="#868e96">
        (รวมสูตรข้าวเหนียวมะม่วงของคุณยายที่เก็บไว้ 12 ปี)
      </text>
      {/* circle the time */}
      <ellipse cx="60" cy="92" rx="52" ry="19" fill="none" stroke="#ffd43b" strokeWidth="3" transform="rotate(-3 60 92)" />
      <path d="M96 232 Q70 190 62 116" fill="none" stroke="#ffd43b" strokeWidth="3" strokeLinecap="round" />
      <text x="72" y="252" fontFamily={HAND} fontSize="17" fontWeight="700" fill="#ffd43b">
        เวลาเกิดเหตุ: 21:42
      </text>
      {/* local keyboard callout */}
      <rect x="278" y="218" width="226" height="118" fill="#1f2530" stroke="#51cf66" strokeWidth="3" />
      <text x="391" y="244" textAnchor="middle" fontFamily={HAND} fontSize="15" fontWeight="700" fill="#b2f2bb">
        "console tty1" แปลว่าอะไร?
      </text>
      <g transform="translate(316 262)">
        <rect width="150" height="34" rx="4" fill="#ced4da" stroke="#fff" strokeWidth="2" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={6 + i * 14} y="6" width="10" height="8" fill="#495057" />
        ))}
        <rect x="34" y="20" width="82" height="8" fill="#495057" />
      </g>
      <text x="391" y="322" textAnchor="middle" fontFamily={HAND} fontSize="14" fontWeight="600" fill="#fff">
        พิมพ์จากคีย์บอร์ดในห้องเอง
      </text>
    </Svg>
  );
}

function Cctv() {
  return (
    <Svg label="ภาพกล้องวงจรปิดเวลา 21:42 คนสวมถุงกระดาษคลุมหัวนั่งพิมพ์คีย์บอร์ดในห้องเซิร์ฟเวอร์ และแผนภาพอธิบายคู่ in กับ out">
      <rect width="520" height="360" fill="#23272e" />
      {/* camera frame */}
      <rect x="10" y="10" width="320" height="220" fill="#3a4049" stroke="#868e96" strokeWidth="3" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${24 + i * 46} 30)`}>
          <rect width="38" height="150" fill="#1b1e23" stroke="#868e96" strokeWidth="2" />
          {[0, 1, 2, 3, 4, 5].map((j) => (
            <rect key={j} x="6" y={10 + j * 22} width="8" height="6" fill={j % 2 ? '#51cf66' : '#ffd43b'} />
          ))}
        </g>
      ))}
      <rect x="178" y="150" width="130" height="12" fill="#868e96" />
      <rect x="196" y="126" width="52" height="24" fill="#1b1e23" stroke="#ced4da" strokeWidth="2" />
      <rect x="204" y="132" width="36" height="4" fill="#ff8787" />
      {/* bag person */}
      <g transform="translate(274 132)">
        <path d="M-26 70 Q-24 30 0 30 Q24 30 26 70 Z" fill="#868e96" stroke="#e9ecef" strokeWidth="3" />
        <path d="M-22 -36 L22 -36 L26 32 L-26 32 Z" fill="#d9b382" stroke="#e9ecef" strokeWidth="3" strokeLinejoin="round" />
        <path d="M-22 -36 l6 8 l6 -8 l6 8 l6 -8 l6 8 l6 -8 l8 8" fill="none" stroke="#e9ecef" strokeWidth="3" />
        <circle cx="-9" cy="-6" r="5" fill="#1b1e23" />
        <circle cx="9" cy="-6" r="5" fill="#1b1e23" />
        <path d="M-9 12 Q0 20 9 12" fill="none" stroke="#1b1e23" strokeWidth="3" strokeLinecap="round" />
        <path d="M-24 46 L-52 28" stroke="#868e96" strokeWidth="9" strokeLinecap="round" />
      </g>
      <text x="20" y="218" fontFamily={PIX} fontSize="20" fill="#fff" textLength="150" lengthAdjust="spacingAndGlyphs">
        CAM-03 SERVER ROOM
      </text>
      <circle cx="198" cy="34" r="6" fill="#ff6b6b" />
      <text x="210" y="40" fontFamily={PIX} fontSize="20" fill="#fff" textLength="104" lengthAdjust="spacingAndGlyphs">
        REC 21:42:10
      </text>
      {/* enhance */}
      <path d="M300 96 L352 40" stroke="#ffd43b" strokeWidth="3" strokeDasharray="6 5" />
      <rect x="350" y="10" width="160" height="150" fill="#3a4049" stroke="#ffd43b" strokeWidth="4" />
      <g transform="translate(430 86)" shapeRendering="crispEdges">
        <rect x="-44" y="-52" width="88" height="96" fill="#d9b382" />
        <rect x="-44" y="-52" width="88" height="12" fill="#c49a66" />
        <rect x="-28" y="-20" width="16" height="16" fill="#1b1e23" />
        <rect x="12" y="-20" width="16" height="16" fill="#1b1e23" />
        <rect x="-20" y="16" width="8" height="8" fill="#1b1e23" />
        <rect x="-12" y="24" width="24" height="8" fill="#1b1e23" />
        <rect x="12" y="16" width="8" height="8" fill="#1b1e23" />
      </g>
      <text x="430" y="152" textAnchor="middle" fontFamily={PIX} fontSize="18" fill="#ffd43b">
        ENHANCE x8
      </text>
      <text x="430" y="184" textAnchor="middle" fontFamily={HAND} fontSize="14" fontWeight="700" fill="#ffd43b">
        ชัดขึ้น… แต่ก็ยังเป็นถุง
      </text>
      <text x="430" y="204" textAnchor="middle" fontFamily={HAND} fontSize="13" fill="#ced4da">
        (ถุงยิ้มด้วย)
      </text>
      {/* in/out explainer */}
      <rect x="10" y="242" width="500" height="108" fill="#fffdf5" stroke={INK} strokeWidth="3" />
      <text x="24" y="266" fontFamily={HAND} fontSize="15" fontWeight="700" fill={INK}>
        วิธีรู้ว่าใครอยู่ในห้อง ณ เวลาหนึ่ง (ตัวอย่างสมมติ)
      </text>
      <path d="M40 304 H480" stroke="#adb5bd" strokeWidth="4" />
      <path d="M130 304 H330" stroke="#2f9e44" strokeWidth="10" strokeLinecap="round" />
      <circle cx="130" cy="304" r="9" fill="#2f9e44" stroke={INK} strokeWidth="2" />
      <circle cx="330" cy="304" r="9" fill="#e03131" stroke={INK} strokeWidth="2" />
      <text x="130" y="288" textAnchor="middle" fontFamily={PIX} fontSize="18" fill={INK}>
        in 09:00
      </text>
      <text x="330" y="288" textAnchor="middle" fontFamily={PIX} fontSize="18" fill={INK}>
        out 09:30
      </text>
      <path d="M230 322 V310" stroke={INK} strokeWidth="3" />
      <text x="230" y="340" textAnchor="middle" fontFamily={HAND} fontSize="14" fontWeight="700" fill="#2f9e44">
        09:12 อยู่ระหว่างคู่นี้ = อยู่ในห้อง
      </text>
      <text x="420" y="340" textAnchor="middle" fontFamily={HAND} fontSize="14" fontWeight="700" fill="#c92a2a">
        09:45 = ออกไปแล้ว
      </text>
      <path d="M420 322 V310" stroke={INK} strokeWidth="3" />
    </Svg>
  );
}

export const CLUE_ART: Record<string, () => ReactNode> = {
  sign: Sign,
  memo: Memo,
  interview: Interview,
  syslog: Syslog,
  cctv: Cctv,
};
