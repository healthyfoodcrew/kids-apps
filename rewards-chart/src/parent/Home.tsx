import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { payHistory, pendingBonusLogs, summarizeKid } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { formatMoney, formatMoneyShort } from '../lib/time';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "Today": what needs a parent right now, and how each child is tracking. */
export function ParentHome() {
  const { data, loading, error, reviewBonus } = useFamily();
  const now = useNow(30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const summaries = data.kids.map((k) => summarizeKid(k, data, now));
  const pending = pendingBonusLogs(data);
  const kidById = new Map(data.kids.map((k) => [k.id, k]));
  const jobById = new Map(data.jobs.map((j) => [j.id, j]));

  const owing = data.kids.flatMap((k) => payHistory(k, data, now, 8).filter((w) => w.status === 'due' || w.status === 'missed'));
  const owedTotal = owing.reduce((a, w) => a + w.amount, 0);
  const missed = owing.filter((w) => w.status === 'missed').length;

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
        <Link to="/parent/payday" className="p-banner" style={{ textDecoration: 'none' }}>
          <Icon d={UI_ICONS.wallet} size={22} />
          <span className="grow">
            {missed ? `${missed} missed pay day${missed === 1 ? '' : 's'}` : "It's pay day!"} · {formatMoney(owedTotal)} to pay
          </span>
          <span style={{ fontWeight: 800 }}>Tick off ›</span>
        </Link>
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
                <span className="amt" style={{ margin: 0 }}>{formatMoneyShort(s.money)}<small> / {formatMoneyShort(s.target)}</small></span>
              </div>
              <div className="p-bar"><div style={{ width: `${s.target ? Math.min(100, (s.money / s.target) * 100) : 0}%`, background: ink }} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span className="line">Morning jobs <b>{s.doneCount}/{s.totalCount}</b></span>
                <span className="line">Tech time this week <b>{s.tech.total} min</b></span>
              </div>
            </Link>
          );
        })}
        <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, textAlign: 'center' }}>
          Tap a child to give or take away
        </p>
      </section>

      {pending.length === 0 && owing.length === 0 && !loading && (
        <div className="p-card p-empty">All caught up. Nothing needs you right now.</div>
      )}
    </ParentLayout>
  );
}
