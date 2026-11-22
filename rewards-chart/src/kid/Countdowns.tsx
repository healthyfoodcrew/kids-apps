import type { CSSProperties, ReactNode } from 'react';

// Big family countdowns on the home screen. Each one shows from `showFrom` until its day.
export type Theme = 'xmas' | 'japan';
export type Look = 'a' | 'b';

/** Decorative background layer for a themed tile. */
function Decor({ theme, look }: { theme: Theme; look: Look }) {
  if (theme === 'xmas' && look === 'a') {
    const flakes = [[8, 18, 9], [30, 70, 6], [62, 12, 7], [80, 55, 10], [92, 20, 6], [48, 85, 5], [70, 88, 7], [18, 50, 5]];
    return (
      <svg className="cd-decor" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {flakes.map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y})`} stroke="#fff" strokeOpacity="0.35" strokeWidth="0.6" strokeLinecap="round">
            <path d={`M0 ${-r / 3}V${r / 3}M${-r / 3} 0H${r / 3}M${-r / 4.2} ${-r / 4.2}L${r / 4.2} ${r / 4.2}M${r / 4.2} ${-r / 4.2}L${-r / 4.2} ${r / 4.2}`} />
          </g>
        ))}
      </svg>
    );
  }
  if (theme === 'xmas') {
    return (
      <svg className="cd-decor" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {[[30, 20], [90, 50], [150, 15], [210, 40], [270, 22], [330, 55], [380, 30], [60, 80], [240, 75], [360, 90]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 1.8 : 2.6} fill="#fff" opacity="0.7" />
        ))}
        <path d="M0 112 Q90 92 180 110 T400 104 V140 H0z" fill="#E8F1FF" />
        <path d="M0 124 Q120 108 240 124 T400 120 V140 H0z" fill="#fff" />
        <path d="M352 104l-14 18h8l-12 14h36l-12-14h8z" fill="#1E8F3A" opacity="0.9" />
        {[[10, 6, '#FF5A5A'], [60, 10, '#FFC94A'], [110, 6, '#4FB8FF'], [160, 10, '#2FBF4F'], [210, 6, '#FF5A5A'], [260, 10, '#FFC94A'], [310, 6, '#4FB8FF'], [360, 10, '#2FBF4F']].map(([x, y, c], i) => (
          <circle key={`l${i}`} cx={x as number} cy={(y as number) + 2} r="3.2" fill={c as string} />
        ))}
        <path d="M0 4 Q30 16 60 12 T120 8 T180 12 T240 8 T300 12 T360 8 T400 10" stroke="#2A2766" strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  if (look === 'a') {
    const petals = [[40, 24], [110, 112], [190, 18], [250, 96], [330, 120], [160, 70], [380, 70], [70, 80]];
    return (
      <svg className="cd-decor" viewBox="0 0 400 140" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
        <circle cx="360" cy="34" r="46" fill="#E5484D" opacity="0.9" />
        {petals.map(([x, y], i) => (
          <path key={i} transform={`translate(${x} ${y}) rotate(${i * 47}) scale(2.2 1.5)`} d="M0 -3 C2 -3 3 -1 2 1 L0 3 L-2 1 C-3 -1 -2 -3 0 -3z" fill="#FFB7D5" opacity="0.85" />
        ))}
      </svg>
    );
  }
  return (
    <svg className="cd-decor" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle cx="300" cy="62" r="34" fill="#FFE08A" opacity="0.9" />
      <path d="M170 140 L290 52 Q300 46 310 52 L430 140z" fill="#5B4B8A" />
      <path d="M268 68 L290 52 Q300 46 310 52 L332 68 L318 64 L306 72 L296 63 L282 71z" fill="#fff" />
      <path d="M0 126 Q100 112 200 128 T400 122 V140 H0z" fill="#3B2C6E" />
      <path d="M0 0 Q40 18 70 14 T130 30" stroke="#5A3A2A" strokeWidth="4" fill="none" strokeLinecap="round" />
      {[[22, 8], [44, 16], [66, 14], [90, 22], [112, 28], [36, 26], [80, 32]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-3.2" rx="2.4" ry="3.4" transform={`rotate(${a})`} fill="#FFB7D5" />
          ))}
          <circle r="1.4" fill="#E5487A" />
        </g>
      ))}
    </svg>
  );
}

type Countdown = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  showFrom: string;
  color: string;
  glow: string;
  icon: ReactNode;
  dayText: string;
  todayText: string;
};

const TREE = (
  <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
    <path d="M24 3l2.2 4.5 5 .7-3.6 3.5.9 5L24 14.3l-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#FFC94A" />
    <path d="M24 13l9 10h-4l7 9h-5l7 9H10l7-9h-5l7-9h-4z" fill="#2FBF4F" />
    <rect x="21" y="41" width="6" height="5" rx="1" fill="#8A5A2B" />
    <circle cx="20" cy="26" r="1.8" fill="#FF5A5A" /><circle cx="28" cy="31" r="1.8" fill="#FFC94A" />
    <circle cx="19" cy="36" r="1.8" fill="#4FB8FF" /><circle cx="30" cy="38" r="1.8" fill="#FF5A5A" />
  </svg>
);

const JAPAN = (
  <svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true">
    <circle cx="35" cy="12" r="6" fill="#FF5A5A" />
    <path d="M4 38l12-18 5 6 5-4 14 16z" fill="#E8ECFF" />
    <path d="M16 20l-4 6h3l1.5-2 1.5 2.2 1.8-2.2 1.7 0z" fill="#fff" />
    <path d="M6 30h36M9 34h30" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" />
    <path d="M13 30v14M35 30v14" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" />
    <path d="M24 30v4" stroke="#E5484D" strokeWidth="2" />
  </svg>
);

const COUNTDOWNS: Countdown[] = [
  {
    id: 'xmas',
    title: 'CHRISTMAS',
    date: '2026-12-25',
    showFrom: '2026-10-01',
    color: '#FF5A5A',
    glow: '#2FBF4F',
    icon: TREE,
    dayText: 'Friday 25 December',
    todayText: 'MERRY CHRISTMAS!',
  },
  {
    id: 'japan',
    title: 'JAPAN TRIP',
    date: '2026-12-30',
    showFrom: '2026-10-01',
    color: '#FF7AB6',
    glow: '#E5484D',
    icon: JAPAN,
    dayText: 'We leave Wed 30 December',
    todayText: 'TODAY! HAVE AN AMAZING TRIP!',
  },
];

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function Countdowns({ today, look }: { today: string; look?: Look }) {
  const shown = COUNTDOWNS.filter((c) => today >= c.showFrom && today <= c.date);
  if (shown.length === 0) return null;
  const C = 2 * Math.PI * 46;
  return (
    <div className="countdowns">
      {shown.map((c) => {
        const days = daysBetween(today, c.date);
        const fraction = Math.max(0.04, Math.min(1, 1 - days / 100)); // fills up as the day gets closer
        const weeks = Math.floor(days / 7);
        return (
          <section key={c.id} className={`panel countdown-tile${look ? ` themed ${c.id}-${look}` : ''}`} style={{ '--cd': c.color, '--cd-glow': c.glow } as CSSProperties} aria-label={`${c.title}: ${days} days to go`}>
            {look && <Decor theme={c.id as Theme} look={look} />}
            <div className="cd-ring">
              <svg viewBox="0 0 108 108" aria-hidden="true">
                <circle cx="54" cy="54" r="46" fill="none" stroke="#2A2766" strokeWidth="12" />
                <circle
                  cx="54" cy="54" r="46" fill="none" stroke={c.color} strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} transform="rotate(-90 54 54)"
                />
              </svg>
              <div className="cd-centre">
                {days === 0 ? <span className="cd-num" style={{ fontSize: 30 }}>🎉</span> : <span className="cd-num">{days}</span>}
                <span className="cd-unit">{days === 0 ? 'TODAY' : days === 1 ? 'DAY' : 'DAYS'}</span>
              </div>
            </div>
            <div className="cd-text">
              <div className="cd-head">
                <span className="cd-icon">{c.icon}</span>
                <h3>{c.title}</h3>
              </div>
              <span className="cd-date">{c.dayText}</span>
              <span className="cd-chip">
                {days === 0 ? c.todayText : days === 1 ? '1 MORE SLEEP!' : weeks >= 2 ? `${weeks} WEEKS ${days % 7 ? `${days % 7} DAYS` : ''}`.trim() : `${days} SLEEPS TO GO!`}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
