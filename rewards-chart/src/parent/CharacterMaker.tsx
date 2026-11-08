import { useRef, useState } from 'react';
import { KidAvatar } from '../components/KidAvatar';
import { useFamily } from '../lib/store';
import type { Kid } from '../lib/types';

const STYLES = [
  { id: 'surprise', label: '🎲 Surprise me' },
  { id: 'hero', label: 'Action hero' },
  { id: 'armour', label: 'Sci-fi armour' },
  { id: 'space', label: 'Space ranger' },
  { id: 'knight', label: 'Knight' },
  { id: 'basketball', label: 'Basketball star' },
  { id: 'afl', label: 'Aussie Rules (AFL)' },
  { id: 'martial', label: 'Martial arts' },
  { id: 'soccer', label: 'Soccer star' },
  { id: 'skater', label: 'Skater' },
];

/** Shrinks a phone photo to at most 1024px and turns it into a JPEG data URL. */
async function prepare(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that photo. Try a JPEG or PNG.'));
      i.src = src;
    });
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function CharacterMaker({ kid }: { kid: Kid }) {
  const { makeAvatar, saveKid } = useFamily();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [style, setStyle] = useState('surprise');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ path: string; url: string | null } | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    setMsg(null);
    setResult(null);
    try {
      setPhoto(await prepare(file));
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
  }

  async function make() {
    if (!photo) return;
    setBusy(true);
    setMsg(null);
    const res = await makeAvatar(kid.id, photo, style);
    setBusy(false);
    if (res.error || !res.path) setMsg({ kind: 'err', text: res.error ?? 'Something went wrong. Try again.' });
    else setResult({ path: res.path, url: res.url ?? null });
  }

  async function keep() {
    if (!result) return;
    const err = await saveKid({ id: kid.id, avatar_path: result.path });
    if (err) setMsg({ kind: 'err', text: err });
    else {
      setMsg({ kind: 'ok', text: `${kid.name}'s new character is on the iPad.` });
      setPhoto(null);
      setResult(null);
    }
  }

  async function remove() {
    const err = await saveKid({ id: kid.id, avatar_path: null });
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'Character removed. Showing the letter again.' });
  }

  return (
    <div className="p-field">
      <span>Game character</span>
      <div className="p-inline" style={{ alignItems: 'flex-start' }}>
        <KidAvatar kid={kid} style={{ width: 72, height: 72, borderRadius: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#120F3A' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />
          <button className="p-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            {photo ? 'Choose a different photo' : 'Upload a photo'}
          </button>
          {kid.avatar_path && !photo && (
            <button className="p-btn" onClick={remove}>Remove character</button>
          )}
        </div>
      </div>

      {photo && !result && (
        <div className="p-card p-section" style={{ marginTop: 4 }}>
          <img src={photo} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 12, background: '#f0f1f5' }} />
          <div className="p-pills">
            {STYLES.map((s) => (
              <button key={s.id} className="p-pill" aria-pressed={style === s.id} onClick={() => setStyle(s.id)}>{s.label}</button>
            ))}
          </div>
          <button className="p-btn primary block" onClick={make} disabled={busy}>
            {busy ? 'Creating character… (up to a minute)' : `Make ${kid.name} a game character`}
          </button>
          <button
            className="p-btn block"
            disabled={busy}
            onClick={() => {
              setPhoto(null);
              setMsg(null);
              if (fileRef.current) fileRef.current.value = '';
            }}
          >
            Cancel
          </button>
          <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>
            The photo is sent to an AI image service to draw the character. Only the finished character is saved.
          </p>
        </div>
      )}

      {result && (
        <div className="p-card p-section" style={{ marginTop: 4 }}>
          {result.url && <img src={result.url} alt={`${kid.name} as a game character`} style={{ width: '100%', borderRadius: 16 }} />}
          <button className="p-btn primary block" onClick={keep} disabled={busy}>Use this one</button>
          <div className="p-grid2">
            <button className="p-btn" onClick={make} disabled={busy}>{busy ? 'Creating…' : 'Try again'}</button>
            <button className="p-btn" onClick={() => setResult(null)} disabled={busy}>Change style</button>
          </div>
          <button
            className="p-btn block"
            disabled={busy}
            onClick={() => {
              setResult(null);
              setPhoto(null);
              setMsg(null);
              if (fileRef.current) fileRef.current.value = '';
            }}
          >
            Cancel
          </button>
          <p className="p-label" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, margin: 0 }}>
            Style: {STYLES.find((x) => x.id === style)?.label}. Try again makes a new one in the same style.
          </p>
        </div>
      )}

      {msg && <div className={`p-msg ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
