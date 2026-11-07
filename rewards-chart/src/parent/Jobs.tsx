import { useEffect, useState } from 'react';
import { Icon, JOB_ICONS, UI_ICONS } from '../components/Icon';
import { useFamily, type JobInput } from '../lib/store';
import type { Job, JobKind } from '../lib/types';
import { KidDot, ParentLayout, inkOf } from './ParentLayout';
import { SubHeader } from './Settings';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function daysText(days: number[]): string {
  const d = [...days].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'School days';
  if (d.join() === '6,7') return 'Weekends';
  return d.map((n) => DAY_NAMES[n - 1]).join(', ');
}

export function Jobs() {
  const { data, saveJob, deleteJob, moveJob } = useFamily();
  const [kidId, setKidId] = useState('');
  const [kind, setKind] = useState<JobKind>('daily');
  const [editing, setEditing] = useState<JobInput | null>(null);
  const [alsoFor, setAlsoFor] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!kidId && data.kids[0]) setKidId(data.kids[0].id);
  }, [data.kids, kidId]);

  const kid = data.kids.find((k) => k.id === kidId);
  const list = data.jobs
    .filter((j) => j.kid_id === kidId && j.kind === kind)
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));

  function startNew() {
    setMsg(null);
    setAlsoFor([]);
    setEditing({
      kid_id: kidId,
      title: '',
      icon: kind === 'daily' ? 'bed' : 'dish',
      kind,
      stars: kind === 'daily' ? 10 : 15,
      max_per_week: 3,
      days: kind === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7],
      active: true,
    });
  }

  function startEdit(j: Job) {
    setMsg(null);
    setAlsoFor([]);
    setEditing({ id: j.id, kid_id: j.kid_id, title: j.title, icon: j.icon, kind: j.kind, stars: j.stars, max_per_week: j.max_per_week, days: j.days, active: j.active });
  }

  async function save() {
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) {
      setMsg({ kind: 'err', text: 'Give the job a name.' });
      return;
    }
    if (editing.kind === 'daily' && editing.days.length === 0) {
      setMsg({ kind: 'err', text: 'Pick at least one day.' });
      return;
    }
    setSaving(true);
    let err = await saveJob({ ...editing, title });
    for (const other of alsoFor) {
      if (err) break;
      err = await saveJob({ ...editing, id: undefined, kid_id: other, title });
    }
    setSaving(false);
    if (err) setMsg({ kind: 'err', text: err });
    else {
      setMsg({ kind: 'ok', text: editing.id ? 'Job saved' : alsoFor.length ? 'Job added for everyone picked' : 'Job added' });
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
    const err = await saveJob({ id: j.id, kid_id: j.kid_id, title: j.title, icon: j.icon, kind: j.kind, stars: j.stars, max_per_week: j.max_per_week, days: j.days, active: !j.active });
    if (err) setMsg({ kind: 'err', text: err });
  }

  if (editing) {
    const e = editing;
    const set = (patch: Partial<JobInput>) => setEditing({ ...e, ...patch });
    return (
      <ParentLayout>
        <header className="p-head">
          <button className="p-icon-btn" onClick={() => setEditing(null)} aria-label="Back to jobs"><Icon d={UI_ICONS.back} size={20} /></button>
          <h1 style={{ flex: 1 }}>{e.id ? 'Edit job' : e.kind === 'daily' ? 'New morning quest' : 'New bonus job'}</h1>
        </header>
        {msg && <div className={`p-msg ${msg.kind}`}>{msg.text}</div>}

        <label className="p-field">
          <span>Name the kids will see</span>
          <input className="p-input" value={e.title} maxLength={40} onChange={(ev) => set({ title: ev.target.value })} placeholder="e.g. Feed the dog" autoFocus={!e.id} />
        </label>

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
              <div className="val"><b>{e.max_per_week}×</b><span>a week, most</span></div>
              <button onClick={() => set({ max_per_week: Math.min(14, e.max_per_week + 1) })} aria-label="More times">+</button>
            </div>
          </div>
        )}

        {!e.id && data.kids.length > 1 && (
          <div className="p-field">
            <span>Also add this job for</span>
            <div className="p-pills">
              {data.kids.filter((k) => k.id !== e.kid_id).map((k) => {
                const on = alsoFor.includes(k.id);
                return (
                  <button key={k.id} className="p-pill" aria-pressed={on} onClick={() => setAlsoFor(on ? alsoFor.filter((x) => x !== k.id) : [...alsoFor, k.id])}>
                    {k.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {e.id && (() => {
          const job = data.jobs.find((x) => x.id === e.id);
          const siblings = data.jobs.filter((x) => x.kid_id === e.kid_id && x.kind === e.kind).sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
          const idx = siblings.findIndex((x) => x.id === e.id);
          if (!job || siblings.length < 2) return null;
          return (
            <div className="p-field">
              <span>Order on the kids' screen ({idx + 1} of {siblings.length})</span>
              <div className="p-grid2">
                <button className="p-btn" disabled={idx === 0} onClick={() => moveJob(job, -1)}><Icon d={UI_ICONS.up} size={18} />Move earlier</button>
                <button className="p-btn" disabled={idx === siblings.length - 1} onClick={() => moveJob(job, 1)}><Icon d={UI_ICONS.down} size={18} />Move later</button>
              </div>
            </div>
          );
        })()}

        <button className="p-btn primary block" onClick={save} disabled={saving}>{saving ? 'Saving…' : e.id ? 'Save job' : 'Add job'}</button>
        {e.id && <button className="p-btn block" onClick={remove} disabled={saving}>Delete job</button>}
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <SubHeader
        title="Jobs"
        action={<button className="p-btn primary" onClick={startNew} disabled={!kid}><Icon d={UI_ICONS.plus} size={18} strokeWidth={2.6} />Add</button>}
      />
      {msg && <div className={`p-msg ${msg.kind}`} role="status">{msg.text}</div>}

      <div className="p-grid2">
        {data.kids.map((k) => (
          <button key={k.id} className="p-choice" aria-pressed={k.id === kidId} style={{ ['--sel' as string]: inkOf(k.color) }} onClick={() => setKidId(k.id)}>
            <KidDot name={k.name} color={inkOf(k.color)} />{k.name}
          </button>
        ))}
      </div>

      <div className="p-seg" role="group" aria-label="Job type">
        <button aria-pressed={kind === 'daily'} onClick={() => setKind('daily')}>Morning quests ({data.jobs.filter((j) => j.kid_id === kidId && j.kind === 'daily').length})</button>
        <button aria-pressed={kind === 'bonus'} onClick={() => setKind('bonus')}>Bonus jobs ({data.jobs.filter((j) => j.kid_id === kidId && j.kind === 'bonus').length})</button>
      </div>

      {list.length === 0 ? (
        <div className="p-card p-empty">No {kind === 'daily' ? 'morning quests' : 'bonus jobs'} for {kid?.name ?? 'this child'} yet.</div>
      ) : (
        <div className="p-list">
          {list.map((j) => (
            <div key={j.id} className="p-row" style={j.active ? undefined : { opacity: 0.55 }}>
              <Icon name={j.icon} size={24} strokeWidth={1.8} />
              <div className="grow">
                <div className="t">{j.title}</div>
                <div className="m">
                  {j.stars} stars · {j.kind === 'daily' ? daysText(j.days) : `up to ${j.max_per_week}× a week`}
                  {j.active ? '' : ' · switched off'}
                </div>
              </div>
              <button className="p-toggle" aria-pressed={j.active} aria-label={`${j.title} ${j.active ? 'on' : 'off'}`} onClick={() => toggleActive(j)} />
              <button className="p-icon-btn plain" aria-label={`Edit ${j.title}`} onClick={() => startEdit(j)}><Icon d={UI_ICONS.edit} size={18} /></button>
            </div>
          ))}
        </div>
      )}
    </ParentLayout>
  );
}
