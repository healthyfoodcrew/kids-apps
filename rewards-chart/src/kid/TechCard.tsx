import { useState } from 'react';
import { Icon, UI_ICONS } from '../components/Icon';
import type { KidSummary } from '../lib/calc';
import { banEndText, localParts } from '../lib/time';
import type { Settings } from '../lib/types';

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const PLAY = 'M7 4l13 8-13 8z';
const PAUSE = 'M7 4h4v16H7z M13 4h4v16h-4z';

/**
 * Tech time: locked on school days; on weekends a start/pause countdown of the week's minutes.
 * Morning jobs have to be done, then Mum or Dad says yes (once each day), before it can start.
 */
export function TechCard({
  s,
  settings,
  busy,
  onStart,
  onStop,
  onAsk,
}: {
  s: KidSummary;
  settings: Settings;
  busy: boolean;
  onStart(seconds: number): void;
  onStop(): void;
  onAsk(): void;
}) {
  const t = s.tech;
  const mins = Math.floor(t.remainingSeconds / 60);
  const [picking, setPicking] = useState(false);
  const log = (
    <div className="log">
      {t.earned > 0 && <span className="plus">+{t.earned} min from bonus jobs</span>}
      {t.given > 0 && <span className="plus">+{t.given} min from Mum or Dad</span>}
      {t.takenReasons.slice(0, 1).map((a) => (
        <span key={a.id} className="minus">−{Math.abs(a.amount)} min{a.reason ? `: ${a.reason}` : ''}</span>
      ))}
    </div>
  );

  if (t.ban) {
    return (
      <section className="panel tech dead area-tech" aria-label="Tech time banned">
        <div className="row">
          <span className="title"><Icon d={UI_ICONS.gamepad} size={24} strokeWidth={1.9} />TECH TIME</span>
          <span className="status">BANNED</span>
        </div>
        <div className="dead-title">TECH TIME DEAD</div>
        <div className="log">
          <span className="until">Banned {banEndText(t.ban.until, settings.timezone)}</span>
          {t.ban.reason && <span className="minus">Reason: {t.ban.reason}</span>}
        </div>
      </section>
    );
  }

  if (!t.weekend) {
    const wd = localParts(new Date(), settings.timezone).weekday;
    const nextFree = [6, 7, 1, 2, 3, 4, 5].find((d) => !settings.school_days.includes(d) && d > wd) ?? 6;
    const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][nextFree - 1];
    return (
      <section className="panel tech t-locked area-tech" aria-label="Tech time, weekends only">
        <div className="row">
          <span className="title"><Icon d={UI_ICONS.lock} size={22} strokeWidth={2.2} />TECH TIME</span>
          <span className="status">WEEKENDS ONLY</span>
        </div>
        <div className="mins"><span className="big">{mins}</span><span className="unit">MIN SAVED</span></div>
        <div className="note">Opens {dayName} once Mum or Dad says yes. Earn more with bonus jobs!</div>
        {log}
      </section>
    );
  }

  if (t.running) {
    return (
      <section className="panel tech t-running area-tech" aria-label="Tech time running">
        <div className="row">
          <span className="title">TECH TIME</span>
          <span className="status"><span className="live-dot" />ON NOW</span>
        </div>
        <div className="countdown" role="timer" aria-label={`${Math.ceil(t.sessionLeft / 60)} minutes left of this go`}>{clock(t.sessionLeft)}</div>
        <div className="note">{mins} min left this week</div>
        <button className="t-btn pause" onClick={onStop} disabled={busy}><Icon d={PAUSE} size={22} filled />PAUSE</button>
      </section>
    );
  }

  if (t.remainingSeconds <= 0) {
    return (
      <section className="panel tech t-locked area-tech" aria-label="Tech time used up">
        <div className="row">
          <span className="title">TECH TIME</span>
          <span className="status">ALL USED</span>
        </div>
        <div className="dead-title" style={{ color: '#FFC94A', textShadow: 'none' }}>TIME'S UP!</div>
        <div className="note">Starts again on Monday. Bonus jobs earn extra minutes!</div>
      </section>
    );
  }

  const morningLeft = s.totalCount - s.doneCount;
  const paused = t.usedSeconds > 0;
  return (
    <section className={`panel tech ${paused ? 't-paused' : 't-ready'} area-tech`} aria-label="Tech time ready">
      <div className="row">
        <span className="title">TECH TIME</span>
        <span className="status">{t.approval !== 'approved' && morningLeft === 0 ? 'NEEDS A YES' : paused ? 'PAUSED' : 'READY'}</span>
      </div>
      {paused ? (
        <>
          <div className="countdown">{clock(t.remainingSeconds)}</div>
          <div className="note">left this week</div>
        </>
      ) : (
        <div className="mins"><span className="big">{mins}</span><span className="unit">MIN LEFT</span></div>
      )}
      {morningLeft > 0 ? (
        <button className="t-btn wait" disabled>
          <Icon d={UI_ICONS.lock} size={20} />DO {morningLeft} MORNING {morningLeft === 1 ? 'JOB' : 'JOBS'} FIRST
        </button>
      ) : t.approval === 'none' ? (
        <button className="t-btn ask" onClick={onAsk} disabled={busy}>
          <Icon d={UI_ICONS.lock} size={20} />ASK MUM OR DAD
        </button>
      ) : t.approval === 'requested' ? (
        <button className="t-btn wait asked" disabled>
          <span className="live-dot" />WAITING FOR A YES…
        </button>
      ) : (
        <button className={`t-btn ${paused ? 'resume' : 'start'}`} onClick={() => setPicking(true)} disabled={busy}>
          <Icon d={PLAY} size={22} filled />{paused ? 'PLAY MORE' : 'START'}
        </button>
      )}
      {picking && (
        <TimePicker
          maxSeconds={t.remainingSeconds}
          onPick={(secs) => {
            setPicking(false);
            onStart(secs);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}

const CHOICES = [10, 15, 20, 30, 45, 60, 90, 120];

function niceTime(mins: number): string {
  if (mins < 60) return `${mins} MIN`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} HR ${m} MIN` : `${h} ${h === 1 ? 'HOUR' : 'HOURS'}`;
}

/** "How long do you want to play?": any amount up to what's left this week. */
function TimePicker({ maxSeconds, onPick, onClose }: { maxSeconds: number; onPick(seconds: number): void; onClose(): void }) {
  const maxMins = Math.floor(maxSeconds / 60);
  const options = CHOICES.filter((m) => m < maxMins);
  // Pick-your-own, in 5 minute steps (e.g. 1 hr 15 min).
  const [custom, setCustom] = useState(Math.min(75, maxMins));
  const step = (d: number) => setCustom((c) => Math.max(5, Math.min(maxMins, (Math.round(c / 5) + d) * 5)));
  return (
    <div className="tp-overlay" role="dialog" aria-label="How long do you want to play?" onClick={onClose}>
      <div className="tp-card" onClick={(e) => e.stopPropagation()}>
        <h3>HOW LONG DO YOU WANT TO PLAY?</h3>
        <p className="tp-sub">You have {maxMins >= 60 ? `${Math.floor(maxMins / 60)} hr ${maxMins % 60 ? `${maxMins % 60} min` : ''}` : `${maxMins} min`} left this week</p>
        <div className="tp-grid">
          {options.map((m) => (
            <button key={m} className="tp-opt" onClick={() => onPick(m * 60)}>
              <b>{m >= 60 && m % 60 === 0 ? m / 60 : m}</b>
              <span>{m >= 60 && m % 60 === 0 ? (m === 60 ? 'HOUR' : 'HOURS') : 'MIN'}</span>
            </button>
          ))}
          <button className="tp-opt all" onClick={() => onPick(maxSeconds)}>
            <b>ALL</b>
            <span>{maxMins} MIN</span>
          </button>
        </div>
        <div className="tp-custom">
          <span className="tp-custom-label">OR PICK YOUR OWN</span>
          <div className="tp-stepper">
            <button onClick={() => step(-1)} disabled={custom <= 5} aria-label="5 minutes less">−</button>
            <span className="tp-amount">{niceTime(custom)}</span>
            <button onClick={() => step(1)} disabled={custom >= maxMins} aria-label="5 minutes more">+</button>
            <button className="tp-go" onClick={() => onPick(custom * 60)}>GO</button>
          </div>
        </div>
        <button className="tp-cancel" onClick={onClose}>NOT NOW</button>
      </div>
    </div>
  );
}
