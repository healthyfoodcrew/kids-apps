import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { pendingBonusLogs, summarizeKid } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { addDays, formatMoney, formatMoneyShort } from '../lib/time';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function ParentHome() {
  const { data, loading, error, reviewBonus, removeAdjustment, recordPayout, undoPayout } = useFamily();
  const now = useNow(30_000);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const summaries = data.kids.map((k) => summarizeKid(k, data, now));
  const ws = summaries[0]?.weekStart;
  const pending = pendingBonusLogs(data);
  const kidById = new Map(data.kids.map((k) => [k.id, k]));
  const jobById = new Map(data.jobs.map((j) => [j.id, j]));
  const recent = data.adjustments.slice(0, 6);

  async function act(id: string, op: () => Promise<string | null>, ok?: string) {
    setBusy(id);
    const err = await op();
    setBusy(null);
    setMsg(err ? { kind: 'err', text: err } : ok ? { kind: 'ok', text: ok } : null);
  }

  return (
    <ParentLayout>
      <header className="p-head">
        <div>
          <div className="sub">{ws ? `Week of ${ws.slice(8)}/${ws.slice(5, 7)} – ${addDays(ws, 6).slice(8)}/${addDays(ws, 6).slice(5, 7)}` : ''}</div>
          <h1>Family HQ</h1>
        </div>
        <Link to="/parent/settings" className="p-icon-btn" aria-label="Settings">
          <Icon d={UI_ICONS.settings} size={22} strokeWidth={1.6} />
        </Link>
      </header>

      {error && <div className="p-msg err">{error}</div>}
      {msg && <div className={`p-msg ${msg.kind}`} role="status">{msg.text}</div>}
      {loading && <div className="p-empty">Loading…</div>}

      <div className="p-grid2">
        {summaries.map((s) => (
          <div key={s.kid.id} className="p-card p-kid">
            <div className="name"><KidDot name={s.kid.name} color={inkOf(s.kid.color)} />{s.kid.name}</div>
            <div className="amt">{formatMoneyShort(s.money)}<small> / {formatMoneyShort(s.target)}</small></div>
            <div className="p-bar"><div style={{ width: `${s.target ? Math.min(100, (s.money / s.target) * 100) : 0}%`, background: inkOf(s.kid.color) }} /></div>
            <div className="line">Morning jobs <b>{s.doneCount}/{s.totalCount}</b></div>
            <div className="line">Tech time today <b>{s.tech.total} min</b></div>
            <div className="line">Stars this week <b>{Math.max(0, s.weekStars)}</b>{s.pendingStars > 0 ? ` (+${s.pendingStars} waiting)` : ''}</div>
          </div>
        ))}
      </div>

      <section className="p-section">
        <div className="p-head">
          <h2 style={{ margin: 0, fontSize: 17 }}>Needs a thumbs up</h2>
          <span className="sub">{pending.length} waiting</span>
        </div>
        {pending.length === 0 ? (
          <div className="p-card p-empty">Nothing waiting. Bonus jobs the boys log show up here.</div>
        ) : (
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
                  <button
                    className="p-icon-btn"
                    aria-label={`Not done: ${job?.title}`}
                    disabled={busy === b.id}
                    onClick={() => act(b.id, () => reviewBonus(b.id, 'rejected'))}
                  >
                    <Icon d={UI_ICONS.close} size={18} strokeWidth={2.2} />
                  </button>
                  <button
                    className="p-icon-btn primary"
                    aria-label={`Approve: ${job?.title}`}
                    disabled={busy === b.id}
                    onClick={() => act(b.id, () => reviewBonus(b.id, 'approved'))}
                  >
                    <Icon d={UI_ICONS.check} size={20} strokeWidth={2.6} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="p-section">
        <h2>Quick actions</h2>
        <div className="p-actions">
          <Link to="/parent/adjust?mode=give" className="p-btn primary"><Icon d={UI_ICONS.plus} size={20} />Give a bonus</Link>
          <Link to="/parent/adjust?mode=take" className="p-btn"><Icon d={UI_ICONS.minus} size={20} />Take away</Link>
          <Link to="/parent/jobs" className="p-btn"><Icon d={UI_ICONS.list} size={20} />Edit jobs</Link>
          <Link to="/parent/settings" className="p-btn"><Icon d={UI_ICONS.wallet} size={20} />Pocket money</Link>
        </div>
      </section>

      <section className="p-section">
        <h2>Pay day</h2>
        <div className="p-list">
          {summaries.map((s) => (
            <div key={s.kid.id} className="p-row">
              <KidDot name={s.kid.name} color={inkOf(s.kid.color)} />
              <div className="grow">
                <div className="t">{s.kid.name}: {formatMoney(s.money)}</div>
                <div className="m">{s.payout ? `Paid ${formatMoney(s.payout.amount)} on ${when(s.payout.paid_at)}` : 'Not paid yet this week'}</div>
              </div>
              {s.payout ? (
                <button className="p-btn" disabled={busy === s.payout.id} onClick={() => act(s.payout!.id, () => undoPayout(s.payout!.id))}>Undo</button>
              ) : (
                <button
                  className="p-btn primary"
                  disabled={busy === s.kid.id}
                  onClick={() => act(s.kid.id, () => recordPayout(s.kid.id, s.weekStart, s.money), `Marked ${formatMoney(s.money)} paid to ${s.kid.name}`)}
                >
                  Mark paid
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="p-section">
        <h2>Recent give &amp; take</h2>
        {recent.length === 0 ? (
          <div className="p-card p-empty">Nothing given or taken away yet.</div>
        ) : (
          <div className="p-list">
            {recent.map((a) => {
              const kid = kidById.get(a.kid_id);
              const amt =
                a.kind === 'money'
                  ? `${a.amount > 0 ? '+' : '−'}${formatMoney(Math.abs(a.amount))}`
                  : a.kind === 'tech'
                    ? `${a.amount > 0 ? '+' : '−'}${Math.abs(a.amount)} min tech`
                    : `${a.amount > 0 ? '+' : '−'}${Math.abs(a.amount)} stars`;
              return (
                <div key={a.id} className="p-row">
                  {kid && <KidDot name={kid.name} color={inkOf(kid.color)} />}
                  <div className="grow">
                    <div className="t">{amt}</div>
                    <div className="m">{kid?.name} · {a.reason || 'No reason'} · {when(a.created_at)}</div>
                  </div>
                  <button className="p-btn" disabled={busy === a.id} onClick={() => act(a.id, () => removeAdjustment(a.id), 'Undone')}>Undo</button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </ParentLayout>
  );
}
