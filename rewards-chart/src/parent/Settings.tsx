import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { KidAvatar } from '../components/KidAvatar';
import { useAuth, useFamily } from '../lib/store';
import { formatClock } from '../lib/time';
import type { Kid, Settings as SettingsT } from '../lib/types';
import { CharacterMaker } from './CharacterMaker';
import { ParentLayout } from './ParentLayout';

const COLORS = ['#FF5A5A', '#2EE6D6', '#4FB8FF', '#B98CFF', '#5BD45B', '#FFA53D', '#FF7AC6', '#FFC94A'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Msg = { kind: 'ok' | 'err'; text: string } | null;

/** Header with a back arrow, for the pages under Setup. */
export function SubHeader({ title, back = '/parent/setup', action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="p-head">
      <Link to={back} className="p-icon-btn" aria-label="Back"><Icon d={UI_ICONS.back} size={20} /></Link>
      <h1 style={{ flex: 1, fontSize: 22 }}>{title}</h1>
      {action}
    </header>
  );
}

/* ───────────── Setup menu ───────────── */

export function SetupMenu() {
  const { data } = useFamily();
  const { role, signOut } = useAuth();
  const st = data.settings;
  const jobCount = data.jobs.filter((j) => j.active).length;

  const items = [
    { to: '/parent/setup/jobs', icon: UI_ICONS.list, title: 'Jobs', sub: `${jobCount} jobs across ${data.kids.length} kids` },
    { to: '/parent/setup/kids', icon: UI_ICONS.wallet, title: 'Kids, pocket money & characters', sub: data.kids.map((k) => `${k.name} $${Number(k.weekly_pocket_money)}`).join(' · ') },
    { to: '/parent/setup/rules', icon: UI_ICONS.clock, title: 'School mornings & points', sub: `Leave ${formatClock(st.leave_time)} · 10 stars = ${st.minutes_per_10_stars} min tech` },
    ...(role === 'parent' ? [{ to: '/parent/setup/pin', icon: UI_ICONS.lock, title: "Parent PIN for the kids' iPad", sub: 'Change the PIN' }] : []),
  ];

  return (
    <ParentLayout>
      <header className="p-head"><h1>Setup</h1></header>
      <div className="p-list">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="p-row" style={{ textDecoration: 'none', color: 'inherit', minHeight: 64 }}>
            <Icon d={it.icon} size={22} strokeWidth={1.8} />
            <div className="grow">
              <div className="t">{it.title}</div>
              <div className="m">{it.sub}</div>
            </div>
            <span style={{ color: 'var(--p-muted)', fontSize: 22, paddingRight: 8 }}>›</span>
          </Link>
        ))}
      </div>

      <div className="p-actions">
        <Link to="/kids" className="p-btn"><Icon d={UI_ICONS.gamepad} size={20} />Kids' view</Link>
        {role === 'parent' && (
          <button className="p-btn" onClick={() => signOut()}><Icon d={UI_ICONS.logout} size={20} />Sign out</button>
        )}
      </div>
    </ParentLayout>
  );
}

/* ───────────── Kids, pocket money & characters ───────────── */

function KidEditor({ kid }: { kid: Kid }) {
  const { saveKid } = useFamily();
  const [name, setName] = useState(kid.name);
  const [money, setMoney] = useState(String(kid.weekly_pocket_money));
  const [tech, setTech] = useState(String(kid.weekly_tech_minutes));
  const [color, setColor] = useState(kid.color);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    setName(kid.name);
    setMoney(String(kid.weekly_pocket_money));
    setTech(String(kid.weekly_tech_minutes));
    setColor(kid.color);
  }, [kid]);

  async function save() {
    const m = Number(money);
    const t = Math.round(Number(tech));
    if (!name.trim() || !Number.isFinite(m) || m < 0 || !Number.isFinite(t) || t < 0) {
      setMsg({ kind: 'err', text: 'Check the name, money and minutes.' });
      return;
    }
    const err = await saveKid({ id: kid.id, name: name.trim(), weekly_pocket_money: m, weekly_tech_minutes: t, color });
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'Saved' });
  }

  return (
    <div className="p-card p-section">
      <div className="p-inline" style={{ fontWeight: 700, fontSize: 17 }}>
        <KidAvatar kid={{ ...kid, color }} style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#120F3A' }} />
        {kid.name}
      </div>
      <label className="p-field"><span>Name</span><input className="p-input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} /></label>
      <div className="p-grid2">
        <label className="p-field"><span>Pocket money a week ($)</span><input className="p-input" inputMode="decimal" value={money} onChange={(e) => setMoney(e.target.value)} /></label>
        <label className="p-field"><span>Tech time a week (min)</span><input className="p-input" inputMode="numeric" value={tech} onChange={(e) => setTech(e.target.value)} /></label>
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
      <CharacterMaker kid={kid} />
    </div>
  );
}

export function KidsSettings() {
  const { data, saveKid } = useFamily();
  const [newKid, setNewKid] = useState('');
  const [msg, setMsg] = useState<Msg>(null);

  async function addKid() {
    if (!newKid.trim()) return;
    const err = await saveKid({ name: newKid.trim(), color: COLORS[data.kids.length % COLORS.length], sort: data.kids.length + 1, weekly_pocket_money: 5, weekly_tech_minutes: 210 });
    if (!err) setNewKid('');
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'Child added. Add their jobs under Setup › Jobs.' });
  }

  return (
    <ParentLayout>
      <SubHeader title="Kids & pocket money" />
      {data.kids.map((k) => <KidEditor key={k.id} kid={k} />)}
      <div className="p-card p-inline">
        <input className="p-input" style={{ width: 'auto', flex: 1 }} placeholder="Add a child (name)" value={newKid} maxLength={20} onChange={(e) => setNewKid(e.target.value)} />
        <button className="p-btn" onClick={addKid} disabled={!newKid.trim()}>Add</button>
      </div>
      {msg && <div className={`p-msg ${msg.kind}`}>{msg.text}</div>}
    </ParentLayout>
  );
}

/* ───────────── School mornings & points ───────────── */

export function RulesSettings() {
  const { data, saveSettings } = useFamily();
  const st = data.settings;
  const [form, setForm] = useState<SettingsT>(st);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => setForm(st), [st]);

  const num = (k: keyof SettingsT) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: Math.max(0, Math.round(Number(e.target.value) || 0)) });

  async function save() {
    const err = await saveSettings({
      leave_time: form.leave_time.length === 5 ? `${form.leave_time}:00` : form.leave_time,
      school_days: form.school_days,
      countdown_minutes: Math.max(5, form.countdown_minutes),
      speed_bonus_minutes: form.speed_bonus_minutes,
      speed_bonus_stars: form.speed_bonus_stars,
      stars_per_dollar: Math.max(1, form.stars_per_dollar),
      bonus_tech_minutes: form.bonus_tech_minutes,
      minutes_per_10_stars: Math.max(0, Math.min(120, Number(form.minutes_per_10_stars) || 0)),
      pet_name: (form.pet_name ?? 'Bruno').trim() || 'Bruno',
    });
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'Saved' });
  }

  return (
    <ParentLayout>
      <SubHeader title="School mornings & points" />

      <div className="p-card p-section">
        <p className="p-label">School mornings</p>
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

      <div className="p-card p-section">
        <p className="p-label">Family dog</p>
        <label className="p-field"><span>Dog's name (shown on the iPad)</span><input className="p-input" maxLength={20} value={form.pet_name ?? 'Bruno'} onChange={(e) => setForm({ ...form, pet_name: e.target.value })} /></label>
      </div>

      <div className="p-card p-section">
        <p className="p-label">Points</p>
        <div className="p-grid2">
          <label className="p-field"><span>Tech minutes for every 10 stars</span><input className="p-input" inputMode="numeric" value={form.minutes_per_10_stars} onChange={num('minutes_per_10_stars')} /></label>
        </div>
        <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>
          The week runs Monday to Sunday. Pocket money is paid on Sunday and tech time starts again every Monday.
        </p>
      </div>

      {msg && <div className={`p-msg ${msg.kind}`} role="status">{msg.text}</div>}
      <button className="p-btn primary block" onClick={save}>Save</button>
    </ParentLayout>
  );
}

/* ───────────── Parent PIN ───────────── */

export function PinSettings() {
  const { setPin } = useFamily();
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState<Msg>(null);

  async function change() {
    if (!/^\d{4,6}$/.test(newPin)) {
      setMsg({ kind: 'err', text: 'Use 4 to 6 numbers.' });
      return;
    }
    const err = await setPin(newPin);
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'PIN changed. Use it on the kids’ iPad.' });
    if (!err) setNewPin('');
  }

  return (
    <ParentLayout>
      <SubHeader title="Parent PIN" />
      <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, fontSize: 14 }}>
        The kids' iPad asks for this PIN before opening the parent screens.
      </p>
      <div className="p-card p-inline">
        <label className="p-field" style={{ flex: 1 }}>
          <span className="sr-only">New PIN</span>
          <input className="p-input" style={{ width: '100%' }} inputMode="numeric" type="password" autoComplete="new-password" maxLength={6} placeholder="New PIN (4–6 numbers)" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} />
        </label>
        <button className="p-btn primary" onClick={change}>Change</button>
      </div>
      {msg && <div className={`p-msg ${msg.kind}`}>{msg.text}</div>}
    </ParentLayout>
  );
}

