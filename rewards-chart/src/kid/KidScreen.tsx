import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { KidAvatar } from '../components/KidAvatar';
import { summarizeKid, timerState } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { formatMoneyShort, localParts } from '../lib/time';
import type { Job } from '../lib/types';
import { Bone, Confetti, DogSitting, PawPrint, StarTrack, TILE_COLORS, TimerCard } from './parts';
import { TechCard } from './TechCard';

export function KidScreen() {
  const { kidId } = useParams();
  const { data, loading, toggleJob, logBonus, undoBonus, startTech, stopTech, requestTech } = useFamily();
  const now = useNow(1000);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [levelUp, setLevelUp] = useState<{ stars: number; minutes: number } | null>(null);
  const prevMilestones = useRef<number | null>(null);
  const prevAllDone = useRef<boolean | null>(null);

  const kid = data.kids.find((k) => k.id === kidId);
  const s = kid ? summarizeKid(kid, data, now) : null;

  // Celebrate the moment the last morning job is ticked (not when the screen first opens).
  useEffect(() => {
    if (!s) return;
    if (prevAllDone.current === false && s.allDone) setCelebrate(true);
    prevAllDone.current = s.allDone;
  }, [s?.allDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Big LEVEL UP the moment a new star milestone is reached.
  useEffect(() => {
    if (!s) return;
    if (prevMilestones.current !== null && s.milestonesReached > prevMilestones.current) {
      setLevelUp(s.milestones[s.milestonesReached - 1] ?? null);
    }
    prevMilestones.current = s.milestonesReached;
  }, [s?.milestonesReached]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (loading) return null;
  if (!kid || !s) return <Navigate to="/" replace />;

  const timer = timerState(data.settings, now);
  const color = kid.color;
  // Morning quests in the morning; evening quests from 3pm (or from midday once the morning ones are done).
  const hour = localParts(now, data.settings.timezone).secondsOfDay / 3600;
  const period: 'morning' | 'evening' =
    s.eveningJobs.length > 0 && (hour >= 15 || (hour >= 12 && (s.allDone || s.totalCount === 0))) ? 'evening' : 'morning';
  const all = period === 'morning' ? s.todayJobs : s.eveningJobs;
  const shown = all.filter((t) => t.job.category !== 'pet');
  const petTasks = all.filter((t) => t.job.category === 'pet');
  const petName = data.settings.pet_name || 'Bruno';
  const petDone = petTasks.length > 0 && petTasks.every((t) => t.done);

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

  async function techAction(op: () => Promise<string | null>) {
    if (busy) return;
    setBusy('tech');
    const err = await op();
    setBusy(null);
    if (err) setToast(err);
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
        {/* Stars: the star of the show. They earn tech time. */}
        <section className="panel money stars-panel area-money" aria-label="Stars this week">
          <div className="money-top">
            <div className="money-amount">
              <span className="big star-count">{Math.max(0, s.weekStars)}</span>
              <span className="label">STARS!</span>
            </div>
            <div className="to-go" style={{ background: color }}>
              <div className="big">+{s.starMinutes}</div>
              <div className="small">MIN TECH TIME</div>
            </div>
          </div>
          <StarTrack stars={Math.max(0, s.weekStars)} milestones={s.milestones} color={color} />
          <div className="money-foot">
            <span className="next">
              {s.nextMilestone
                ? `${s.nextMilestone.stars - Math.max(0, s.weekStars)} more stars to reach +${s.nextMilestone.minutes} min. Do bonus jobs to earn stars!`
                : 'You beat the whole reward track. LEGEND!'}
              {s.pendingStars > 0 && ` (+${s.pendingStars} stars waiting for a thumbs up)`}
            </span>
            <div className="money-week" aria-label="Pocket money this week">
              <span className="mw-label">POCKET MONEY</span>
              {s.moneyDays.map((d, i) => (
                <span key={d.day} className={`md ${d.status}`} title={d.day}>
                  <i>{d.status === 'done' ? '✓' : d.status === 'missed' ? '✕' : ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</i>
                </span>
              ))}
              <span className={`md-pay ${s.weekDone ? 'on earned' : s.onTrack ? 'goal' : 'off'}`}>
                <b>{formatMoneyShort(s.target)}</b>
                <small>{s.payout ? 'PAID' : s.weekDone ? 'EARNED!' : 'SUNDAY'}</small>
              </span>
            </div>
            <span className={s.weekDone ? 'pm won' : s.onTrack ? 'pm ok' : 'pm lost'}>
              {s.payout
                ? `Pocket money paid: ${formatMoneyShort(s.payout.amount)}`
                : s.weekDone
                  ? `You did every job, every day. ${formatMoneyShort(s.target)} pocket money earned!`
                  : s.onTrack
                    ? `Do every daily job, every day this week, to earn ${formatMoneyShort(s.target)} on Sunday!`
                    : 'Pocket money missed this week (a day of jobs was skipped).'}
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
            <h2>{period === 'morning' ? 'MORNING QUESTS' : 'EVENING QUESTS'}</h2>
          </div>
          {shown.length === 0 ? (
            <div className="quests-empty">No {period} quests today. Enjoy!</div>
          ) : (
            <div className={`quest-wrap${period === 'morning' && s.allDone ? ' stamped' : ''}`}>
            {period === 'morning' && s.allDone && (
              <div className="play-stamp" role="status">
                <div className="big">{s.tech.weekend ? 'ALL DONE!' : 'PLAY TIME!'}</div>
                <div className="small">{s.tech.weekend ? 'GREAT JOB · ENJOY YOUR DAY' : 'ALL JOBS DONE · GO PLAY'}</div>
              </div>
            )}
            <div className="quest-grid">
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
                      <span className="stamp"><Icon d={UI_ICONS.check} size={20} strokeWidth={3.2} /></span>
                    )}
                    <span className="icon-box"><Icon name={t.job.icon} size={28} /></span>
                    <span className="title">{t.job.title}</span>
                    {turns && !t.done && <span className="turn-tag">YOUR TURN</span>}
                    <span className="foot">{t.done ? 'DONE!' : 'TAP ME'}</span>
                  </button>
                );
              })}
            </div>
            </div>
          )}
        </section>

        <TechCard
          s={s}
          settings={data.settings}
          busy={busy === 'tech'}
          onStart={(secs) => techAction(() => startTech(kid.id, Math.min(secs, s.tech.remainingSeconds)))}
          onStop={() => techAction(() => stopTech(kid.id))}
          onAsk={() => techAction(() => requestTech(kid.id))}
        />

        <section className={`pet area-pet${petDone ? ' done' : ''}`} aria-label={`${petName}'s task`}>
          <span className="pet-bone"><Bone size={64} /></span>
          <span className="pet-dog"><DogSitting width={112} happy={petDone} /></span>
          <div className="pet-body">
            <span className="pet-tag">
              {petName.toUpperCase()}'S TASK · {petDone ? 'DONE' : period === 'morning' ? 'MORNING' : 'AFTERNOON'}
            </span>
            {petTasks.length === 0 ? (
              <div className="pet-title">{petName} is all sorted!</div>
            ) : petDone ? (
              <div className="pet-title">Thanks {kid.name}! Woof!</div>
            ) : (
              <div className="pet-title">{petTasks.filter((t) => !t.done).map((t) => t.job.title).join(' + ')}</div>
            )}
            <div className="pet-buttons">
              {petTasks.map((t) => (
                <button
                  key={t.job.id}
                  className={`pet-btn${t.done ? ' done' : ''}`}
                  aria-pressed={t.done}
                  aria-label={t.done ? `${t.job.title}: done (tap to undo)` : `I did it: ${t.job.title}`}
                  disabled={busy === t.job.id}
                  onClick={() => tapQuest(t.job, t.completion?.id)}
                >
                  {t.done ? (
                    <><Icon d={UI_ICONS.check} size={20} strokeWidth={3.4} />DONE!</>
                  ) : (
                    <><PawPrint size={20} />{petTasks.length > 1 ? t.job.title.split(' ')[0].toUpperCase() : 'I DID IT'}</>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="panel bonus area-bonus" aria-label="Bonus jobs">
          <div className="panel-head">
            <h2>BONUS JOBS</h2>
            <span className="panel-note">Did one? Tap it! Mum or Dad gives the thumbs up</span>
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
                    <span className="reward">{full ? 'ALL DONE THIS WEEK' : `+${b.job.stars} STARS`}</span>
                    {!full && b.pendingThisWeek === 0 && <span className="tap-hint">TAP WHEN DONE</span>}
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
              <h2>{s.tech.weekend ? 'ALL DONE!' : 'PLAY TIME!'}</h2>
              <p>
                {s.speedBonusToday
                  ? `Speed run! +${data.settings.speed_bonus_stars} bonus stars. Go outside and play!`
                  : s.tech.weekend
                    ? 'All morning jobs done. Tech time is ready!'
                    : 'All morning jobs done. Go outside and play!'}
              </p>
              <button onClick={() => setCelebrate(false)}>LET'S GO!</button>
            </div>
          </div>
        </>
      )}
      {levelUp && (
        <>
          <Confetti />
          <div className="celebrate level-up" role="dialog" aria-modal="true" aria-label="Level up">
            <div className="card">
              <div className="lu-badge">LEVEL UP!</div>
              <h2>+{levelUp.minutes} MIN</h2>
              <p>You hit {levelUp.stars} stars this week! That's {levelUp.minutes} minutes of extra tech time.</p>
              <button onClick={() => setLevelUp(null)}>AWESOME!</button>
            </div>
          </div>
        </>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
