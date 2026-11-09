import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Icon, UI_ICONS } from '../components/Icon';
import type { TimerState } from '../lib/calc';
import type { Settings } from '../lib/types';
import { formatClock } from '../lib/time';

export const TILE_COLORS = ['#5BD45B', '#4FB8FF', '#B98CFF', '#FFA53D'];

const PHASE_COLOR: Record<TimerState['phase'], string> = {
  bonus: '#5BD45B',
  move: '#FFC94A',
  closing: '#FF6B6B',
  go: '#FF6B6B',
  none: '#3A3680',
};

export function TimerCard({ timer, settings, speedDone }: { timer: TimerState; settings: Settings; speedDone: boolean }) {
  if (timer.phase === 'none') {
    return (
      <section className="panel timer off area-timer" aria-label="School countdown">
        <Icon d={UI_ICONS.gamepad} size={52} />
        <div className="display" style={{ fontSize: 26 }}>
          {timer.schoolDay ? 'SEE YOU AFTER SCHOOL' : 'NO SCHOOL TODAY'}
        </div>
        <div className="hint">{timer.schoolDay ? 'Have a great day!' : 'Quests still earn stars today.'}</div>
      </section>
    );
  }

  const color = speedDone ? PHASE_COLOR.bonus : PHASE_COLOR[timer.phase];
  const mins = Math.ceil(timer.secondsLeft / 60);
  const underMinute = timer.secondsLeft > 0 && timer.secondsLeft < 60;
  const toBonusEnd = Math.max(1, mins - settings.speed_bonus_minutes);
  let chip = '';
  let hint = '';
  if (speedDone) {
    chip = `SPEEDY! +${settings.speed_bonus_stars} STARS`;
    hint = 'Done with time to spare. Legend!';
  } else if (timer.phase === 'bonus') {
    chip = 'BONUS TIME!';
    hint = `Finish in ${toBonusEnd} min for +${settings.speed_bonus_stars} stars`;
  } else if (timer.phase === 'move') {
    chip = 'HURRY UP!';
    hint = 'Bonus time is over. Beat the bell!';
  } else if (timer.phase === 'closing') {
    chip = 'GO GO GO!';
    hint = 'Shoes on, bag at the door!';
  } else {
    chip = 'TIME TO GO!';
    hint = `Leave at ${formatClock(settings.leave_time)}`;
  }

  const C = 2 * Math.PI * 56;
  return (
    <section className="panel timer area-timer" style={{ '--phase': color } as CSSProperties} aria-label="School countdown">
      <div className="display" style={{ fontSize: 20 }}>SCHOOL TIME IN</div>
      <div className="timer-ring">
        <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
          <circle cx="66" cy="66" r="56" fill="none" stroke="#2A2766" strokeWidth="14" />
          <circle
            cx="66" cy="66" r="56" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - timer.fraction)} transform="rotate(-90 66 66)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="centre" role="timer" aria-label={`${mins} minutes until leaving for school`}>
          <span className="mins">{underMinute ? timer.secondsLeft : mins}</span>
          <span className="unit">{underMinute ? 'SEC' : 'MIN'}</span>
        </div>
      </div>
      <span className="phase-chip">{chip}</span>
      <span className="hint">{hint}</span>
    </section>
  );
}

/**
 * Pocket money as a step tracker: one circle per dollar joined by a line.
 * Dollars already earned turn green with a tick, the next dollar is highlighted
 * with its star progress, dollars taken away are marked, and the last one is payday.
 */
export function RewardTrack({
  total,
  filled,
  earnedFromStars,
  starsInto,
  starsPerDollar,
  color,
}: {
  total: number;
  filled: number;
  earnedFromStars: number;
  starsInto: number;
  starsPerDollar: number;
  color: string;
}) {
  const steps = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    let state: 'done' | 'taken' | 'current' | 'todo';
    if (n <= filled) state = 'done';
    else if (n <= earnedFromStars) state = 'taken';
    else if (n === earnedFromStars + 1) state = 'current';
    else state = 'todo';
    return { n, state };
  });
  const partial = Math.max(0, Math.min(1, starsInto / starsPerDollar));

  return (
    <div className="steps" style={{ '--kid': color } as CSSProperties} role="list" aria-label="Pocket money steps">
      {steps.map((st, i) => {
        // Line leading into this step: full if this step is reached, partly full if it's the next one.
        const fill = st.state === 'done' || st.state === 'taken' ? 1 : st.state === 'current' ? partial : 0;
        const label =
          st.state === 'done' ? 'earned' : st.state === 'taken' ? 'taken away' : st.state === 'current' ? `${starsInto} of ${starsPerDollar} stars` : 'still to earn';
        return (
          <div key={st.n} className={`step ${st.state}${st.n === total ? ' last' : ''}`} role="listitem" aria-label={`$${st.n}: ${label}`}>
            {i > 0 && (
              <span className="step-line" aria-hidden="true">
                <span style={{ width: `${Math.round(fill * 100)}%` }} />
              </span>
            )}
            <span className="step-dot">
              {st.state === 'done' ? (
                <Icon d={UI_ICONS.check} size={22} strokeWidth={3.6} />
              ) : st.state === 'taken' ? (
                <Icon d={UI_ICONS.minus} size={20} strokeWidth={3.6} />
              ) : (
                <>${st.n}</>
              )}
            </span>
            <span className="step-label">
              {st.state === 'current' ? `${starsInto}/${starsPerDollar}` : st.state === 'taken' ? 'TAKEN' : st.n === total ? 'PAYDAY' : `$${st.n}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const STAR_PATH = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

/** Weekly star reward track: each step shows the tech minutes that many stars are worth. */
export function StarTrack({ stars, milestones, color }: { stars: number; milestones: { stars: number; minutes: number }[]; color: string }) {
  return (
    <div className="steps star-steps" style={{ '--kid': color } as CSSProperties} role="list" aria-label="Star reward track">
      {milestones.map((m, i) => {
        const prev = i === 0 ? 0 : milestones[i - 1].stars;
        const done = stars >= m.stars;
        const current = !done && stars >= prev;
        const fill = done ? 1 : current ? Math.max(0, (stars - prev) / (m.stars - prev)) : 0;
        return (
          <div key={m.stars} className={`step ${done ? 'done' : current ? 'current' : 'todo'}${i === milestones.length - 1 ? ' last' : ''}`} role="listitem" aria-label={`${m.stars} stars: +${m.minutes} minutes${done ? ', unlocked' : ''}`}>
            {i > 0 && (
              <span className="step-line" aria-hidden="true">
                <span style={{ width: `${Math.round((i === 0 ? 0 : fill) * 100)}%` }} />
              </span>
            )}
            <span className="step-dot">{done ? <Icon d={UI_ICONS.check} size={22} strokeWidth={3.6} /> : <Icon d={STAR_PATH} size={22} filled />}</span>
            <span className="step-label">{m.stars}★<br />+{m.minutes} MIN</span>
          </div>
        );
      })}
    </div>
  );
}

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.8,
        color: ['#FFC94A', '#5BD45B', '#4FB8FF', '#B98CFF', '#FF6B6B', '#2EE6D6'][i % 6],
        rotate: Math.random() * 360,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/** A friendly cartoon dog face, drawn in code (no image files needed). */
export function DogFace({ size = 72, happy = false }: { size?: number; happy?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {/* ears */}
      <path d="M18 30 C6 34 6 62 16 70 C24 62 28 46 30 34 Z" fill="#7A4A2A" />
      <path d="M82 30 C94 34 94 62 84 70 C76 62 72 46 70 34 Z" fill="#7A4A2A" />
      {/* head */}
      <ellipse cx="50" cy="52" rx="32" ry="30" fill="#C98B55" />
      {/* face patch */}
      <ellipse cx="50" cy="64" rx="18" ry="14" fill="#F2D3B0" />
      {/* eyes */}
      {happy ? (
        <>
          <path d="M33 46 q5 -6 10 0" stroke="#2B1A10" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M57 46 q5 -6 10 0" stroke="#2B1A10" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="38" cy="46" r="5" fill="#2B1A10" />
          <circle cx="62" cy="46" r="5" fill="#2B1A10" />
          <circle cx="39.5" cy="44.5" r="1.6" fill="#fff" />
          <circle cx="63.5" cy="44.5" r="1.6" fill="#fff" />
        </>
      )}
      {/* nose + mouth */}
      <ellipse cx="50" cy="58" rx="6" ry="4.5" fill="#2B1A10" />
      <path d="M50 62 v4 M50 66 q-6 5 -10 1 M50 66 q6 5 10 1" stroke="#2B1A10" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* tongue */}
      <path d="M46 69 q4 9 8 0 z" fill="#FF7A8A" />
    </svg>
  );
}

const PAW = 'M12 13c-2.5 0-4.5 2-4.5 4 0 1.5 1.5 2.5 4.5 2.5s4.5-1 4.5-2.5c0-2-2-4-4.5-4z M6.5 11a1.8 2.2 0 1 0 0 .01 M17.5 11a1.8 2.2 0 1 0 0 .01 M9.5 7a1.8 2.2 0 1 0 0 .01 M14.5 7a1.8 2.2 0 1 0 0 .01';

export function PawPrint({ size = 18, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={style}>
      <path d={PAW} fill="currentColor" />
    </svg>
  );
}

/** Bruno sitting, with his red collar: used on the pet card. */
export function DogSitting({ width = 120, happy = false }: { width?: number; happy?: boolean }) {
  return (
    <svg width={width} height={width * 1.25} viewBox="0 -10 100 140" aria-hidden="true">
      <ellipse cx="50" cy="104" rx="30" ry="22" fill="#C98B55" />
      <ellipse cx="50" cy="108" rx="14" ry="12" fill="#F2D3B0" />
      <rect x="30" y="80" width="40" height="8" rx="4" fill="#E5484D" />
      <circle cx="50" cy="90" r="5" fill="#FFD66B" />
      <path d="M18 30 C6 34 6 62 16 70 C24 62 28 46 30 34 Z" fill="#7A4A2A" />
      <path d="M82 30 C94 34 94 62 84 70 C76 62 72 46 70 34 Z" fill="#7A4A2A" />
      <ellipse cx="50" cy="52" rx="32" ry="30" fill="#C98B55" />
      <ellipse cx="50" cy="64" rx="18" ry="14" fill="#F2D3B0" />
      {happy ? (
        <path d="M33 46 q5 -6 10 0 M57 46 q5 -6 10 0" stroke="#2B1A10" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="38" cy="46" r="5" fill="#2B1A10" />
          <circle cx="62" cy="46" r="5" fill="#2B1A10" />
          <circle cx="39.5" cy="44.5" r="1.6" fill="#fff" />
          <circle cx="63.5" cy="44.5" r="1.6" fill="#fff" />
        </>
      )}
      <ellipse cx="50" cy="58" rx="6" ry="4.5" fill="#2B1A10" />
      <path d="M50 62 v4 M50 66 q-6 5 -10 1 M50 66 q6 5 10 1" stroke="#2B1A10" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M46 69 q4 9 8 0 z" fill="#FF7A8A" />
    </svg>
  );
}

export function Bone({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9a3 3 0 1 1 3-3l6 6a3 3 0 1 1 3 3 3 3 0 1 1-3 3l-6-6a3 3 0 1 1-3-3z" fill="currentColor" />
    </svg>
  );
}
