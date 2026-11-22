import type { CSSProperties, ReactNode } from 'react';

// Big family countdowns on the home screen. Each one shows from `showFrom` until its day.
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

export function Countdowns({ today }: { today: string }) {
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
          <section key={c.id} className="panel countdown-tile" style={{ '--cd': c.color, '--cd-glow': c.glow } as CSSProperties} aria-label={`${c.title}: ${days} days to go`}>
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
