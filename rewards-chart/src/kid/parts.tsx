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
