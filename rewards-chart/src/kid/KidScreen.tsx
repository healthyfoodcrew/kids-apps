import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { KidAvatar } from '../components/KidAvatar';
import { summarizeKid, timerState } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { banEndText, formatMoneyShort, localParts } from '../lib/time';
import type { Job } from '../lib/types';
import { Confetti, RewardTrack, TILE_COLORS, TimerCard } from './parts';

export function KidScreen() {
  const { kidId } = useParams();
  const { data, loading, toggleJob, logBonus, undoBonus } = useFamily();
  const now = useNow(1000);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const prevAllDone = useRef<boolean | null>(null);
  const [periodChoice, setPeriodChoice] = useState<'morning' | 'evening' | null>(null);

  const kid = data.kids.find((k) => k.id === kidId);
  const s = kid ? summarizeKid(kid, data, now) : null;

  // Celebrate the moment the last morning job is ticked (not when the screen first opens).
  useEffect(() => {
    if (!s) return;
    if (prevAllDone.current === false && s.allDone) setCelebrate(true);
    prevAllDone.current = s.allDone;
  }, [s?.allDone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (loading) return null;
  if (!kid || !s) return <Navigate to="/" replace />;

  const timer = timerState(data.settings, now);
  const color = kid.color;
  // Morning quests until midday (or until they're done after midday), then evening quests.
  const hour = localParts(now, data.settings.timezone).secondsOfDay / 3600;
  const autoPeriod = s.eveningJobs.length > 0 && (hour >= 15 || (hour >= 12 && s.allDone)) ? 'evening' : 'morning';
  const period = s.eveningJobs.length === 0 ? 'morning' : periodChoice ?? autoPeriod;
  const shown = period === 'morning' ? s.todayJobs : s.eveningJobs;
  const shownDone = shown.filter((t) => t.done).length;
  const cols = Math.min(5, Math.max(1, shown.length));
  const jobsToNext = Math.max(1, Math.ceil(s.starsToNextDollar / 10));

  async function tapQuest(job: Job, completionId?: string) {
    if (busy) return;
    setBusy(job.id);
    const err = await toggleJob(job, kid!.id, completionId);
    setBusy(null);
    if (err) setToast(err);
  }

  async function tapBonus(job: Job, remaining: number) {
    if (busy) return;
    if (remaining <= 0) {
      setToast('All done for this week!');
      return;
    }
    setBusy(job.id);
    const err = await logBonus(job, kid!.id);
    setBusy(null);
    setToast(err ?? `Nice one! +${job.stars} stars once Mum or Dad gives a thumbs up`);
  }

  async function tapUndo(id: string) {
    if (busy) return;
    setBusy(id);
    const err = await undoBonus(id);
    setBusy(null);
    setToast(err ?? 'Undone');
  }

  const lastLoss = s.moneyTaken[0];
  const totalLoss = -s.moneyTaken.reduce((a, b) => a + Number(b.amount), 0);

  return (
    <main className="kid-screen" style={{ '--kid': color } as CSSProperties}>
      <header className="kid-header">
        <KidAvatar kid={kid} className="avatar" />
        <div className="kid-hello">
          <h1>HEY {kid.name.toUpperCase()}!</h1>
          <div className="chips">
            <span className="chip solid" style={{ background: color }}>LEVEL {s.level}</span>
            <span className="chip">{Math.max(0, s.weekStars)} stars this week</span>
            {s.streak > 0 && <span className="chip">{s.streak}-day streak</span>}
            <div className="level-bar" title="Progress to next level">
              <div style={{ width: `${Math.round(s.levelProgress * 100)}%`, background: color }} />
            </div>
          </div>
        </div>
        <Link to="/kids" className="switch-btn" aria-label="Switch player">
          <Icon d={UI_ICONS.switch} size={22} strokeWidth={2.2} />
          <span>Switch</span>
        </Link>
      </header>

      <div className="kid-grid">
        {/* Pocket money — the star of the show */}
        <section className="panel money area-money" aria-label="Pocket money this week">
          <div className="money-top">
            <div className="money-amount">
              <span className="big">{formatMoneyShort(s.money)}</span>
              <span className="label">EARNED!</span>
            </div>
            <div className="to-go" style={{ background: color }}>
              <div className="big">{s.toGo > 0 ? formatMoneyShort(s.toGo) : 'ALL!'}</div>
              <div className="small">{s.toGo > 0 ? 'MORE TO GO' : 'MAXED OUT'}</div>
            </div>
          </div>
          <RewardTrack
            total={s.coinsTotal}
            filled={s.coinsFilled}
            earnedFromStars={s.earnedDollars}
            starsInto={data.settings.stars_per_dollar - s.starsToNextDollar}
            starsPerDollar={data.settings.stars_per_dollar}
            color={color}
          />
          <div className="money-foot">
            <span className="next">
              {s.payout
                ? `Paid out this week: ${formatMoneyShort(s.payout.amount)}`
                : s.earnedDollars >= s.target
                  ? 'You earned ALL your pocket money!'
                  : `Do ${jobsToNext} more ${jobsToNext === 1 ? 'job' : 'jobs'} to unlock the next dollar!`}
              {s.pendingStars > 0 && ` (+${s.pendingStars} stars waiting for a thumbs up)`}
            </span>
            {lastLoss && (
              <span className="loss">
                −{formatMoneyShort(totalLoss)} taken away{lastLoss.reason ? `: ${lastLoss.reason}` : ''}
                {s.moneyTaken.length > 1 ? ` (+${s.moneyTaken.length - 1} more)` : ''}
              </span>
            )}
          </div>
        </section>

        <TimerCard timer={timer} settings={data.settings} speedDone={s.speedBonusToday} />

        <section className="area-quests" aria-label="Today's quests">
          <div className="quests-head">
            {s.eveningJobs.length > 0 ? (
              <div className="period-tabs" role="group" aria-label="Morning or evening quests">
                <button aria-pressed={period === 'morning'} onClick={() => setPeriodChoice('morning')}>
                  MORNING <span>{s.doneCount}/{s.totalCount}</span>
                </button>
                <button aria-pressed={period === 'evening'} onClick={() => setPeriodChoice('evening')}>
                  EVENING <span>{s.eveningDone}/{s.eveningJobs.length}</span>
                </button>
              </div>
            ) : (
              <h2>MORNING QUESTS</h2>
            )}
            <div className="dots" aria-label={`${shownDone} of ${shown.length} done`}>
              {shown.map((t) => (
                <span key={t.job.id} className={`dot${t.done ? ' on' : ''}`} style={t.done ? { background: color } : undefined} />
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="quests-empty">No {period} quests today. Enjoy!</div>
          ) : (
            <div className="quest-grid" style={{ '--cols': cols } as CSSProperties}>
              {shown.map((t, i) => {
                const tile = TILE_COLORS[i % TILE_COLORS.length];
                const turns = t.job.assign_mode !== 'each' && t.job.kid_ids.length > 1;
                return (
                  <button
                    key={t.job.id}
                    className={`quest${t.done ? ' done' : ''}`}
                    style={{ '--tile': tile } as CSSProperties}
                    aria-pressed={t.done}
                    disabled={busy === t.job.id}
                    onClick={() => tapQuest(t.job, t.completion?.id)}
                  >
                    {t.done && (
                      <span className="stamp"><Icon d={UI_ICONS.check} size={24} strokeWidth={3.2} /></span>
                    )}
                    <span className="icon-box"><Icon name={t.job.icon} size={40} /></span>
                    <span className="title">{t.job.title}</span>
                    {turns && !t.done && <span className="turn-tag">YOUR TURN</span>}
                    <span className="foot">{t.done ? 'DONE!' : `TAP ME · +${t.job.stars}`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {s.tech.ban ? (
          <section className="panel tech dead area-tech" aria-label="Tech time banned">
            <div className="row">
              <span className="title"><Icon d={UI_ICONS.gamepad} size={26} strokeWidth={1.9} />TECH TIME</span>
              <span className="status">BANNED</span>
            </div>
            <div className="dead-title">TECH TIME DEAD</div>
            <div className="log">
              <span className="until">Banned {banEndText(s.tech.ban.until, data.settings.timezone)}</span>
              {s.tech.ban.reason && <span className="minus">Reason: {s.tech.ban.reason}</span>}
            </div>
          </section>
        ) : (
          <section className={`panel tech area-tech${s.allDone || s.totalCount === 0 ? ' open' : ''}`} aria-label="Tech time">
          <div className="row">
            <span className="title"><Icon d={UI_ICONS.gamepad} size={26} strokeWidth={1.9} />TECH TIME</span>
            <span className="status">
              {s.allDone || s.totalCount === 0 ? 'UNLOCKED' : `LOCKED · ${s.totalCount - s.doneCount} TO GO`}
            </span>
          </div>
          <div className="mins"><span className="big">{s.tech.total}</span><span className="unit">MIN THIS WEEK</span></div>
          <div className="log">
            <span className="plus">
              {s.tech.earned > 0
                ? `+${s.tech.earned} min from bonus jobs this week`
                : `+${data.settings.bonus_tech_minutes} min for each bonus job`}
            </span>
            {s.tech.given > 0 && <span className="plus">+{s.tech.given} min from Mum or Dad</span>}
            {s.tech.takenReasons.slice(0, 2).map((a) => (
              <span key={a.id} className="minus">−{Math.abs(a.amount)} min{a.reason ? `: ${a.reason}` : ''}</span>
            ))}
          </div>
        </section>
        )}

        <section className="panel bonus area-bonus" aria-label="Bonus jobs">
          <div className="panel-head">
            <h2>BONUS JOBS</h2>
            <span className="panel-note">Each one = stars + {data.settings.bonus_tech_minutes} min tech time this week</span>
          </div>
          <div className="bonus-grid">
            {s.bonusJobs.map((b) => {
              const full = b.remaining <= 0;
              const approved = b.usedThisWeek - b.pendingThisWeek;
              return (
                <div key={b.job.id} className="bonus-cell">
                  <button
                    className={`bonus-btn${full ? ' full' : ''}`}
                    onClick={() => tapBonus(b.job, b.remaining)}
                    disabled={busy === b.job.id}
                    aria-label={full ? `${b.job.title}: all done this week` : `I did ${b.job.title}, plus ${b.job.stars} stars`}
                  >
                    <Icon name={b.job.icon} size={34} strokeWidth={1.9} />
                    <span className="name">{b.job.title}</span>
                    <span className="reward">{full ? 'ALL DONE THIS WEEK' : `+${b.job.stars} STARS · +${data.settings.bonus_tech_minutes} MIN`}</span>
                    <span className="pips">
                      {Array.from({ length: b.job.max_per_week }, (_, i) => (
                        <span key={i} className={`pip${i < approved ? ' on' : i < b.usedThisWeek ? ' wait' : ''}`} />
                      ))}
                    </span>
                    {b.pendingThisWeek > 0 && <span className="waiting">{b.pendingThisWeek} waiting for thumbs up</span>}
                  </button>
                  {b.latestPendingId && (
                    <button className="undo-link" onClick={() => tapUndo(b.latestPendingId!)} aria-label={`Undo ${b.job.title}`}>
                      UNDO
                    </button>
                  )}
                </div>
              );
            })}
            {s.bonusJobs.length === 0 && <div className="panel-note">No bonus jobs yet.</div>}
          </div>
        </section>
      </div>

      {celebrate && (
        <>
          <Confetti />
          <div className="celebrate" role="dialog" aria-modal="true" aria-label="Quests complete">
            <div className="card">
              <Icon d={UI_ICONS.unlock} size={64} />
              <h2>{s.speedBonusToday ? 'SPEED RUN!' : 'QUESTS COMPLETE!'}</h2>
              <p>
                {s.speedBonusToday
                  ? `+${data.settings.speed_bonus_stars} bonus stars. Tech time unlocked!`
                  : 'Tech time is unlocked. Go have fun!'}
              </p>
              <button onClick={() => setCelebrate(false)}>AWESOME</button>
            </div>
          </div>
        </>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
