import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon, JOB_ICONS, UI_ICONS } from '../components/Icon';
import { summarizeKid } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { formatMoney } from '../lib/time';
import type { AdjustmentKind } from '../lib/types';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';
import { TechBan } from './TechBan';

const TAKE_REASONS = ['Not listening', 'Fighting', 'Rude words', 'Screens after bedtime', 'Not ready on time', 'Mess left out'];
const GIVE_REASONS = ['Extra helpful', 'Great attitude', 'Kind to brother', 'Homework done', 'Tried something new'];

const STEP: Record<AdjustmentKind, number> = { money: 0.5, tech: 5, stars: 5 };
const START: Record<AdjustmentKind, number> = { money: 1, tech: 10, stars: 10 };
const MAX: Record<AdjustmentKind, number> = { money: 20, tech: 120, stars: 200 };

export function Adjust() {
  const { data, addAdjustment, removeAdjustment } = useFamily();
  const [undoing, setUndoing] = useState<string | null>(null);
  const now = useNow(30_000);
  const [params] = useSearchParams();

  const [mode, setMode] = useState<'take' | 'give'>(params.get('mode') === 'give' ? 'give' : 'take');
  const [kidId, setKidId] = useState(params.get('kid') ?? '');
  const [kind, setKind] = useState<AdjustmentKind>('money');
  const [amounts, setAmounts] = useState<Record<AdjustmentKind, number>>({ ...START });
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!kidId && data.kids[0]) setKidId(data.kids[0].id);
  }, [data.kids, kidId]);

  const kid = data.kids.find((k) => k.id === kidId);
  const s = kid ? summarizeKid(kid, data, now) : null;
  const amount = amounts[kind];
  const reasons = mode === 'take' ? TAKE_REASONS : GIVE_REASONS;
  const finalReason = reason === 'Other' ? other.trim() : reason;
  const take = mode === 'take';

  const label = kind === 'money' ? formatMoney(amount) : kind === 'tech' ? `${amount} min` : `${amount} stars`;
  const what =
    kind === 'money' ? `${formatMoney(amount)} pocket money` : kind === 'tech' ? `${amount} min tech time` : `${amount} stars`;

  let after = '';
  if (s) {
    if (kind === 'money') after = `Leaves ${formatMoney(Math.max(0, s.money + (take ? -amount : amount)))} earned this week`;
    else if (kind === 'tech') after = `Leaves ${Math.max(0, s.tech.total + (take ? -amount : amount))} min tech time this week`;
    else after = `${Math.max(0, s.weekStars + (take ? -amount : amount))} stars this week`;
  }

  function step(dir: 1 | -1) {
    setAmounts((a) => ({ ...a, [kind]: Math.min(MAX[kind], Math.max(STEP[kind], Math.round((a[kind] + dir * STEP[kind]) * 100) / 100)) }));
  }

  async function confirm() {
    if (!kid) return;
    if (reason === 'Other' && !finalReason) {
      setError('Type a short reason so they know why.');
      return;
    }
    setSaving(true);
    const err = await addAdjustment(kid.id, kind, take ? -amount : amount, finalReason);
    setSaving(false);
    if (err) setError(err);
    else {
      setError(null);
      setDone(`Done: ${take ? '−' : '+'}${what} ${take ? 'from' : 'for'} ${kid.name}`);
      setReason('');
      setOther('');
    }
  }

  const sources: { id: AdjustmentKind; label: string; icon: string; balance: string }[] = [
    { id: 'money', label: 'Pocket money', icon: UI_ICONS.wallet, balance: s ? `${formatMoney(s.money)} earned` : '' },
    { id: 'tech', label: 'Tech time', icon: UI_ICONS.gamepad, balance: s ? (s.tech.ban ? 'Banned' : `${s.tech.total} min this week`) : '' },
    { id: 'stars', label: 'Stars', icon: JOB_ICONS.star.d, balance: s ? `${Math.max(0, s.weekStars)} this week` : '' },
  ];

  return (
    <ParentLayout>
      <header className="p-head">
        <h1>{take ? 'Take away' : 'Give a bonus'}</h1>
      </header>

      <div className="p-seg" role="group" aria-label="Give or take">
        <button aria-pressed={take} onClick={() => { setMode('take'); setReason(''); }}>Take away</button>
        <button aria-pressed={!take} onClick={() => { setMode('give'); setReason(''); }}>Give</button>
      </div>

      <section className="p-section">
        <p className="p-label">Who</p>
        <div className="p-grid2">
          {data.kids.map((k) => (
            <button
              key={k.id}
              className="p-choice"
              aria-pressed={k.id === kidId}
              style={{ ['--sel' as string]: inkOf(k.color) }}
              onClick={() => setKidId(k.id)}
            >
              <KidDot name={k.name} color={inkOf(k.color)} />
              {k.name}
            </button>
          ))}
        </div>
      </section>

      {take && kid && <TechBan kid={kid} />}

      <section className="p-section">
        <p className="p-label">{take ? 'Take from' : 'Give'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {sources.map((src) => (
            <button key={src.id} className="p-choice tall" aria-pressed={kind === src.id} onClick={() => setKind(src.id)}>
              <Icon d={src.icon} size={24} strokeWidth={1.9} />
              <span>{src.label}</span>
              <span className="s">{src.balance}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="p-card p-section">
        <p className="p-label">How much</p>
        <div className="p-stepper">
          <button onClick={() => step(-1)} aria-label="Less">−</button>
          <div className="val">
            <b>{label}</b>
            <span>{kind === 'money' ? 'pocket money' : kind === 'tech' ? 'tech time' : 'stars'}</span>
          </div>
          <button onClick={() => step(1)} aria-label="More">+</button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--p-muted)', fontWeight: 600 }}>{after}</div>
      </section>

      <section className="p-section">
        <p className="p-label">Reason (they'll see this)</p>
        <div className="p-pills">
          {[...reasons, 'Other'].map((r) => (
            <button key={r} className="p-pill" aria-pressed={reason === r} onClick={() => { setReason(r); setError(null); }}>{r}</button>
          ))}
        </div>
        {reason === 'Other' && (
          <label className="p-field">
            <span className="sr-only">Reason</span>
            <input className="p-input" maxLength={60} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Type a short reason" autoFocus />
          </label>
        )}
      </section>

      {error && <div className="p-msg err">{error}</div>}
      {done && <div className="p-msg ok" role="status">{done}</div>}

      <div className="p-preview">
        {kid ? `${kid.name} will see: ${take ? '−' : '+'}${what}${finalReason ? ` · ${finalReason}` : ''}` : 'Pick who this is for'}
      </div>
      <button className={`p-btn block ${take ? 'danger' : 'primary'}`} onClick={confirm} disabled={!kid || saving}>
        {saving ? 'Saving…' : `${take ? 'Take away' : 'Give'} ${label} ${take ? 'from' : 'to'} ${kid?.name ?? ''}`}
      </button>

      <section className="p-section" style={{ marginTop: 12 }}>
        <h2>Recent</h2>
        {data.adjustments.length === 0 ? (
          <div className="p-card p-empty">Nothing given or taken away yet.</div>
        ) : (
          <div className="p-list">
            {data.adjustments.slice(0, 6).map((a) => {
              const k = data.kids.find((x) => x.id === a.kid_id);
              const sign = a.amount > 0 ? '+' : '−';
              const amt =
                a.kind === 'money' ? `${sign}${formatMoney(Math.abs(a.amount))}` : a.kind === 'tech' ? `${sign}${Math.abs(a.amount)} min tech` : `${sign}${Math.abs(a.amount)} stars`;
              return (
                <div key={a.id} className="p-row">
                  {k && <KidDot name={k.name} color={inkOf(k.color)} />}
                  <div className="grow">
                    <div className="t">{amt}</div>
                    <div className="m">{k?.name} · {a.reason || 'No reason'} · {new Date(a.created_at).toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                  <button
                    className="p-btn"
                    disabled={undoing === a.id}
                    onClick={async () => {
                      setUndoing(a.id);
                      const err = await removeAdjustment(a.id);
                      setUndoing(null);
                      if (err) setError(err);
                    }}
                  >
                    Undo
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </ParentLayout>
  );
}
