// All the game maths in one place, as plain functions so they can be tested.
import type { Adjustment, BonusLog, Completion, FamilyData, Job, JobPeriod, Kid, Payout, Settings, TechSession, CalEvent } from './types';
import { addDays, localParts, timeToSeconds, weekStart, weekdayOf } from './time';

export const STARS_PER_LEVEL = 150;

export interface TodayJob {
  job: Job;
  done: boolean;
  completion?: Completion;
}

export interface BonusJobState {
  job: Job;
  usedThisWeek: number; // pending + approved
  pendingThisWeek: number;
  remaining: number;
  latestPendingId?: string; // lets a kid undo a mistaken tap
}

export interface TechState {
  base: number; // weekly allowance
  earned: number; // from approved bonus jobs this week
  given: number; // parent top-ups this week
  taken: number; // parent deductions this week (positive number)
  total: number;
  takenReasons: Adjustment[];
  ban: TechBan | null; // "tech time dead"
  weekend: boolean; // tech time can only be used on non-school days
  usedSeconds: number; // timer time used this week
  remainingSeconds: number; // what's left this week (0 while banned)
  running: TechSession | null; // the timer that's counting down right now
  sessionLeft: number; // seconds left of the time they chose for this go (0 when not running)
  sessionIds: string[]; // this week's timer sessions (parents can reset them)
  approval: 'none' | 'requested' | 'approved'; // weekends: a parent has to say yes each day
}

/** Seconds a timer session has used, never more than it was allowed. */
export function sessionSeconds(s: TechSession, now: Date): number {
  const end = s.ended_at ? Date.parse(s.ended_at) : now.getTime();
  return Math.max(0, Math.min(s.allowed_seconds, Math.floor((end - Date.parse(s.started_at)) / 1000)));
}

export interface TechBan {
  until: string | null; // null = until a parent lifts it
  reason: string;
}

/** Is tech time banned right now? A ban with an end time stops by itself. */
export function activeBan(kid: Kid, now: Date): TechBan | null {
  if (!kid.tech_banned) return null;
  if (kid.tech_ban_until && Date.parse(kid.tech_ban_until) <= now.getTime()) return null;
  return { until: kid.tech_ban_until ?? null, reason: kid.tech_ban_reason ?? '' };
}

export interface KidSummary {
  kid: Kid;
  today: string;
  weekStart: string;
  todayJobs: TodayJob[]; // morning quests
  doneCount: number;
  totalCount: number;
  allDone: boolean; // every morning quest done (unlocks tech time)
  eveningJobs: TodayJob[];
  eveningDone: number;
  bonusJobs: BonusJobState[];
  weekStars: number;
  pendingStars: number;
  speedBonusToday: boolean;
  earnedDollars: number;
  moneyAdjust: number;
  money: number;
  target: number;
  toGo: number;
  starsToNextDollar: number;
  coinsTotal: number;
  coinsFilled: number;
  moneyTaken: Adjustment[];
  tech: TechState;
  lifetimeStars: number;
  level: number;
  levelProgress: number; // 0..1 toward next level
  missedDays: string[];
  onTrack: boolean;
  weekDone: boolean;
  moneyDays: { day: string; status: 'done' | 'missed' | 'today' | 'future' | 'none' }[]; // pocket money week tracker
  starMinutes: number; // tech minutes from stars this week
  milestoneMinutes: number;
  milestonesReached: number;
  milestones: Milestone[];
  nextMilestone: { stars: number; minutes: number } | null;
  streak: number;
  payout?: Payout;
}

const ROTATION_START = '2024-01-01'; // a Monday

function daysSince(day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${ROTATION_START}T00:00:00Z`)) / 86_400_000);
}

/**
 * Which kids a job is for on `day`. "Everyone" jobs go to all assigned kids;
 * "take turns" jobs go to one kid, moving on each time the job comes round (daily) or each week.
 */
export function kidsOnDuty(job: Job, day: string): string[] {
  const ids = job.kid_ids ?? [];
  if (job.assign_mode === 'each' || ids.length < 2) return ids;
  const n = ids.length;
  const d = daysSince(day);
  const week = Math.floor(d / 7);
  let turn: number;
  if (job.assign_mode === 'rotate_weekly' || job.kind === 'bonus') {
    turn = week;
  } else {
    // Count how many times the job has come round, so turns alternate evenly even if it skips days.
    const days = [...job.days].sort((a, b) => a - b);
    const wd = weekdayOf(day);
    turn = week * Math.max(1, days.length) + days.filter((x) => x < wd).length;
  }
  const idx = (((turn + (job.rotation_offset ?? 0)) % n) + n) % n;
  return [ids[idx]];
}

export function dailyJobsFor(kidId: string, jobs: Job[], day: string, period: JobPeriod = 'morning'): Job[] {
  const wd = weekdayOf(day);
  return jobs
    .filter(
      (j) =>
        j.kind === 'daily' &&
        j.active &&
        (j.period ?? 'morning') === period &&
        j.days.includes(wd) &&
        kidsOnDuty(j, day).includes(kidId),
    )
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
}

export function bonusJobsFor(kidId: string, jobs: Job[]): Job[] {
  return jobs
    .filter((j) => j.kind === 'bonus' && j.active && (j.kid_ids ?? []).includes(kidId))
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
}

function inWeek(day: string, ws: string): boolean {
  return day >= ws && day <= addDays(ws, 6);
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

/** Did the kid finish every daily job on `day` early enough for the speed bonus? */
export function earnedSpeedBonus(
  kidId: string,
  day: string,
  jobs: Job[],
  completions: Completion[],
  settings: Settings,
): boolean {
  if (!settings.school_days.includes(weekdayOf(day))) return false;
  const dayJobs = dailyJobsFor(kidId, jobs, day);
  if (dayJobs.length === 0) return false;
  const deadline = timeToSeconds(settings.leave_time) - settings.speed_bonus_minutes * 60;
  for (const job of dayJobs) {
    const c = completions.find((x) => x.job_id === job.id && x.kid_id === kidId && x.day === day);
    if (!c) return false;
    const at = localParts(new Date(c.created_at), settings.timezone);
    if (at.day !== day || at.secondsOfDay > deadline) return false;
  }
  return true;
}

function allDoneOn(kidId: string, day: string, jobs: Job[], completions: Completion[]): boolean | null {
  const dayJobs = dailyJobsFor(kidId, jobs, day);
  if (dayJobs.length === 0) return null; // nothing to do that day — doesn't count either way
  return dayJobs.every((j) => completions.some((c) => c.job_id === j.id && c.kid_id === kidId && c.day === day));
}

/** Days in a row with every morning job done. Today only counts once it's finished. */
export function streakFor(kidId: string, today: string, jobs: Job[], completions: Completion[]): number {
  let streak = 0;
  let day = today;
  const todayDone = allDoneOn(kidId, today, jobs, completions);
  if (todayDone !== true) day = addDays(today, -1);
  for (let i = 0; i < 120; i++) {
    const done = allDoneOn(kidId, day, jobs, completions);
    if (done === false) break;
    if (done === true) streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export type Milestone = { stars: number; minutes: number };

/** Tech minutes for a number of stars at the family rate (10 stars = N minutes). */
export function starMinutes(stars: number, settings: Settings): number {
  return Math.floor((Math.max(0, stars) / 10) * Math.max(0, Number(settings.minutes_per_10_stars ?? 10)));
}

/**
 * The weekly reward track for one child, sized to what they can really earn: five steps
 * (20% to 100%) of the stars available from their bonus jobs and speed bonuses this week. Each step shows the
 * tech minutes that many stars are worth, so changing the rate updates the track by itself.
 */
export function starMilestones(kidId: string, jobs: Job[], settings: Settings): Milestone[] {
  const bonusMax = sum(
    jobs.filter((j) => j.active && j.kind === 'bonus' && j.kid_ids.includes(kidId)).map((j) => j.stars * Math.max(1, j.max_per_week)),
  );
  // Speed bonuses (morning jobs done early) also earn stars: one chance each school day.
  const speedMax = (settings.school_days?.length ?? 5) * Math.max(0, Number(settings.speed_bonus_stars ?? 0));
  const max = bonusMax + speedMax;
  const top = Math.max(20, max);
  const steps = [0.2, 0.4, 0.6, 0.8, 1].map((f) => (f === 1 ? top : Math.max(5, Math.round((top * f) / 5) * 5)));
  return [...new Set(steps)].map((st) => ({ stars: st, minutes: starMinutes(st, settings) }));
}

/** Every daily job (morning and evening) done that day? null = nothing to do. */
function allDailyDoneOn(kidId: string, day: string, jobs: Job[], completions: Completion[]): boolean | null {
  const dayJobs = [...dailyJobsFor(kidId, jobs, day, 'morning'), ...dailyJobsFor(kidId, jobs, day, 'evening')];
  if (dayJobs.length === 0) return null;
  return dayJobs.every((j) => completions.some((c) => c.job_id === j.id && c.kid_id === kidId && c.day === day));
}

export interface WeekMoney {
  weekStars: number;
  earnedDollars: number;
  moneyAdjust: number;
  money: number;
  target: number;
  toGo: number;
  starsToNextDollar: number;
  coinsTotal: number;
  moneyTaken: Adjustment[];
  missedDays: string[]; // days the daily jobs weren't all done (no pocket money this week)
  onTrack: boolean;
  weekDone: boolean; // every day of the week finished: pocket money earned
}

/**
 * Pocket money for one week (Monday `ws` to Sunday), counting up to `upTo`.
 * All or nothing: the full weekly amount if every daily job is done every day, then any money
 * given or taken away. Days before `upTo` are judged (today can still be finished).
 */
export function weekMoney(kid: Kid, data: FamilyData, ws: string, upTo = addDays(ws, 7)): WeekMoney {
  const { settings, jobs } = data;
  const completions = data.completions.filter((c) => c.kid_id === kid.id && inWeek(c.day, ws));
  // Bonus jobs count at their current star value, so changing a job's stars updates this week too.
  const starsOf = (b: BonusLog) => jobs.find((j) => j.id === b.job_id)?.stars ?? b.stars;
  const logs = data.bonusLogs.filter((b) => b.kid_id === kid.id && inWeek(b.day, ws)).map((b) => ({ ...b, stars: starsOf(b) }));
  const adj = data.adjustments.filter((a) => a.kid_id === kid.id && inWeek(a.day, ws));
  const last = upTo < addDays(ws, 6) ? upTo : addDays(ws, 6);

  let speedBonuses = 0;
  for (let d = ws; d <= last; d = addDays(d, 1)) {
    if (earnedSpeedBonus(kid.id, d, jobs, completions, settings)) speedBonuses++;
  }
  // Regular jobs don't earn stars (they unlock tech time and pocket money); bonus jobs do.
  const weekStars =
    sum(logs.filter((b) => b.status === 'approved').map((b) => b.stars)) +
    speedBonuses * settings.speed_bonus_stars +
    sum(adj.filter((a) => a.kind === 'stars').map((a) => Number(a.amount)));

  const target = Number(kid.weekly_pocket_money);
  const allCompletions = data.completions.filter((c) => c.kid_id === kid.id);
  const missedDays: string[] = [];
  for (let d = ws; d < upTo && d <= addDays(ws, 6); d = addDays(d, 1)) {
    if (allDailyDoneOn(kid.id, d, jobs, allCompletions) === false) missedDays.push(d);
  }
  const onTrack = missedDays.length === 0;
  // Only earned once every day of the week (Mon to Sun) has all its daily jobs done.
  let weekDone = true;
  for (let d = ws; d <= addDays(ws, 6); d = addDays(d, 1)) {
    if (allDailyDoneOn(kid.id, d, jobs, allCompletions) === false) weekDone = false;
  }
  const earnedDollars = weekDone ? target : 0;
  const moneyAdj = adj.filter((a) => a.kind === 'money');
  const moneyAdjust = sum(moneyAdj.map((a) => Number(a.amount)));
  const money = Math.max(0, Math.round((earnedDollars + moneyAdjust) * 100) / 100);
  return {
    weekStars,
    earnedDollars,
    moneyAdjust,
    money,
    target,
    toGo: Math.max(0, Math.round((target - money) * 100) / 100),
    starsToNextDollar: 0,
    coinsTotal: Math.ceil(target),
    moneyTaken: moneyAdj.filter((a) => a.amount < 0),
    missedDays,
    onTrack,
    weekDone,
  };
}

export interface PayWeek {
  weekStart: string; // Monday
  payday: string; // Sunday
  amount: number; // what was earned that week
  payout?: Payout;
  status: 'paid' | 'due' | 'missed' | 'in-progress' | 'none'; // none = nothing earned, nothing to pay
}

/**
 * Week-by-week pay record, newest first. A week becomes "due" on its Sunday,
 * and "missed" once that Sunday has passed without being ticked off.
 */
export function payHistory(kid: Kid, data: FamilyData, now: Date, weeks = 8): PayWeek[] {
  const today = localParts(now, data.settings.timezone).day;
  const thisWeek = weekStart(today);
  // Pay weeks start from the first full week (Mon to Sun) after the child was added.
  const added = kid.created_at ? localParts(new Date(kid.created_at), data.settings.timezone).day : null;
  const firstWeek = added ? (weekStart(added) === added ? added : addDays(weekStart(added), 7)) : addDays(thisWeek, -7 * (weeks - 1));
  const out: PayWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    const ws = addDays(thisWeek, -7 * i);
    if (ws < firstWeek) break;
    const payday = addDays(ws, 6);
    const payout = data.payouts.find((p) => p.kid_id === kid.id && p.week_start === ws);
    const amount = weekMoney(kid, data, ws, today).money;
    let status: PayWeek['status'];
    if (payout) status = 'paid';
    else if (today < payday) status = 'in-progress';
    else if (amount <= 0) status = 'none';
    else if (today === payday) status = 'due';
    else status = 'missed';
    out.push({ weekStart: ws, payday, amount, payout, status });
  }
  return out;
}

export function summarizeKid(kid: Kid, data: FamilyData, now: Date): KidSummary {
  const { settings, jobs } = data;
  const today = localParts(now, settings.timezone).day;
  const ws = weekStart(today);
  const completions = data.completions.filter((c) => c.kid_id === kid.id);
  const bonusLogs = data.bonusLogs.filter((b) => b.kid_id === kid.id);
  const adjustments = data.adjustments.filter((a) => a.kid_id === kid.id);

  const jobsFor = (period: JobPeriod): TodayJob[] =>
    dailyJobsFor(kid.id, jobs, today, period).map((job) => {
      const completion = completions.find((c) => c.job_id === job.id && c.day === today);
      return { job, done: !!completion, completion };
    });
  const todayJobs = jobsFor('morning');
  const eveningJobs = jobsFor('evening');
  const doneCount = todayJobs.filter((t) => t.done).length;

  const weekLogs = bonusLogs.filter((b) => inWeek(b.day, ws)).map((b) => ({ ...b, stars: jobs.find((j) => j.id === b.job_id)?.stars ?? b.stars }));
  const bonusJobs: BonusJobState[] = bonusJobsFor(kid.id, jobs).map((job) => {
    const logs = weekLogs.filter((b) => b.job_id === job.id && b.status !== 'rejected');
    const pending = logs.filter((b) => b.status === 'pending');
    const latestPending = [...pending].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      job,
      usedThisWeek: logs.length,
      pendingThisWeek: pending.length,
      remaining: Math.max(0, job.max_per_week - logs.length),
      latestPendingId: latestPending?.id,
    };
  });

  const m = weekMoney(kid, data, ws, today);
  const { weekStars, earnedDollars, moneyAdjust, money, target, toGo, starsToNextDollar, coinsTotal } = m;
  const pendingStars = sum(weekLogs.filter((b) => b.status === 'pending').map((b) => b.stars));

  // Tech time is a weekly allowance that starts again every Monday.
  const weekTech = adjustments.filter((a) => a.kind === 'tech' && inWeek(a.day, ws));
  // Bonus-job stars earn extra tech time at the family rate.
  const milestones = starMilestones(kid.id, jobs, settings);
  const shownStars = Math.max(0, weekStars);
  const st = {
    fromStars: starMinutes(weekStars, settings),
    fromMilestones: 0,
    reached: milestones.filter((m) => shownStars >= m.stars).length,
    next: milestones.find((m) => shownStars < m.stars) ?? null,
  };
  const techEarned = st.fromStars;
  const techGiven = sum(weekTech.filter((a) => a.amount > 0).map((a) => Number(a.amount)));
  const techTaken = -sum(weekTech.filter((a) => a.amount < 0).map((a) => Number(a.amount)));
  const ban = activeBan(kid, now);
  const allowance = Math.max(0, kid.weekly_tech_minutes + techEarned + techGiven - techTaken);
  const weekSessions = (data.techSessions ?? []).filter(
    (t) => t.kid_id === kid.id && inWeek(localParts(new Date(t.started_at), settings.timezone).day, ws),
  );
  const usedSeconds = weekSessions.reduce((a, t) => a + sessionSeconds(t, now), 0);
  const open = weekSessions.find((t) => !t.ended_at && sessionSeconds(t, now) < t.allowed_seconds) ?? null;
  const tech: TechState = {
    base: kid.weekly_tech_minutes,
    earned: techEarned,
    given: techGiven,
    taken: techTaken,
    total: ban ? 0 : allowance,
    takenReasons: weekTech.filter((a) => a.amount < 0),
    ban,
    weekend: !settings.school_days.includes(weekdayOf(today)),
    usedSeconds,
    remainingSeconds: ban ? 0 : Math.max(0, allowance * 60 - usedSeconds),
    running: ban ? null : open,
    sessionLeft: !ban && open ? Math.max(0, open.allowed_seconds - sessionSeconds(open, now)) : 0,
    sessionIds: weekSessions.map((t) => t.id),
    approval: (data.techApprovals ?? []).find((a) => a.kid_id === kid.id && a.day === today)?.status ?? 'none',
  };

  const lifetimeStars = Math.max(
    0,
    sum(bonusLogs.filter((b) => b.status === 'approved').map((b) => b.stars)) +
      sum(adjustments.filter((a) => a.kind === 'stars').map((a) => Number(a.amount))),
  );

  return {
    kid,
    today,
    weekStart: ws,
    todayJobs,
    doneCount,
    totalCount: todayJobs.length,
    allDone: todayJobs.length > 0 && doneCount === todayJobs.length,
    eveningJobs,
    eveningDone: eveningJobs.filter((t) => t.done).length,
    bonusJobs,
    weekStars,
    pendingStars,
    speedBonusToday: earnedSpeedBonus(kid.id, today, jobs, completions, settings),
    earnedDollars,
    moneyAdjust,
    money,
    target,
    toGo,
    starsToNextDollar,
    coinsTotal,
    coinsFilled: Math.min(coinsTotal, Math.floor(money)),
    moneyTaken: m.moneyTaken,
    missedDays: m.missedDays,
    onTrack: m.onTrack,
    weekDone: m.weekDone,
    moneyDays: Array.from({ length: 7 }, (_, i) => {
      const day = addDays(ws, i);
      const st = allDailyDoneOn(kid.id, day, jobs, completions);
      const status: 'done' | 'missed' | 'today' | 'future' | 'none' =
        day > today ? 'future' : st === true ? 'done' : st === null ? 'none' : day === today ? 'today' : 'missed';
      return { day, status };
    }),
    starMinutes: st.fromStars,
    milestoneMinutes: st.fromMilestones,
    milestonesReached: st.reached,
    milestones,
    nextMilestone: st.next,
    tech,
    lifetimeStars,
    level: Math.floor(lifetimeStars / STARS_PER_LEVEL) + 1,
    levelProgress: (lifetimeStars % STARS_PER_LEVEL) / STARS_PER_LEVEL,
    streak: streakFor(kid.id, today, jobs, completions),
    payout: data.payouts.find((p) => p.kid_id === kid.id && p.week_start === ws),
  };
}

export type TimerPhase = 'bonus' | 'move' | 'closing' | 'go' | 'none';

export interface TimerState {
  schoolDay: boolean;
  secondsLeft: number;
  fraction: number; // 1 = full ring, 0 = empty
  phase: TimerPhase;
}

/** The "leave for school" countdown. */
export function timerState(settings: Settings, now: Date): TimerState {
  const p = localParts(now, settings.timezone);
  const schoolDay = settings.school_days.includes(p.weekday);
  if (!schoolDay) return { schoolDay, secondsLeft: 0, fraction: 0, phase: 'none' };
  const left = timeToSeconds(settings.leave_time) - p.secondsOfDay;
  if (left <= -3600) return { schoolDay, secondsLeft: 0, fraction: 0, phase: 'none' }; // gone to school
  const secondsLeft = Math.max(0, left);
  const window = Math.max(60, settings.countdown_minutes * 60);
  const fraction = Math.min(1, secondsLeft / window);
  let phase: TimerPhase;
  if (secondsLeft === 0) phase = 'go';
  else if (secondsLeft > settings.speed_bonus_minutes * 60) phase = 'bonus';
  else if (secondsLeft > 5 * 60) phase = 'move';
  else phase = 'closing';
  return { schoolDay, secondsLeft, fraction, phase };
}

export function pendingBonusLogs(data: FamilyData): BonusLog[] {
  return data.bonusLogs
    .filter((b) => b.status === 'pending')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ─────────────────────────────── Calendar ───────────────────────────────

/** Events on one day: one-off events on that date, plus weekly ones on the same weekday from their start. */
export function eventsOn(events: CalEvent[], day: string): CalEvent[] {
  return events
    .filter((e) =>
      e.repeat === 'weekly'
        ? e.day <= day && (!e.end_day || day <= e.end_day) && weekdayOf(e.day) === weekdayOf(day)
        : e.day <= day && day <= (e.end_day ?? e.day),
    )
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '') || a.title.localeCompare(b.title));
}

/** The seven days (Monday first) of the week `offset` weeks from the one containing `today`. */
export function weekDays(today: string, offset = 0): string[] {
  const start = addDays(weekStart(today), offset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Next upcoming date (today or later) for an event, or null if a one-off has passed. */
export function nextDate(e: CalEvent, today: string): string | null {
  if (e.repeat !== 'weekly') {
    if (e.day >= today) return e.day;
    return (e.end_day ?? e.day) >= today ? today : null; // still running
  }
  if (e.day >= today) return e.day;
  const next = addDays(today, (weekdayOf(e.day) - weekdayOf(today) + 7) % 7);
  return e.end_day && next > e.end_day ? null : next;
}
