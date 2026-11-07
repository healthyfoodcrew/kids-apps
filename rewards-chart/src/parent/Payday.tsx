import { useState } from 'react';
import { payHistory, type PayWeek } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { formatMoney } from '../lib/time';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';

const STATUS: Record<PayWeek['status'], { label: string; bg: string; fg: string }> = {
  paid: { label: 'Paid', bg: '#e6f6ea', fg: '#14532d' },
  due: { label: 'Due today', bg: '#fff3d6', fg: '#6b4a00' },
  missed: { label: 'Missed', bg: '#fdeaea', fg: '#8a1c1c' },
  'in-progress': { label: 'This week', bg: '#eef1ff', fg: '#2442d6' },
  none: { label: 'Nothing earned', bg: '#f0f1f5', fg: '#5b6070' },
};

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function Payday() {
  const { data, recordPayout, undoPayout } = useFamily();
  const now = useNow(60_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = data.kids.map((kid) => ({ kid, weeks: payHistory(kid, data, now, 8) }));
  const owing = rows.flatMap((r) => r.weeks.filter((w) => w.status === 'due' || w.status === 'missed').map((w) => ({ ...w, kid: r.kid })));
  const owedTotal = owing.reduce((a, w) => a + w.amount, 0);
  const missedCount = owing.filter((w) => w.status === 'missed').length;

  async function act(key: string, op: () => Promise<string | null>) {
    setBusy(key);
    const err = await op();
    setBusy(null);
    setError(err);
  }

  return (
    <ParentLayout>
      <header className="p-head">
        <div>
          <div className="sub">Paid every Sunday · week runs Monday to Sunday</div>
          <h1>Pay day</h1>
        </div>
      </header>

      {error && <div className="p-msg err">{error}</div>}

      <div className="p-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--p-muted)', fontWeight: 600 }}>To pay</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{formatMoney(owedTotal)}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: missedCount ? '#8a1c1c' : 'var(--p-muted)' }}>
          {owing.length === 0 ? 'All paid up' : missedCount ? `${missedCount} missed Sunday${missedCount === 1 ? '' : 's'}` : 'Due today'}
        </div>
      </div>

      {rows.map(({ kid, weeks }) => (
        <section key={kid.id} className="p-section">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KidDot name={kid.name} color={inkOf(kid.color)} />
            {kid.name}
          </h2>
          <div className="p-list">
            {weeks.map((w) => {
              const st = STATUS[w.status];
              const key = `${kid.id}-${w.weekStart}`;
              return (
                <div key={w.weekStart} className="p-row">
                  <div className="grow">
                    <div className="t">{dayLabel(w.payday)} · {formatMoney(w.payout ? w.payout.amount : w.amount)}</div>
                    <div className="m">
                      {w.payout
                        ? `Ticked off ${new Date(w.payout.paid_at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}`
                        : `Week of ${dayLabel(w.weekStart)}${w.status === 'in-progress' ? ' · so far' : ''}`}
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: st.bg, color: st.fg }}>{st.label}</span>
                  {w.payout ? (
                    <button className="p-btn" disabled={busy === key} onClick={() => act(key, () => undoPayout(w.payout!.id))}>Undo</button>
                  ) : w.status === 'in-progress' || w.status === 'none' ? null : (
                    <button className="p-btn primary" disabled={busy === key} onClick={() => act(key, () => recordPayout(kid.id, w.weekStart, w.amount))}>
                      Paid
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </ParentLayout>
  );
}
