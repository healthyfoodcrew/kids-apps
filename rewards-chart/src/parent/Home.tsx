import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { payHistory, pendingBonusLogs, summarizeKid } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { banEndText, formatMoney, formatMoneyShort } from '../lib/time';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "Today": what needs a parent right now, and how each child is tracking. */
export function ParentHome() {
  const { data, loading, error, reviewBonus, stopTech, resetTech, approveTech, revokeTech, addAdjustment, recordPayout } = useFamily();
  const [setFor, setSetFor] = useState<string | null>(null);
  const [setVal, setSetVal] = useState('');
  const now = useNow(30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const summaries = data.kids.map((k) => summarizeKid(k, data, now));
  const pending = pendingBonusLogs(data);
  const kidById = new Map(data.kids.map((k) => [k.id, k]));
  const jobById = new Map(data.jobs.map((j) => [j.id, j]));

  const owing = data.kids.flatMap((k) => payHistory(k, data, now, 8).filter((w) => w.status === 'due' || w.status === 'missed').map((w) => ({ ...w, kid: k })));
  const owedTotal = owing.reduce((a, w) => a + w.amount, 0);
  const missed = owing.filter((w) => w.status === 'missed').length;

  const techAsks = summaries.filter((s) => s.tech.weekend && !s.tech.ban && s.tech.approval === 'requested');

  async function act(key: string, op: () => Promise<string | null>) {
    setBusy(key);
    const e = await op();
    setBusy(null);
    setMsg(e);
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    setBusy(id);
    const err = await reviewBonus(id, status);
    setBusy(null);
    setMsg(err);
  }

  return (
    <ParentLayout>
      <header className="p-head">
        <h1>Today</h1>
      </header>

      {error && <div className="p-msg err">{error}</div>}
      {msg && <div className="p-msg err" role="alert">{msg}</div>}
      {loading && <div className="p-empty">Loading…</div>}

      {owing.length > 0 && (
        <section className="p-section">
          <h2>
            {missed ? `Pay days not ticked off (${owing.length})` : "It's pay day!"} · {formatMoney(owedTotal)}
          </h2>
          <div className="p-list">
            {owing.map((w) => (
              <div key={`${w.kid.id}-${w.weekStart}`} className="p-row">
                <KidDot name={w.kid.name} color={inkOf(w.kid.color)} />
                <div className="grow">
                  <div className="t">{w.kid.name} · {formatMoney(w.amount)}</div>
                  <div className="m">Week {Number(w.weekStart.slice(8))}/{Number(w.weekStart.slice(5, 7))} – {Number(w.payday.slice(8))}/{Number(w.payday.slice(5, 7))}{w.status === 'missed' ? ' · not ticked off yet' : ' · pay day today'}</div>
                </div>
                <button className="p-btn" disabled={busy === `skip-${w.kid.id}-${w.weekStart}`} onClick={() => act(`skip-${w.kid.id}-${w.weekStart}`, () => recordPayout(w.kid.id, w.weekStart, 0))}>
                  Skip
                </button>
                <button className="p-btn primary" disabled={busy === `pay-${w.kid.id}-${w.weekStart}`} onClick={() => act(`pay-${w.kid.id}-${w.weekStart}`, () => recordPayout(w.kid.id, w.weekStart, w.amount))}>
                  Paid
                </button>
              </div>
            ))}
          </div>
          <Link to="/parent/payday" className="p-link" style={{ display: 'inline-block', marginTop: 8, fontWeight: 700 }}>All pay days ›</Link>
        </section>
      )}

      {techAsks.length > 0 && (
        <section className="p-section">
          <h2>Tech time requests ({techAsks.length})</h2>
          <div className="p-list">
            {techAsks.map((s) => (
              <div key={s.kid.id} className="p-row">
                <KidDot name={s.kid.name} color={inkOf(s.kid.color)} />
                <div className="grow">
                  <div className="t">{s.kid.name} wants tech time</div>
                  <div className="m">{Math.floor(s.tech.remainingSeconds / 60)} min left this week · morning jobs done</div>
                </div>
                <button className="p-btn primary" disabled={busy === `ok-${s.kid.id}`} onClick={() => act(`ok-${s.kid.id}`, () => approveTech(s.kid.id))}>
                  Say yes
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="p-section">
          <h2>Thumbs up needed ({pending.length})</h2>
          <div className="p-list">
            {pending.map((b) => {
              const kid = kidById.get(b.kid_id);
              const job = jobById.get(b.job_id);
              return (
                <div key={b.id} className="p-row">
                  {kid && <KidDot name={kid.name} color={inkOf(kid.color)} />}
                  <div className="grow">
                    <div className="t">{job?.title ?? 'Bonus job'}</div>
                    <div className="m">{kid?.name} · {when(b.created_at)} · +{b.stars} stars, +{b.tech_minutes} min</div>
                  </div>
                  <button className="p-icon-btn" aria-label={`Not done: ${job?.title}`} disabled={busy === b.id} onClick={() => review(b.id, 'rejected')}>
                    <Icon d={UI_ICONS.close} size={18} strokeWidth={2.2} />
                  </button>
                  <button className="p-icon-btn primary" aria-label={`Approve: ${job?.title}`} disabled={busy === b.id} onClick={() => review(b.id, 'approved')}>
                    <Icon d={UI_ICONS.check} size={20} strokeWidth={2.6} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="p-section">
        <h2>This week</h2>
        {summaries.map((s) => {
          const ink = inkOf(s.kid.color);
          return (
            <Link key={s.kid.id} to={`/parent/adjust?kid=${s.kid.id}`} className="p-card p-kid" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="name" style={{ flex: 1 }}><KidDot name={s.kid.name} color={ink} />{s.kid.name}</span>
                <span className="amt" style={{ margin: 0 }}>
                  {Math.max(0, s.weekStars)}★<small> · {s.weekDone ? `${formatMoneyShort(s.money)} earned` : s.onTrack ? `${formatMoneyShort(s.target)} on track` : 'money missed'}</small>
                </span>
              </div>
              <div className="p-bar"><div style={{ width: `${Math.round((s.moneyDays.filter((d) => d.status === 'done' || d.status === 'none').length / 7) * 100)}%`, background: s.onTrack ? ink : '#E5484D' }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="line">Morning <b>{s.doneCount}/{s.totalCount}</b>{s.eveningJobs.length > 0 && <> · Evening <b>{s.eveningDone}/{s.eveningJobs.length}</b></>}</span>
                {s.tech.ban ? <span className="line" style={{ color: '#8a1c1c' }}><b style={{ color: '#8a1c1c' }}>Tech time dead</b> {banEndText(s.tech.ban.until, data.settings.timezone)}</span> : <span className="line">Tech time this week <b>{s.tech.total} min</b></span>}
              </div>
            </Link>
          );
        })}
        <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, textAlign: 'center' }}>
          Tap a child to give or take away
        </p>
      </section>

      <section className="p-section">
        <h2>Tech time</h2>
        <div className="p-list">
          {summaries.map((s) => {
            const t = s.tech;
            const left = Math.floor(t.remainingSeconds / 60);
            const status = t.ban
              ? 'Tech time dead'
              : t.running
                ? `On now · ${Math.floor(t.remainingSeconds / 3600)}h ${String(Math.floor((t.remainingSeconds % 3600) / 60)).padStart(2, '0')}m left`
                : `${left} min left this week${!t.weekend ? ' · weekends only' : t.approval === 'approved' ? ' · allowed today' : t.approval === 'requested' ? ' · asking now' : ' · not allowed yet today'}`;
            return (
              <div key={s.kid.id} className="p-row" style={{ flexWrap: 'wrap' }}>
                <KidDot name={s.kid.name} color={inkOf(s.kid.color)} />
                <div className="grow" style={{ flexBasis: '60%' }}>
                  <div className="t">{s.kid.name}</div>
                  <div className="m" style={t.running ? { color: '#2442d6', fontWeight: 700 } : undefined}>{status}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {t.running && (
                  <button className="p-btn" disabled={busy === `stop-${s.kid.id}`} onClick={async () => { setBusy(`stop-${s.kid.id}`); const e = await stopTech(s.kid.id); setBusy(null); setMsg(e); }}>
                    Stop
                  </button>
                )}
                {t.weekend && !t.ban && (
                  t.approval === 'approved' ? (
                    <button className="p-btn" disabled={busy === `lock-${s.kid.id}`} onClick={() => act(`lock-${s.kid.id}`, () => revokeTech(s.kid.id))}>
                      Lock
                    </button>
                  ) : (
                    <button className="p-btn primary" disabled={busy === `ok-${s.kid.id}`} onClick={() => act(`ok-${s.kid.id}`, () => approveTech(s.kid.id))}>
                      Allow today
                    </button>
                  )
                )}
                <button
                  className="p-btn"
                  disabled={busy === `reset-${s.kid.id}` || t.usedSeconds === 0}
                  onClick={async () => {
                    if (!window.confirm(`Reset ${s.kid.name}'s tech time for this week? The timer goes back to the full ${t.total} minutes.`)) return;
                    setBusy(`reset-${s.kid.id}`);
                    const e = await resetTech(s.kid.id, t.sessionIds);
                    setBusy(null);
                    setMsg(e);
                  }}
                >
                  Reset time
                </button>
                </div>
                {/* Quick adjust: nudge this week's tech time up or down, or set it exactly. */}
                <div style={{ width: '100%', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                  {[-15, -5, 5, 15].map((n) => (
                    <button
                      key={n}
                      className="p-btn"
                      style={{ padding: '5px 9px', minWidth: 0, fontSize: 14 }}
                      disabled={busy === `adj-${s.kid.id}`}
                      onClick={() => act(`adj-${s.kid.id}`, () => addAdjustment(s.kid.id, 'tech', n, n > 0 ? 'Added by a parent' : 'Taken by a parent'))}
                    >
                      {n > 0 ? `+${n}` : `−${-n}`}
                    </button>
                  ))}
                  {setFor === s.kid.id ? (
                    <>
                      <input
                        className="p-input"
                        inputMode="numeric"
                        placeholder="min"
                        style={{ width: 72, padding: '6px 8px' }}
                        value={setVal}
                        autoFocus
                        onChange={(e) => setSetVal(e.target.value.replace(/[^0-9]/g, ''))}
                      />
                      <button
                        className="p-btn primary"
                        style={{ padding: '6px 10px' }}
                        disabled={setVal === '' || busy === `adj-${s.kid.id}`}
                        onClick={() => {
                          const diff = Number(setVal) - left;
                          setSetFor(null);
                          if (diff !== 0) act(`adj-${s.kid.id}`, () => addAdjustment(s.kid.id, 'tech', diff, `Set to ${setVal} min by a parent`));
                        }}
                      >
                        Set
                      </button>
                    </>
                  ) : (
                    <button className="p-btn" style={{ padding: '5px 9px', fontSize: 14 }} onClick={() => { setSetFor(s.kid.id); setSetVal(String(left)); }}>
                      Set…
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {pending.length === 0 && owing.length === 0 && techAsks.length === 0 && !loading && (
        <div className="p-card p-empty">All caught up. Nothing needs you right now.</div>
      )}
    </ParentLayout>
  );
}
