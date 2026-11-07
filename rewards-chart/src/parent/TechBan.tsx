import { useState } from 'react';
import { Icon, UI_ICONS } from '../components/Icon';
import { activeBan } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { banEndText, localParts } from '../lib/time';
import type { Kid } from '../lib/types';

const LENGTHS: { id: string; label: string; ms: (secondsLeftToday: number) => number | null }[] = [
  { id: 'today', label: 'Rest of today', ms: (left) => left * 1000 },
  { id: '1d', label: '1 day', ms: () => 24 * 3600_000 },
  { id: '3d', label: '3 days', ms: () => 3 * 24 * 3600_000 },
  { id: '1w', label: '1 week', ms: () => 7 * 24 * 3600_000 },
  { id: '2w', label: '2 weeks', ms: () => 14 * 24 * 3600_000 },
  { id: 'lift', label: 'Until I lift it', ms: () => null },
];

/** "Tech time dead": wipes out a child's tech time in one go, for a set time. */
export function TechBan({ kid }: { kid: Kid }) {
  const { data, saveKid } = useFamily();
  const now = useNow(30_000);
  const [open, setOpen] = useState(false);
  const [length, setLength] = useState('1w');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tz = data.settings.timezone;
  const ban = activeBan(kid, now);

  async function apply() {
    if (!reason.trim()) {
      setError('Add a short reason so they know why.');
      return;
    }
    const left = 86400 - localParts(now, tz).secondsOfDay;
    const ms = LENGTHS.find((l) => l.id === length)!.ms(left);
    setSaving(true);
    const err = await saveKid({
      id: kid.id,
      tech_banned: true,
      tech_ban_until: ms === null ? null : new Date(now.getTime() + ms).toISOString(),
      tech_ban_reason: reason.trim(),
      tech_ban_started_at: new Date().toISOString(),
    });
    setSaving(false);
    if (err) setError(err);
    else {
      setOpen(false);
      setReason('');
      setError(null);
    }
  }

  async function lift() {
    setSaving(true);
    const err = await saveKid({ id: kid.id, tech_banned: false, tech_ban_until: null, tech_ban_reason: '', tech_ban_started_at: null });
    setSaving(false);
    setError(err);
  }

  if (ban) {
    return (
      <div className="p-card" style={{ borderColor: '#c62828', background: '#fdeaea', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#8a1c1c' }}>
          <Icon d={UI_ICONS.gamepad} size={20} />
          {kid.name}'s tech time is dead
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Banned {banEndText(ban.until, tz)}{ban.reason ? ` · ${ban.reason}` : ''}
        </div>
        {error && <div className="p-msg err">{error}</div>}
        <button className="p-btn" onClick={lift} disabled={saving}>{saving ? 'Lifting…' : 'Lift the ban now'}</button>
      </div>
    );
  }

  if (!open) {
    return (
      <button className="p-btn danger block" onClick={() => setOpen(true)} style={{ height: 52 }}>
        <Icon d={UI_ICONS.gamepad} size={20} />
        Tech time dead for {kid.name}
      </button>
    );
  }

  return (
    <div className="p-card p-section" style={{ borderColor: '#c62828' }}>
      <p className="p-label" style={{ color: '#8a1c1c' }}>Tech time dead: {kid.name}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
        All tech time goes to zero and the iPad shows TECH TIME DEAD until the ban ends.
      </p>
      <div className="p-field">
        <span>How long</span>
        <div className="p-pills">
          {LENGTHS.map((l) => (
            <button key={l.id} className="p-pill" aria-pressed={length === l.id} onClick={() => setLength(l.id)}>{l.label}</button>
          ))}
        </div>
      </div>
      <label className="p-field">
        <span>Reason (they'll see this)</span>
        <input className="p-input" maxLength={60} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Lied about homework" />
      </label>
      {error && <div className="p-msg err">{error}</div>}
      <div className="p-grid2">
        <button className="p-btn" onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
        <button className="p-btn danger" onClick={apply} disabled={saving}>{saving ? 'Saving…' : 'Ban tech time'}</button>
      </div>
    </div>
  );
}
