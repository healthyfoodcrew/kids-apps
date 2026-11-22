import type { CSSProperties, ReactNode } from 'react';
import { EventIcon } from '../components/EventIcon';
import type { Countdown, CountdownTheme } from '../lib/types';

/** Theme names for the parent picker. */
export const COUNTDOWN_THEMES: { id: CountdownTheme; label: string }[] = [
  { id: 'party', label: 'Party' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'xmas', label: 'Christmas' },
  { id: 'japan', label: 'Japan' },
  { id: 'travel', label: 'Trip / flight' },
  { id: 'beach', label: 'Beach holiday' },
  { id: 'sport', label: 'Sport' },
  { id: 'plain', label: 'Plain' },
];

const TREE = (
  <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
    <path d="M24 3l2.2 4.5 5 .7-3.6 3.5.9 5L24 14.3l-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#FFC94A" />
    <path d="M24 13l9 10h-4l7 9h-5l7 9H10l7-9h-5l7-9h-4z" fill="#2FBF4F" />
    <rect x="21" y="41" width="6" height="5" rx="1" fill="#8A5A2B" />
    <circle cx="20" cy="26" r="1.8" fill="#FF5A5A" /><circle cx="28" cy="31" r="1.8" fill="#FFC94A" />
    <circle cx="19" cy="36" r="1.8" fill="#4FB8FF" /><circle cx="30" cy="38" r="1.8" fill="#FF5A5A" />
  </svg>
);

const FUJI = (
  <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
    <circle cx="35" cy="12" r="6" fill="#FF5A5A" />
    <path d="M4 38l12-18 5 6 5-4 14 16z" fill="#E8ECFF" />
    <path d="M6 30h36M9 34h30M13 30v14M35 30v14" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const ICONS: Record<CountdownTheme, ReactNode> = {
  xmas: TREE,
  japan: FUJI,
  travel: <EventIcon name="plane" size={34} color="#fff" />,
  beach: <EventIcon name="sun" size={34} color="#FFE08A" />,
  birthday: <EventIcon name="cake" size={34} color="#fff" />,
  party: <EventIcon name="star" size={34} color="#FFC94A" />,
  sport: <EventIcon name="ball" size={34} color="#fff" />,
  plain: <EventIcon name="star" size={34} color="#FFC94A" />,
};

const RING: Record<CountdownTheme, string> = {
  xmas: '#FF5A5A', japan: '#fff', travel: '#fff', beach: '#FFC94A', birthday: '#FFC94A', party: '#FF5AC8', sport: '#fff', plain: '#4FB8FF',
};

const CONFETTI = ['#FFC94A', '#FF5A5A', '#4FB8FF', '#2FBF4F', '#FF8CC0', '#B98CFF'];

/** The little scene behind each tile. */
function Scene({ theme }: { theme: CountdownTheme }) {
  const box = { className: 'cd-decor', viewBox: '0 0 400 140', preserveAspectRatio: 'xMidYMax slice', 'aria-hidden': true } as const;
  switch (theme) {
    case 'xmas':
      return (
        <svg {...box}>
          {[[30, 20], [90, 50], [150, 15], [210, 40], [270, 22], [330, 55], [380, 30], [60, 80], [240, 75], [360, 90]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 ? 1.8 : 2.6} fill="#fff" opacity="0.7" />
          ))}
          <path d="M0 112 Q90 92 180 110 T400 104 V140 H0z" fill="#E8F1FF" />
          <path d="M0 124 Q120 108 240 124 T400 120 V140 H0z" fill="#fff" />
          <path d="M352 104l-14 18h8l-12 14h36l-12-14h8z" fill="#1E8F3A" opacity="0.9" />
          <path d="M0 4 Q30 16 60 12 T120 8 T180 12 T240 8 T300 12 T360 8 T400 10" stroke="#2A2766" strokeWidth="1.2" fill="none" />
          {[[10, '#FF5A5A'], [60, '#FFC94A'], [110, '#4FB8FF'], [160, '#2FBF4F'], [210, '#FF5A5A'], [260, '#FFC94A'], [310, '#4FB8FF'], [360, '#2FBF4F']].map(([x, c], i) => (
            <circle key={`l${i}`} cx={x as number} cy={i % 2 ? 12 : 8} r="3.2" fill={c as string} />
          ))}
        </svg>
      );
    case 'japan':
      return (
        <svg {...box}>
          <circle cx="300" cy="62" r="34" fill="#FFE08A" opacity="0.9" />
          <path d="M170 140 L290 52 Q300 46 310 52 L430 140z" fill="#5B4B8A" />
          <path d="M268 68 L290 52 Q300 46 310 52 L332 68 L318 64 L306 72 L296 63 L282 71z" fill="#fff" />
          <path d="M0 126 Q100 112 200 128 T400 122 V140 H0z" fill="#3B2C6E" />
          <path d="M0 0 Q40 18 70 14 T130 30" stroke="#5A3A2A" strokeWidth="4" fill="none" strokeLinecap="round" />
          {[[22, 8], [44, 16], [66, 14], [90, 22], [112, 28], [36, 26], [80, 32]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-3.2" rx="2.4" ry="3.4" transform={`rotate(${a})`} fill="#FFB7D5" />)}
              <circle r="1.4" fill="#E5487A" />
            </g>
          ))}
        </svg>
      );
    case 'travel':
      return (
        <svg {...box}>
          {[[60, 40, 1], [250, 26, 0.8], [350, 90, 1.2], [150, 105, 0.9]].map(([x, y, sc], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${sc})`} fill="#fff" opacity="0.85">
              <ellipse cx="0" cy="0" rx="26" ry="10" /><ellipse cx="-10" cy="-7" rx="12" ry="10" /><ellipse cx="10" cy="-9" rx="14" ry="12" />
            </g>
          ))}
          <path d="M210 70 Q280 40 360 50" stroke="#fff" strokeWidth="2" strokeDasharray="4 6" fill="none" opacity="0.8" />
          <g transform="translate(362 48) rotate(-12)" fill="#fff">
            <path d="M-18 0 L16 -3 Q22 -2 22 0 Q22 2 16 3 L-18 0z" />
            <path d="M0 -2 L-8 -14 L-3 -14 L8 -2z M0 2 L-8 14 L-3 14 L8 2z M-16 -1 L-20 -7 L-17 -7 L-12 -1z" />
          </g>
        </svg>
      );
    case 'beach':
      return (
        <svg {...box}>
          <circle cx="330" cy="40" r="26" fill="#FFE08A" />
          <path d="M0 96 Q50 88 100 96 T200 96 T300 96 T400 96 V140 H0z" fill="#2FA3E6" />
          <path d="M0 106 Q50 98 100 106 T200 106 T300 106 T400 106" stroke="#BFE9FF" strokeWidth="3" fill="none" />
          <path d="M0 122 Q140 108 400 120 V140 H0z" fill="#F7D79B" />
          <path d="M360 124 Q356 96 368 76" stroke="#8A5A2B" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M368 76 q-20 -6 -30 6 M368 76 q18 -10 30 0 M368 76 q-6 -18 -22 -18 M368 76 q8 -18 24 -14" stroke="#2FBF4F" strokeWidth="6" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'birthday':
      return (
        <svg {...box}>
          {[[290, 40, '#FF5A5A'], [330, 28, '#FFC94A'], [370, 46, '#4FB8FF'], [250, 54, '#2FBF4F']].map(([x, y, c], i) => (
            <g key={i}>
              <path d={`M${x} ${(y as number) + 18} q-6 30 4 60`} stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" fill="none" />
              <ellipse cx={x as number} cy={y as number} rx="15" ry="18" fill={c as string} />
              <ellipse cx={(x as number) - 5} cy={(y as number) - 6} rx="4" ry="6" fill="#fff" opacity="0.35" />
            </g>
          ))}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={(i * 53) % 400} y={(i * 37) % 130} width="5" height="9" rx="1" fill={CONFETTI[i % 6]} transform={`rotate(${i * 33} ${(i * 53) % 400} ${(i * 37) % 130})`} opacity="0.85" />
          ))}
        </svg>
      );
    case 'party':
      return (
        <svg {...box}>
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={(i * 47) % 400} y={(i * 29) % 140} width="5" height="10" rx="1" fill={CONFETTI[i % 6]} transform={`rotate(${i * 41} ${(i * 47) % 400} ${(i * 29) % 140})`} opacity="0.9" />
          ))}
          <path d="M0 6 Q50 30 100 10 T200 14 T300 8 T400 18" stroke="#FFC94A" strokeWidth="4" fill="none" />
          <path d="M0 18 Q60 0 120 22 T240 16 T400 4" stroke="#FF5AC8" strokeWidth="4" fill="none" />
          <g transform="translate(348 96)">
            <circle r="26" fill="#C9D2FF" />
            <path d="M-26 0H26M0 -26V26M-18 -18L18 18M18 -18L-18 18" stroke="#8E97C8" strokeWidth="1.5" />
          </g>
        </svg>
      );
    case 'sport':
      return (
        <svg {...box}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 50} y="0" width="25" height="140" fill="#fff" opacity="0.06" />)}
          <path d="M0 110 H400" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
          <circle cx="320" cy="110" r="22" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
          <path d="M260 20 v40 h70 v-40" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" />
          <circle cx="362" cy="84" r="14" fill="#fff" />
          <path d="M362 76 l6 4 -2 7 h-8 l-2 -7z" fill="#1d1a52" />
        </svg>
      );
    default:
      return null;
  }
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function chipText(days: number, theme: CountdownTheme) {
  if (days === 0) return theme === 'xmas' ? 'MERRY CHRISTMAS!' : theme === 'birthday' ? 'HAPPY BIRTHDAY!' : "IT'S TODAY!";
  if (days === 1) return '1 MORE SLEEP!';
  const weeks = Math.floor(days / 7);
  return weeks >= 2 ? `${weeks} WEEKS${days % 7 ? ` ${days % 7} DAYS` : ''}` : `${days} SLEEPS TO GO!`;
}

/** One countdown tile (also used for the theme previews in Setup). */
export function CountdownTile({ c, today }: { c: Pick<Countdown, 'title' | 'day' | 'theme' | 'note'>; today: string }) {
  const days = Math.max(0, daysBetween(today, c.day));
  const fraction = Math.max(0.04, Math.min(1, 1 - days / 100)); // fills up as the day gets closer
  const C = 2 * Math.PI * 46;
  return (
    <section className={`panel countdown-tile themed cd-${c.theme}`} style={{ '--cd': RING[c.theme] } as CSSProperties} aria-label={`${c.title}: ${days} days to go`}>
      <Scene theme={c.theme} />
      <div className="cd-ring">
        <svg viewBox="0 0 108 108" aria-hidden="true">
          <circle cx="54" cy="54" r="46" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="12" />
          <circle cx="54" cy="54" r="46" fill="none" stroke={RING[c.theme]} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} transform="rotate(-90 54 54)" />
        </svg>
        <div className="cd-centre">
          {days === 0 ? <span className="cd-num" style={{ fontSize: 30 }}>🎉</span> : <span className="cd-num">{days}</span>}
          <span className="cd-unit">{days === 0 ? 'TODAY' : days === 1 ? 'DAY' : 'DAYS'}</span>
        </div>
      </div>
      <div className="cd-text">
        <div className="cd-head">
          <span className="cd-icon">{ICONS[c.theme]}</span>
          <h3>{c.title.toUpperCase()}</h3>
        </div>
        {c.note && <span className="cd-date">{c.note}</span>}
        <span className="cd-chip">{chipText(days, c.theme)}</span>
      </div>
    </section>
  );
}

/** Countdowns coming up soon, on the home screen (up to 4, two per row, soonest first). */
export function Countdowns({ countdowns, today }: { countdowns: Countdown[]; today: string }) {
  const shown = countdowns
    .filter((c) => today <= c.day && daysBetween(today, c.day) <= c.show_days)
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <div className="countdowns" style={{ gridTemplateColumns: `repeat(${Math.min(2, shown.length)}, minmax(0, 1fr))` }}>
      {shown.map((c) => <CountdownTile key={c.id} c={c} today={today} />)}
    </div>
  );
}
