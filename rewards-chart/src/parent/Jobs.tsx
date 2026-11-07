import { useState } from 'react';
import { Icon, JOB_ICONS, UI_ICONS } from '../components/Icon';
import { kidsOnDuty } from '../lib/calc';
import { useFamily, type JobInput } from '../lib/store';
import type { AssignMode, Job, Kid } from '../lib/types';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';
import { SubHeader } from './Settings';

type Group = 'morning' | 'evening' | 'bonus';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MODE_LABEL: Record<AssignMode, string> = {
  each: 'Everyone does it',
  rotate_daily: 'Take turns each day',
  rotate_weekly: 'Take turns each week',
};

function groupOf(j: { kind: string; period?: string }): Group {
  return j.kind === 'bonus' ? 'bonus' : j.period === 'evening' ? 'evening' : 'morning';
}

function daysText(days: number[]): string {
  const d = [...days].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'School days';
  if (d.join() === '6,7') return 'Weekends';
  return d.map((n) => DAY_NAMES[n - 1]).join(', ');
}

function names(ids: string[], kids: Kid[]): string {
  const list = ids.map((id) => kids.find((k) => k.id === id)?.name).filter(Boolean) as string[];
  return list.length <= 1 ? list[0] ?? 'Nobody' : `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
}

export function Jobs() {
  const { data, saveJob, deleteJob, moveJob, today } = useFamily();
  const [group, setGroup] = useState<Group>('morning');
  const [editing, setEditing] = useState<JobInput | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const kids = data.kids;
  const day = today();

  const byGroup = (g: Group) =>
    data.jobs.filter((j) => groupOf(j) === g).sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
  const list = byGroup(group);

  function startNew() {
    setMsg(null);
    setEditing({
      kid_ids: kids.map((k) => k.id),
      title: '',
      icon: group === 'bonus' ? 'dish' : 'bed',
      kind: group === 'bonus' ? 'bonus' : 'daily',
      period: group === 'evening' ? 'evening' : 'morning',
      assign_mode: 'each',
      rotation_offset: 0,
      stars: group === 'bonus' ? 15 : 10,
      max_per_week: 3,
      days: [1, 2, 3, 4, 5, 6, 7],
      active: true,
    });
  }

  function startEdit(j: Job) {
    setMsg(null);
    setEditing({
      id: j.id, kid_ids: j.kid_ids, title: j.title, icon: j.icon, kind: j.kind, period: j.period ?? 'morning',
      assign_mode: j.assign_mode ?? 'each', rotation_offset: j.rotation_offset ?? 0, stars: j.stars,
      max_per_week: j.max_per_week, days: j.days, active: j.active,
    });
  }

  async function save() {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) return setMsg({ kind: 'err', text: 'Give the job a name.' });
    if (editing.kid_ids.length === 0) return setMsg({ kind: 'err', text: 'Pick at least one child.' });
    if (editing.kind === 'daily' && editing.days.length === 0) return setMsg({ kind: 'err', text: 'Pick at least one day.' });
    const job = { ...editing, title, assign_mode: editing.kid_ids.length < 2 || editing.kind === 'bonus' ? 'each' as const : editing.assign_mode };
    setSaving(true);
    const err = await saveJob(job);
    setSaving(false);
    if (err) setMsg({ kind: 'err', text: err });
    else {
      setGroup(groupOf(job));
      setMsg({ kind: 'ok', text: editing.id ? 'Job saved' : 'Job added' });
      setEditing(null);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    if (!window.confirm(`Delete "${editing.title}"? Its history goes too. To keep history, switch it off instead.`)) return;
    setSaving(true);
    const err = await deleteJob(editing.id);
    setSaving(false);
    if (err) setMsg({ kind: 'err', text: err });
    else {
      setMsg({ kind: 'ok', text: 'Job deleted' });
      setEditing(null);
    }
  }

  async function toggleActive(j: Job) {
    const err = await saveJob({
      id: j.id, kid_ids: j.kid_ids, title: j.title, icon: j.icon, kind: j.kind, period: j.period ?? 'morning',
      assign_mode: j.assign_mode ?? 'each', rotation_offset: j.rotation_offset ?? 0, stars: j.stars,
      max_per_week: j.max_per_week, days: j.days, active: !j.active,
    });
    if (err) setMsg({ kind: 'err', text: err });
  }

  /* ───────────── Edit / add one job ───────────── */
  if (editing) {
    const e = editing;
    const set = (patch: Partial<JobInput>) => setEditing({ ...e, ...patch });
    const g = groupOf(e);
    const canRotate = e.kind === 'daily' && e.kid_ids.length >= 2;
    const rotating = canRotate && e.assign_mode !== 'each';
    const preview = { ...e, id: e.id ?? 'new', sort: 0 } as Job;
    const onDutyToday = rotating ? kidsOnDuty(preview, day)[0] : undefined;

    // Choose whose turn it is today by shifting the rotation.
    function setTurn(kidId: string) {
      const base = kidsOnDuty({ ...preview, rotation_offset: 0 }, day)[0];
      const n = e.kid_ids.length;
      const offset = (((e.kid_ids.indexOf(kidId) - e.kid_ids.indexOf(base)) % n) + n) % n;
      set({ rotation_offset: offset });
    }

    const siblings = e.id ? byGroup(g) : [];
    const idx = siblings.findIndex((x) => x.id === e.id);
    const job = e.id ? data.jobs.find((x) => x.id === e.id) : undefined;

    return (
      <ParentLayout>
        <header className="p-head">
          <button className="p-icon-btn" onClick={() => setEditing(null)} aria-label="Back to jobs"><Icon d={UI_ICONS.back} size={20} /></button>
          <h1 style={{ flex: 1, fontSize: 22 }}>{e.id ? 'Edit job' : 'New job'}</h1>
        </header>
        {msg && <div className={`p-msg ${msg.kind}`}>{msg.text}</div>}

        <label className="p-field">
          <span>Name the kids will see</span>
          <input className="p-input" value={e.title} maxLength={40} onChange={(ev) => set({ title: ev.target.value })} placeholder="e.g. Feed the dog" autoFocus={!e.id} />
        </label>

        <div className="p-field">
          <span>When</span>
          <div className="p-seg" role="group" aria-label="When">
            <button aria-pressed={g === 'morning'} onClick={() => set({ kind: 'daily', period: 'morning' })}>Morning</button>
            <button aria-pressed={g === 'evening'} onClick={() => set({ kind: 'daily', period: 'evening' })}>Evening</button>
            <button aria-pressed={g === 'bonus'} onClick={() => set({ kind: 'bonus', assign_mode: 'each' })}>Bonus job</button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--p-muted)', fontWeight: 600 }}>
            {g === 'bonus' ? 'Done now and then during the week; a parent gives the thumbs up.' : g === 'morning' ? 'Morning quests unlock tech time and count for the speed bonus.' : 'Shown on the iPad from the afternoon.'}
          </span>
        </div>

        <div className="p-field">
          <span>Who</span>
          <div className="p-pills">
            {kids.map((k) => {
              const on = e.kid_ids.includes(k.id);
              return (
                <button
                  key={k.id}
                  className="p-pill"
                  aria-pressed={on}
                  onClick={() => set({ kid_ids: on ? e.kid_ids.filter((x) => x !== k.id) : [...e.kid_ids, k.id] })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <KidDot name={k.name} color={inkOf(k.color)} />
                  {k.name}
                </button>
              );
            })}
          </div>
        </div>

        {canRotate && (
          <div className="p-field">
            <span>How</span>
            <div className="p-pills">
              {(Object.keys(MODE_LABEL) as AssignMode[]).map((m) => (
                <button key={m} className="p-pill" aria-pressed={e.assign_mode === m} onClick={() => set({ assign_mode: m })}>{MODE_LABEL[m]}</button>
              ))}
            </div>
            {rotating && (
              <div className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--p-muted)' }}>Whose turn is it {e.assign_mode === 'rotate_weekly' ? 'this week' : 'today'}?</span>
                <div className="p-pills">
                  {e.kid_ids.map((id) => {
                    const k = kids.find((x) => x.id === id);
                    if (!k) return null;
                    return (
                      <button key={id} className="p-pill" aria-pressed={onDutyToday === id} onClick={() => setTurn(id)}>{k.name}</button>
                    );
                  })}
                </div>
                <span style={{ fontSize: 12, color: 'var(--p-muted)', fontWeight: 600 }}>
                  After that it swaps {e.assign_mode === 'rotate_weekly' ? 'every Monday' : 'each time the job comes round'}.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-field">
          <span>Picture</span>
          <div className="p-icons">
            {Object.entries(JOB_ICONS).map(([key, ic]) => (
              <button key={key} aria-pressed={e.icon === key} aria-label={ic.label} title={ic.label} onClick={() => set({ icon: key })}>
                <Icon d={ic.d} size={24} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </div>

        <div className="p-card p-section">
          <div className="p-stepper">
            <button onClick={() => set({ stars: Math.max(0, e.stars - 5) })} aria-label="Fewer stars">−</button>
            <div className="val"><b>{e.stars}</b><span>stars each time</span></div>
            <button onClick={() => set({ stars: Math.min(200, e.stars + 5) })} aria-label="More stars">+</button>
          </div>
        </div>

        {e.kind === 'daily' ? (
          <div className="p-field">
            <span>Shows on</span>
            <div className="p-days">
              {DAY_LABELS.map((l, i) => {
                const d = i + 1;
                const on = e.days.includes(d);
                return (
                  <button key={d} aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => set({ days: on ? e.days.filter((x) => x !== d) : [...e.days, d].sort() })}>
                    {l}
                  </button>
                );
              })}
            </div>
            <div className="p-pills">
              <button className="p-pill" onClick={() => set({ days: [1, 2, 3, 4, 5, 6, 7] })}>Every day</button>
              <button className="p-pill" onClick={() => set({ days: [1, 2, 3, 4, 5] })}>School days</button>
              <button className="p-pill" onClick={() => set({ days: [6, 7] })}>Weekends</button>
            </div>
          </div>
        ) : (
          <div className="p-card p-section">
            <div className="p-stepper">
              <button onClick={() => set({ max_per_week: Math.max(1, e.max_per_week - 1) })} aria-label="Fewer times">−</button>
              <div className="val"><b>{e.max_per_week}×</b><span>a week each, at most</span></div>
              <button onClick={() => set({ max_per_week: Math.min(14, e.max_per_week + 1) })} aria-label="More times">+</button>
            </div>
          </div>
        )}

        {job && siblings.length > 1 && (
          <div className="p-field">
            <span>Order on the kids' screen ({idx + 1} of {siblings.length})</span>
            <div className="p-grid2">
              <button className="p-btn" disabled={idx <= 0} onClick={() => moveJob(job, -1)}><Icon d={UI_ICONS.up} size={18} />Earlier</button>
              <button className="p-btn" disabled={idx === siblings.length - 1} onClick={() => moveJob(job, 1)}><Icon d={UI_ICONS.down} size={18} />Later</button>
            </div>
          </div>
        )}

        <button className="p-btn primary block" onClick={save} disabled={saving}>{saving ? 'Saving…' : e.id ? 'Save job' : 'Add job'}</button>
        {e.id && <button className="p-btn block" onClick={remove} disabled={saving}>Delete job</button>}
      </ParentLayout>
    );
  }

  /* ───────────── The central list ───────────── */
  return (
    <ParentLayout>
      <SubHeader
        title="Jobs"
        action={<button className="p-btn primary" onClick={startNew} disabled={kids.length === 0}><Icon d={UI_ICONS.plus} size={18} strokeWidth={2.6} />Add</button>}
      />
      {msg && <div className={`p-msg ${msg.kind}`} role="status">{msg.text}</div>}

      <div className="p-seg" role="group" aria-label="Job type">
        <button aria-pressed={group === 'morning'} onClick={() => setGroup('morning')}>Morning ({byGroup('morning').length})</button>
        <button aria-pressed={group === 'evening'} onClick={() => setGroup('evening')}>Evening ({byGroup('evening').length})</button>
        <button aria-pressed={group === 'bonus'} onClick={() => setGroup('bonus')}>Bonus ({byGroup('bonus').length})</button>
      </div>

      {list.length === 0 ? (
        <div className="p-card p-empty">No {group} jobs yet. Tap Add to make one.</div>
      ) : (
        <div className="p-list">
          {list.map((j) => {
            const turns = j.kind === 'daily' && j.assign_mode !== 'each' && j.kid_ids.length > 1;
            const onDuty = turns ? kidsOnDuty(j, day)[0] : undefined;
            return (
              <div key={j.id} className="p-row" style={j.active ? undefined : { opacity: 0.55 }}>
                <Icon name={j.icon} size={24} strokeWidth={1.8} />
                <button className="grow" onClick={() => startEdit(j)} style={{ border: 0, background: 'transparent', textAlign: 'left', padding: 0, minHeight: 44, color: 'inherit' }}>
                  <div className="t">{j.title}</div>
                  <div className="m">
                    {names(j.kid_ids, kids)}
                    {turns ? ` · take turns ${j.assign_mode === 'rotate_weekly' ? 'weekly' : 'daily'} (${kids.find((k) => k.id === onDuty)?.name ?? ''} ${j.assign_mode === 'rotate_weekly' ? 'this week' : 'today'})` : ''}
                    {' · '}
                    {j.kind === 'daily' ? daysText(j.days) : `up to ${j.max_per_week}× a week`} · {j.stars} stars
                    {j.active ? '' : ' · off'}
                  </div>
                </button>
                <button className="p-toggle" aria-pressed={j.active} aria-label={`${j.title} ${j.active ? 'on' : 'off'}`} onClick={() => toggleActive(j)} />
              </div>
            );
          })}
        </div>
      )}
      <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, textAlign: 'center' }}>
        Tap a job to change who does it, when, and how many stars.
      </p>
    </ParentLayout>
  );
}
