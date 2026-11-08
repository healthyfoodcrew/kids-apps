import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EVENT_ICONS, EventIcon } from '../components/EventIcon';
import { Icon, UI_ICONS } from '../components/Icon';
import { eventColor, eventWho } from '../kid/WeekCalendar';
import { nextDate } from '../lib/calc';
import { useAuth, useFamily, type EventInput } from '../lib/store';
import { formatClock, weekdayOf } from '../lib/time';
import type { CalEvent } from '../lib/types';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayText(day: string): string {
  return `${DAYS[weekdayOf(day) - 1]} ${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
}

function blank(today: string): EventInput {
  return { title: '', icon: 'star', kid_ids: [], day: today, start_time: null, repeat: 'none', note: null };
}

export function Calendar() {
  const { data, today, saveEvent, deleteEvent } = useFamily();
  const { role, lock } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromTablet = role === 'tablet' && params.get('new') === '1';
  const [edit, setEdit] = useState<EventInput | null>(() => (params.get('new') === '1' ? blank(today()) : null));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = today();
  const kids = data.kids;

  const upcoming = (data.events ?? [])
    .map((e) => ({ e, next: nextDate(e, t) }))
    .filter((x): x is { e: CalEvent; next: string } => x.next !== null)
    .sort((a, b) => a.next.localeCompare(b.next) || (a.e.start_time ?? '').localeCompare(b.e.start_time ?? ''));

  function close() {
    setEdit(null);
    setMsg(null);
    // Added from the kids' iPad: lock parent mode again and go straight back to the home screen.
    if (fromTablet) {
      void lock();
      navigate('/');
    }
  }

  async function save() {
    if (!edit) return;
    if (!edit.title.trim()) return setMsg('Give the event a name.');
    setBusy(true);
    const err = await saveEvent({ ...edit, title: edit.title.trim(), note: edit.note?.trim() || null });
    setBusy(false);
    if (err) return setMsg(err);
    close();
  }

  async function remove() {
    if (!edit?.id || !window.confirm(`Delete "${edit.title}"?`)) return;
    setBusy(true);
    const err = await deleteEvent(edit.id);
    setBusy(false);
    if (err) return setMsg(err);
    close();
  }

  if (edit) {
    const set = (p: Partial<EventInput>) => setEdit({ ...edit, ...p });
    const family = edit.kid_ids.length === 0;
    return (
      <ParentLayout>
        <header className="p-head">
          <button className="p-icon-btn" onClick={close} aria-label="Back"><Icon d={UI_ICONS.back} size={20} /></button>
          <h1 style={{ flex: 1, fontSize: 22 }}>{edit.id ? 'Edit event' : 'New event'}</h1>
        </header>
        {msg && <div className="p-msg err" role="alert">{msg}</div>}
        <div className="p-card p-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label className="p-field">
            <span>What's on</span>
            <input className="p-input" value={edit.title} maxLength={40} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Swimming lesson" autoFocus={!edit.id} />
          </label>

          <div className="p-field">
            <span>Who</span>
            <div className="p-pills">
              {kids.map((k) => {
                const on = edit.kid_ids.includes(k.id);
                return (
                  <button
                    key={k.id}
                    className="p-pill"
                    aria-pressed={on}
                    onClick={() => set({ kid_ids: on ? edit.kid_ids.filter((x) => x !== k.id) : [...edit.kid_ids, k.id] })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <KidDot name={k.name} color={inkOf(k.color)} />
                    {k.name}
                  </button>
                );
              })}
              <button className="p-pill" aria-pressed={family} onClick={() => set({ kid_ids: [] })}>Whole family</button>
            </div>
          </div>

          <div className="p-grid2">
            <label className="p-field">
              <span>Day</span>
              <input className="p-input" type="date" value={edit.day} onChange={(e) => e.target.value && set({ day: e.target.value })} />
            </label>
            <label className="p-field">
              <span>Time</span>
              <input
                className="p-input"
                type="time"
                value={edit.start_time?.slice(0, 5) ?? ''}
                onChange={(e) => set({ start_time: e.target.value ? `${e.target.value}:00` : null })}
              />
            </label>
          </div>
          <div className="p-card p-inline" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>All day</div>
            <button
              className="p-toggle"
              aria-pressed={edit.start_time === null}
              aria-label="All day"
              onClick={() => set({ start_time: edit.start_time === null ? '15:30:00' : null })}
            />
          </div>

          <div className="p-field">
            <span>Repeats</span>
            <div className="p-seg" role="group" aria-label="Repeats">
              <button aria-pressed={edit.repeat === 'none'} onClick={() => set({ repeat: 'none' })}>Just once</button>
              <button aria-pressed={edit.repeat === 'weekly'} onClick={() => set({ repeat: 'weekly' })}>Every {DAYS[weekdayOf(edit.day) - 1]}</button>
            </div>
          </div>

          <div className="p-field">
            <span>Picture</span>
            <div className="p-icons">
              {Object.entries(EVENT_ICONS).map(([k, v]) => (
                <button key={k} aria-pressed={edit.icon === k} aria-label={v.label} onClick={() => set({ icon: k })}>
                  <EventIcon name={k} size={22} />
                </button>
              ))}
            </div>
          </div>

          <label className="p-field">
            <span>Note for the kids (optional)</span>
            <input className="p-input" value={edit.note ?? ''} maxLength={60} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Pack your goggles" />
          </label>

          <button className="p-btn primary block" onClick={save} disabled={busy}>{edit.id ? 'Save' : 'Add to calendar'}</button>
          {edit.id && (
            <button className="p-btn block" onClick={remove} disabled={busy} style={{ color: 'var(--p-red)' }}>Delete event</button>
          )}
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <header className="p-head">
        <h1 style={{ flex: 1 }}>Calendar</h1>
        <button className="p-btn primary" onClick={() => setEdit(blank(t))}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon d={UI_ICONS.plus} size={18} strokeWidth={2.6} />Add</span>
        </button>
      </header>
      {msg && <div className="p-msg err" role="alert">{msg}</div>}
      {upcoming.length === 0 ? (
        <div className="p-card p-empty">Nothing coming up. Tap Add to put something on the iPad calendar.</div>
      ) : (
        <section className="p-section">
          <div className="p-list">
            {upcoming.map(({ e, next }) => {
              const c = eventColor(e, kids);
              return (
                <button
                  key={e.id}
                  className="p-row"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, font: 'inherit', color: 'inherit' }}
                  onClick={() => setEdit({ id: e.id, title: e.title, icon: e.icon, kid_ids: e.kid_ids, day: e.day, start_time: e.start_time, repeat: e.repeat, note: e.note })}
                >
                  <span style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${c}33`, color: inkOf(c), flexShrink: 0 }}>
                    <EventIcon name={e.icon} size={20} />
                  </span>
                  <div className="grow">
                    <div className="t">{e.title}</div>
                    <div className="m">
                      {e.repeat === 'weekly' ? `Every ${DAYS[weekdayOf(e.day) - 1]} · next ${dayText(next)}` : dayText(next)}
                      {' · '}
                      {e.start_time ? formatClock(e.start_time) : 'all day'} · {eventWho(e, kids)}
                    </div>
                  </div>
                  <Icon d="M9 5l7 7-7 7" size={18} />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </ParentLayout>
  );
}
