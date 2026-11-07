import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { useAuth, useFamily } from '../lib/store';
import type { Kid, Settings as SettingsT } from '../lib/types';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';

const COLORS = ['#FF5A5A', '#2EE6D6', '#4FB8FF', '#B98CFF', '#5BD45B', '#FFA53D', '#FF7AC6', '#FFC94A'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Msg = { kind: 'ok' | 'err'; text: string } | null;

function KidEditor({ kid, onSave }: { kid: Kid; onSave(k: Partial<Kid> & { id: string }): Promise<string | null> }) {
  const [name, setName] = useState(kid.name);
  const [money, setMoney] = useState(String(kid.weekly_pocket_money));
  const [tech, setTech] = useState(String(kid.daily_tech_minutes));
  const [color, setColor] = useState(kid.color);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    setName(kid.name);
    setMoney(String(kid.weekly_pocket_money));
    setTech(String(kid.daily_tech_minutes));
    setColor(kid.color);
  }, [kid]);

  async function save() {
    const m = Number(money);
    const t = Math.round(Number(tech));
    if (!name.trim() || !Number.isFinite(m) || m < 0 || !Number.isFinite(t) || t < 0) {
      setMsg({ kind: 'err', text: 'Check the name, money and minutes.' });
      return;
    }
    const err = await onSave({ id: kid.id, name: name.trim(), weekly_pocket_money: m, daily_tech_minutes: t, color });
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'Saved' });
  }

  return (
    <div className="p-card p-section">
      <div className="p-inline" style={{ fontWeight: 700 }}><KidDot name={name || '?'} color={inkOf(color)} />{kid.name}</div>
      <label className="p-field"><span>Name</span><input className="p-input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
      <div className="p-grid2">
        <label className="p-field"><span>Pocket money a week ($)</span><input className="p-input" inputMode="decimal" value={money} onChange={(e) => setMoney(e.target.value)} /></label>
        <label className="p-field"><span>Tech time a day (min)</span><input className="p-input" inputMode="numeric" value={tech} onChange={(e) => setTech(e.target.value)} /></label>
      </div>
      <div className="p-field">
        <span>Colour</span>
        <div className="p-days">
          {COLORS.map((c) => (
            <button key={c} aria-pressed={color === c} aria-label={`Colour ${c}`} onClick={() => setColor(c)} style={{ background: c, borderColor: color === c ? '#15171C' : c, borderWidth: color === c ? 3 : 1 }} />
          ))}
        </div>
      </div>
      {msg && <div className={`p-msg ${msg.kind}`}>{msg.text}</div>}
      <button className="p-btn primary" onClick={save}>Save {name || 'child'}</button>
    </div>
  );
}

export function SettingsScreen() {
  const { data, saveKid, saveSettings, setPin } = useFamily();
  const { role, signOut } = useAuth();
  const st = data.settings;
  const [form, setForm] = useState<SettingsT>(st);
  const [msg, setMsg] = useState<Msg>(null);
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState<Msg>(null);
  const [newKid, setNewKid] = useState('');

  useEffect(() => setForm(st), [st]);

  const num = (k: keyof SettingsT) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) });

  async function saveRules() {
    const err = await saveSettings({
      leave_time: form.leave_time.length === 5 ? `${form.leave_time}:00` : form.leave_time,
      school_days: form.school_days,
      countdown_minutes: Math.max(5, form.countdown_minutes),
      speed_bonus_minutes: form.speed_bonus_minutes,
      speed_bonus_stars: form.speed_bonus_stars,
      stars_per_dollar: Math.max(1, form.stars_per_dollar),
      bonus_tech_minutes: form.bonus_tech_minutes,
    });
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'Settings saved' });
  }

  async function changePin() {
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinMsg({ kind: 'err', text: 'Use 4 to 6 numbers.' });
      return;
    }
    const err = await setPin(newPin);
    setPinMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'PIN changed. Use it on the kids’ iPad.' });
    if (!err) setNewPin('');
  }

  async function addKid() {
    if (!newKid.trim()) return;
    const err = await saveKid({ name: newKid.trim(), color: COLORS[data.kids.length % COLORS.length], sort: data.kids.length + 1, weekly_pocket_money: 5, daily_tech_minutes: 30 });
    if (!err) setNewKid('');
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'Child added. Add their jobs in Jobs.' });
  }

  return (
    <ParentLayout>
      <header className="p-head"><h1>Settings</h1></header>

      <section className="p-section">
        <h2>Kids &amp; pocket money</h2>
        {data.kids.map((k) => <KidEditor key={k.id} kid={k} onSave={(p) => saveKid(p)} />)}
        <div className="p-card p-inline">
          <input className="p-input" style={{ width: 'auto', flex: 1 }} placeholder="Add a child (name)" value={newKid} maxLength={20} onChange={(e) => setNewKid(e.target.value)} />
          <button className="p-btn" onClick={addKid} disabled={!newKid.trim()}>Add</button>
        </div>
      </section>

      <section className="p-section">
        <h2>School mornings</h2>
        <div className="p-card p-section">
          <div className="p-grid2">
            <label className="p-field"><span>Leave for school</span><input className="p-input" type="time" value={form.leave_time.slice(0, 5)} onChange={(e) => setForm({ ...form, leave_time: e.target.value })} /></label>
            <label className="p-field"><span>Countdown starts (min before)</span><input className="p-input" inputMode="numeric" value={form.countdown_minutes} onChange={num('countdown_minutes')} /></label>
          </div>
          <div className="p-field">
            <span>School days</span>
            <div className="p-days">
              {DAY_NAMES.map((n, i) => {
                const d = i + 1;
                const on = form.school_days.includes(d);
                return (
                  <button key={d} aria-pressed={on} aria-label={n} onClick={() => setForm({ ...form, school_days: on ? form.school_days.filter((x) => x !== d) : [...form.school_days, d].sort() })}>
                    {n.slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-grid2">
            <label className="p-field"><span>Speed bonus if done (min early)</span><input className="p-input" inputMode="numeric" value={form.speed_bonus_minutes} onChange={num('speed_bonus_minutes')} /></label>
            <label className="p-field"><span>Speed bonus (stars)</span><input className="p-input" inputMode="numeric" value={form.speed_bonus_stars} onChange={num('speed_bonus_stars')} /></label>
          </div>
        </div>
      </section>

      <section className="p-section">
        <h2>Points rules</h2>
        <div className="p-card p-section">
          <div className="p-grid2">
            <label className="p-field"><span>Stars for $1</span><input className="p-input" inputMode="numeric" value={form.stars_per_dollar} onChange={num('stars_per_dollar')} /></label>
            <label className="p-field"><span>Tech minutes per bonus job</span><input className="p-input" inputMode="numeric" value={form.bonus_tech_minutes} onChange={num('bonus_tech_minutes')} /></label>
          </div>
          <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>
            Example: at {form.stars_per_dollar} stars for $1, a $10 week needs {form.stars_per_dollar * 10} stars.
          </p>
        </div>
        {msg && <div className={`p-msg ${msg.kind}`} role="status">{msg.text}</div>}
        <button className="p-btn primary block" onClick={saveRules}>Save school &amp; points settings</button>
      </section>

      {role === 'parent' && (
        <section className="p-section">
          <h2>Parent PIN for the kids' iPad</h2>
          <div className="p-card p-inline">
            <label className="p-field" style={{ flex: 1 }}>
              <span className="sr-only">New PIN</span>
              <input className="p-input" style={{ width: '100%' }} inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} placeholder="New PIN (4–6 numbers)" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} />
            </label>
            <button className="p-btn" onClick={changePin}>Change</button>
          </div>
          {pinMsg && <div className={`p-msg ${pinMsg.kind}`}>{pinMsg.text}</div>}
        </section>
      )}

      <section className="p-section">
        <h2>This device</h2>
        <div className="p-actions">
          <Link to="/kids" className="p-btn"><Icon d={UI_ICONS.gamepad} size={20} />Kids' view</Link>
          {role === 'parent' && (
            <button className="p-btn" onClick={() => signOut()}><Icon d={UI_ICONS.logout} size={20} />Sign out</button>
          )}
        </div>
      </section>
    </ParentLayout>
  );
}
