// Date helpers that always work in the family's time zone (not the device's),
// so the iPad and a parent's phone agree on what "today" and "this week" are.

export interface LocalParts {
  day: string; // 'YYYY-MM-DD'
  weekday: number; // 1 = Monday … 7 = Sunday
  secondsOfDay: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function localParts(date: Date, tz: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(date)) parts[p.type] = p.value;
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour) % 24;
  return {
    day,
    weekday: weekdayOf(day),
    secondsOfDay: hour * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

/** ISO weekday of a 'YYYY-MM-DD' date: 1 = Monday … 7 = Sunday. */
export function weekdayOf(day: string): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week that `day` falls in. */
export function weekStart(day: string): string {
  return addDays(day, 1 - weekdayOf(day));
}

/** '08:15:00' or '08:15' → seconds after midnight. */
export function timeToSeconds(t: string): number {
  const [h, m, s] = t.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

/** '08:15:00' → '8:15am' */
export function formatClock(t: string): string {
  const secs = timeToSeconds(t);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export function formatMoney(n: number): string {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}

/** Whole dollars without cents ($4), otherwise with cents ($4.50). */
export function formatMoneyShort(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? `$${r}` : `$${r.toFixed(2)}`;
}

/** When a tech ban ends, in words: "Sat 15 Nov, 7:00pm" or "until Mum or Dad lifts it". */
export function banEndText(until: string | null, tz: string): string {
  if (!until) return 'until Mum or Dad lifts it';
  const d = new Date(until);
  const day = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: tz }).replace(' ', '').toLowerCase();
  return `until ${day}, ${time}`;
}
