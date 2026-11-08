import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { EventIcon } from '../components/EventIcon';
import { Icon, UI_ICONS } from '../components/Icon';
import { eventsOn, weekDays } from '../lib/calc';
import { formatClock } from '../lib/time';
import type { CalEvent, Kid } from '../lib/types';

export const FAMILY_COLOR = '#FFC94A';
const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MAX_SHOWN = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Colour of an event: the child's colour if it's just for one of them, gold for the family. */
export function eventColor(e: CalEvent, kids: Kid[]): string {
  if (e.kid_ids.length === 1) return kids.find((k) => k.id === e.kid_ids[0])?.color ?? FAMILY_COLOR;
  return FAMILY_COLOR;
}

export function eventWho(e: CalEvent, kids: Kid[]): string {
  if (e.kid_ids.length === 0 || e.kid_ids.length >= kids.length) return 'Family';
  return kids.filter((k) => e.kid_ids.includes(k.id)).map((k) => k.name).join(' & ');
}

function shortTime(t: string | null): string {
  if (!t) return 'All day';
  return formatClock(t).replace(':00', '');
}

/** The family's week on the iPad home screen, Monday to Sunday. */
export function WeekCalendar({ events, kids, today }: { events: CalEvent[]; kids: Kid[]; today: string }) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<{ e: CalEvent; day: string } | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const days = weekDays(today, offset);
  const first = days[0];
  const last = days[6];
  const range = `${Number(first.slice(8))} ${MONTHS[Number(first.slice(5, 7)) - 1]} – ${Number(last.slice(8))} ${MONTHS[Number(last.slice(5, 7)) - 1]}`;
  const title = offset === 0 ? 'THIS WEEK' : offset === 1 ? 'NEXT WEEK' : offset === -1 ? 'LAST WEEK' : range.toUpperCase();

  return (
    <section className="panel week-cal" aria-label="Family calendar">
      <div className="wc-head">
        <div className="wc-title">
          <h2>{title}</h2>
          <span className="wc-range">{range}</span>
        </div>
        <div className="wc-legend" aria-hidden="true">
          {kids.map((k) => (
            <span key={k.id}><i style={{ background: k.color }} />{k.name.toUpperCase()}</span>
          ))}
          <span><i style={{ background: FAMILY_COLOR }} />FAMILY</span>
        </div>
        <div className="wc-nav">
          <button onClick={() => setOffset((o) => Math.max(-1, o - 1))} disabled={offset <= -1} aria-label="Previous week">
            <Icon d="M15 5l-7 7 7 7" size={20} strokeWidth={2.6} />
          </button>
          <button onClick={() => setOffset((o) => Math.min(8, o + 1))} disabled={offset >= 8} aria-label="Next week">
            <Icon d="M9 5l7 7-7 7" size={20} strokeWidth={2.6} />
          </button>
          <Link to="/add-event" className="wc-add" aria-label="Add an event">
            <Icon d={UI_ICONS.plus} size={18} strokeWidth={3} />ADD
          </Link>
        </div>
      </div>

      <div className="wc-grid">
        {days.map((d, i) => {
          const evs = eventsOn(events, d);
          const isToday = d === today;
          return (
            <div key={d} className={`wc-day${isToday ? ' today' : ''}${d < today ? ' past' : ''}`}>
              <div className="wc-date">
                <span className="dn">{isToday ? 'TODAY' : DAY_NAMES[i]}</span>
                <span className="dd">{Number(d.slice(8))}</span>
              </div>
              <div className="wc-events">
                {evs.slice(0, evs.length > MAX_SHOWN ? MAX_SHOWN - 1 : MAX_SHOWN).map((e) => {
                  const c = eventColor(e, kids);
                  return (
                    <button key={e.id} className="wc-ev" style={{ '--ev': c } as CSSProperties} onClick={() => setOpen({ e, day: d })}>
                      <span className="ev-top">
                        <EventIcon name={e.icon} size={15} color={isToday ? '#3a2600' : c} />
                        <span className="ev-time">{shortTime(e.start_time)}</span>
                      </span>
                      <span className="ev-title">{e.title}</span>
                    </button>
                  );
                })}
                {evs.length > MAX_SHOWN && (
                  <button className="wc-more" onClick={() => setOpenDay(d)}>+{evs.length - (MAX_SHOWN - 1)} MORE</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openDay && (
        <div className="wc-pop" role="dialog" aria-label="Everything on this day" onClick={() => setOpenDay(null)}>
          <div className="wc-pop-card" style={{ '--ev': FAMILY_COLOR } as CSSProperties} onClick={(ev) => ev.stopPropagation()}>
            <h3>{DAY_NAMES[days.indexOf(openDay)]} {Number(openDay.slice(8))} {MONTHS[Number(openDay.slice(5, 7)) - 1]}</h3>
            <div className="pop-list">
              {eventsOn(events, openDay).map((e) => {
                const c = eventColor(e, kids);
                return (
                  <button key={e.id} className="pop-row" style={{ '--ev': c } as CSSProperties} onClick={() => { setOpenDay(null); setOpen({ e, day: openDay }); }}>
                    <span className="pop-row-icon"><EventIcon name={e.icon} size={24} color="#1d1a52" /></span>
                    <span className="pop-row-text">
                      <b>{e.title}</b>
                      <span>{e.start_time ? formatClock(e.start_time) : 'All day'} · {eventWho(e, kids)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button className="pop-close" onClick={() => setOpenDay(null)}>OK!</button>
          </div>
        </div>
      )}

      {open && (
        <div className="wc-pop" role="dialog" aria-label={open.e.title} onClick={() => setOpen(null)}>
          <div className="wc-pop-card" style={{ '--ev': eventColor(open.e, kids) } as CSSProperties} onClick={(ev) => ev.stopPropagation()}>
            <span className="pop-icon"><EventIcon name={open.e.icon} size={44} color="#1d1a52" /></span>
            <h3>{open.e.title}</h3>
            <p className="pop-when">
              {DAY_NAMES[days.indexOf(open.day)] ?? ''} {Number(open.day.slice(8))} {MONTHS[Number(open.day.slice(5, 7)) - 1]} · {open.e.start_time ? formatClock(open.e.start_time) : 'All day'}
              {open.e.repeat === 'weekly' ? ' · every week' : ''}
            </p>
            <p className="pop-who">{eventWho(open.e, kids).toUpperCase()}</p>
            {open.e.note && <p className="pop-note">{open.e.note}</p>}
            <button className="pop-close" onClick={() => setOpen(null)}>OK!</button>
          </div>
        </div>
      )}
    </section>
  );
}
