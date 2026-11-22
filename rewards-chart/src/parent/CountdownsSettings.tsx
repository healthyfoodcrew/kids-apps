import { useState } from 'react';
import { COUNTDOWN_THEMES, CountdownTile } from '../kid/Countdowns';
import { useFamily, type CountdownInput } from '../lib/store';
import type { Countdown } from '../lib/types';
import { ParentLayout } from './ParentLayout';
import { SubHeader } from './Settings';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayText = (d: string) => {
  const wd = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
  return `${DAYS[wd]} ${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
};

/** Setup → Countdowns: big days the kids can count down to on the iPad home screen. */
export function CountdownsSettings() {
  const { data, today, saveCountdown, deleteCountdown } = useFamily();
  const t = today();
  const [edit, setEdit] = useState<CountdownInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const list = (data.countdowns ?? []).slice().sort((a, b) => a.day.localeCompare(b.day));

  const open = (c?: Countdown) =>
    setEdit(c ? { id: c.id, title: c.title, day: c.day, theme: c.theme, note: c.note, show_days: c.show_days } : { title: '', day: t, theme: 'party', note: null, show_days: 30 });

  async function save() {
    if (!edit) return;
    if (!edit.title.trim()) return setMsg('Give the countdown a name.');
    setBusy(true);
    const err = await saveCountdown({ ...edit, title: edit.title.trim(), note: edit.note?.trim() || null });
    setBusy(false);
    if (err) return setMsg(err);
    setEdit(null);
    setMsg(null);
  }

  async function remove() {
    if (!edit?.id || !window.confirm(`Delete the "${edit.title}" countdown?`)) return;
    setBusy(true);
    const err = await deleteCountdown(edit.id);
    setBusy(false);
    if (err) return setMsg(err);
    setEdit(null);
  }

  if (edit) {
    const set = (p: Partial<CountdownInput>) => setEdit({ ...edit, ...p });
    return (
      <ParentLayout>
        <header className="p-head">
          <button className="p-btn" onClick={() => { setEdit(null); setMsg(null); }}>Cancel</button>
          <h1 style={{ flex: 1, fontSize: 22, textAlign: 'center' }}>{edit.id ? 'Edit countdown' : 'New countdown'}</h1>
        </header>
        {msg && <div className="p-msg err" role="alert">{msg}</div>}
        <div className="cd-preview">
          <CountdownTile c={{ title: edit.title || 'Your countdown', day: edit.day, theme: edit.theme, note: edit.note }} today={t} />
        </div>
        <div className="p-card p-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="p-field">
            <span>Counting down to</span>
            <input className="p-input" value={edit.title} maxLength={24} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Max's party" />
          </label>
          <label className="p-field">
            <span>Date</span>
            <input className="p-input" type="date" min={t} value={edit.day} onChange={(e) => e.target.value && set({ day: e.target.value })} />
          </label>
          <label className="p-field">
            <span>Small line under the name (optional)</span>
            <input className="p-input" value={edit.note ?? ''} maxLength={32} onChange={(e) => set({ note: e.target.value })} placeholder={dayText(edit.day)} />
          </label>
          <div className="p-field">
            <span>Picture</span>
            <div className="p-pills">
              {COUNTDOWN_THEMES.map((th) => (
                <button key={th.id} className="p-pill" aria-pressed={edit.theme === th.id} onClick={() => set({ theme: th.id })}>{th.label}</button>
              ))}
            </div>
          </div>
          <div className="p-field">
            <span>Show on the iPad from</span>
            <div className="p-stepper">
              <button onClick={() => set({ show_days: Math.max(1, edit.show_days - 7) })} aria-label="Fewer days">−</button>
              <div className="val"><b>{edit.show_days}</b><span>days before the day</span></div>
              <button onClick={() => set({ show_days: Math.min(366, edit.show_days + 7) })} aria-label="More days">+</button>
            </div>
          </div>
          <button className="p-btn primary block" onClick={save} disabled={busy}>{edit.id ? 'Save' : 'Add countdown'}</button>
          {edit.id && <button className="p-btn block" onClick={remove} disabled={busy} style={{ color: 'var(--p-red)' }}>Delete countdown</button>}
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <SubHeader title="Countdowns" action={<button className="p-btn primary" onClick={() => open()}>Add</button>} />
      {msg && <div className="p-msg err" role="alert">{msg}</div>}
      {list.length === 0 ? (
        <div className="p-card p-empty">No countdowns yet. Tap Add for a party, holiday or birthday.</div>
      ) : (
        <div className="p-list">
          {list.map((c) => {
            const daysLeft = Math.round((Date.parse(`${c.day}T00:00:00Z`) - Date.parse(`${t}T00:00:00Z`)) / 86_400_000);
            const theme = COUNTDOWN_THEMES.find((x) => x.id === c.theme)?.label ?? 'Plain';
            return (
              <button key={c.id} className="p-row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, font: 'inherit', color: 'inherit' }} onClick={() => open(c)}>
                <div className="grow">
                  <div className="t">{c.title}</div>
                  <div className="m">
                    {dayText(c.day)} · {theme} · {daysLeft < 0 ? 'finished' : daysLeft <= c.show_days ? `showing now (${daysLeft} days)` : `shows from ${c.show_days} days before`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ParentLayout>
  );
}
