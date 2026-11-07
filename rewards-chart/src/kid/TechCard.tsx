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
 * Morning jobs have to be done before it can start.
 */
export function TechCard({
  s,
  settings,
  busy,
  onStart,
  onStop,
}: {
  s: KidSummary;
  settings: Settings;
  busy: boolean;
  onStart(): void;
  onStop(): void;
}) {
  const t = s.tech;
  const mins = Math.floor(t.remainingSeconds / 60);
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
        <div className="note">Unlocks {dayName} morning. Earn more with bonus jobs!</div>
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
        <div className="countdown" role="timer" aria-label={`${mins} minutes left this week`}>{clock(t.remainingSeconds)}</div>
        <div className="note">left this week</div>
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
        <span className="status">{paused ? 'PAUSED' : 'READY'}</span>
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
      ) : (
        <button className={`t-btn ${paused ? 'resume' : 'start'}`} onClick={onStart} disabled={busy}>
          <Icon d={PLAY} size={22} filled />{paused ? 'RESUME' : 'START'}
        </button>
      )}
    </section>
  );
}
