import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { KidAvatar } from '../components/KidAvatar';
import { STAR_MILESTONES, summarizeKid, timerState } from '../lib/calc';
import { DailyQuote } from './DailyQuote';
import { WeekCalendar } from './WeekCalendar';
import { useFamily, useNow } from '../lib/store';
import { localParts } from '../lib/time';

function darken(hex: string, amount = 0.35): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (v: number) => Math.round(v * (1 - amount));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export function PlayerPick() {
  const { data, loading } = useFamily();
  const now = useNow(1000);
  const timer = timerState(data.settings, now);
  const tz = data.settings.timezone;
  const local = localParts(now, tz);
  const hour = local.secondsOfDay / 3600;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const clock = now.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: tz }).replace(' ', '').toLowerCase();
  const weekday = now.toLocaleDateString('en-AU', { weekday: 'long', timeZone: tz });
  const mins = Math.ceil(timer.secondsLeft / 60);

  // The line under the greeting depends on the day and the countdown.
  let line: string;
  if (timer.phase === 'none') {
    line = timer.schoolDay
      ? hour < 15
        ? 'Have an awesome day at school!'
        : 'Welcome home! Time for evening quests.'
      : `No school today. Happy ${weekday}!`;
  } else if (timer.secondsLeft === 0) {
    line = "It's time to leave for school. Shoes on, let's go!";
  } else if (mins <= 1) {
    line = 'Less than a minute until it’s time to leave for school!';
  } else {
    line = `There ${mins === 1 ? 'is' : 'are'} only ${mins} minutes until it's time to leave for school!`;
  }
  const lineColor =
    timer.phase === 'bonus' ? '#5BD45B' : timer.phase === 'move' ? '#FFC94A' : timer.phase === 'none' ? '#B9B6E8' : '#FF6B6B';

  return (
    <main className="pick with-cal">
      <div className="pick-top">
        <div className="greeting">
          {greeting}! It's <span className="greeting-time">{clock}</span>
        </div>
        <div className="greeting-line" style={{ color: lineColor }}>
          {timer.phase !== 'none' && <Icon d={UI_ICONS.clock} size={22} strokeWidth={2.4} />}
          {line}
        </div>
        <h1 className="choose">CHOOSE YOUR PLAYER</h1>
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
          const stars = Math.max(0, s.weekStars);
          const prevM = STAR_MILESTONES.filter((m) => m.stars <= stars).pop()?.stars ?? 0;
          const pct = s.nextMilestone ? Math.round(((stars - prevM) / (s.nextMilestone.stars - prevM)) * 100) : 100;
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
                  <span className="cash">{stars}★</span>
                  <span>{s.nextMilestone ? `${s.nextMilestone.stars - stars} to +${s.nextMilestone.minutes} min` : 'Track complete!'}</span>
                </div>
                <div className="bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="sub">
                  <span>{s.allDone ? (s.tech.weekend ? 'All jobs done!' : 'Play time unlocked!') : `Morning jobs ${s.doneCount}/${s.totalCount}`}</span>
                  <span>{s.tech.ban ? 'Tech time dead' : s.tech.running ? 'Tech on now' : `Tech ${Math.floor(s.tech.remainingSeconds / 60)} min`}</span>
                </div>
              </div>
              <div className="cta">PLAY AS {kid.name.toUpperCase()}</div>
            </Link>
          );
        })}
      </div>

      <WeekCalendar events={data.events ?? []} kids={data.kids} today={local.day} />

      <DailyQuote day={local.day} />

      <Link to="/parent" className="parents-link">
        <Icon d={UI_ICONS.lock} size={18} />
        Parents
      </Link>
    </main>
  );
}
