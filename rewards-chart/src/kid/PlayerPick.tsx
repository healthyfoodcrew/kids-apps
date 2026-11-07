import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { KidAvatar } from '../components/KidAvatar';
import { summarizeKid, timerState } from '../lib/calc';
import { useFamily, useNow } from '../lib/store';
import { formatMoneyShort } from '../lib/time';

function darken(hex: string, amount = 0.35): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (v: number) => Math.round(v * (1 - amount));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export function PlayerPick() {
  const { data, loading } = useFamily();
  const now = useNow(1000);
  const timer = timerState(data.settings, now);
  const mm = Math.floor(timer.secondsLeft / 60);
  const ss = String(timer.secondsLeft % 60).padStart(2, '0');

  return (
    <main className="pick">
      <div className="pick-top">
        {timer.phase !== 'none' && (
          <span className="leave-pill" style={{ background: timer.phase === 'bonus' ? '#5BD45B' : timer.phase === 'move' ? '#FFC94A' : '#FF6B6B' }}>
            <Icon d={UI_ICONS.clock} size={18} strokeWidth={2.4} />
            {timer.secondsLeft > 0 ? `LEAVE FOR SCHOOL IN ${mm}:${ss}` : 'TIME TO GO!'}
          </span>
        )}
        <h1>CHOOSE YOUR PLAYER</h1>
      </div>

      <div className="pick-grid">
        {!loading && data.kids.length === 0 && (
          <div className="message-card">
            <h1>No players yet</h1>
            <p>Ask Mum or Dad to add you in the parent screens.</p>
          </div>
        )}
        {data.kids.map((kid) => {
          const s = summarizeKid(kid, data, now);
          const pct = s.target > 0 ? Math.min(100, Math.round((s.money / s.target) * 100)) : 0;
          return (
            <Link
              key={kid.id}
              to={`/kid/${kid.id}`}
              className="player"
              style={{ '--kid': kid.color, '--kid-shadow': darken(kid.color) } as CSSProperties}
            >
              <KidAvatar kid={kid} className="face" />
              <div className="name">{kid.name.toUpperCase()}</div>
              <div className="lvl">LEVEL {s.level}</div>
              <div className="stats">
                <div className="row">
                  <span className="cash">{formatMoneyShort(s.money)}</span>
                  <span>{s.toGo > 0 ? `${formatMoneyShort(s.toGo)} to go` : 'All earned!'}</span>
                </div>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="sub">
                  <span>Quests today {s.doneCount}/{s.totalCount}</span>
                  <span>{s.tech.ban ? 'Tech time dead' : `Tech ${s.tech.total} min this week`}</span>
                </div>
              </div>
              <div className="cta">PLAY AS {kid.name.toUpperCase()}</div>
            </Link>
          );
        })}
      </div>

      <Link to="/parent" className="parents-link">
        <Icon d={UI_ICONS.lock} size={18} />
        Parents
      </Link>
    </main>
  );
}
