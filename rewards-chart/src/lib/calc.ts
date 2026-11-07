// All the game maths in one place, as plain functions so they can be tested.
import type { Adjustment, BonusLog, Completion, FamilyData, Job, Kid, Payout, Settings } from './types';
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
  base: number;
  earned: number; // from approved bonus jobs today
  given: number; // parent top-ups today
  taken: number; // parent deductions today (positive number)
  total: number;
  takenReasons: Adjustment[];
}

export interface KidSummary {
  kid: Kid;
  today: string;
  weekStart: string;
  todayJobs: TodayJob[];
  doneCount: number;
  totalCount: number;
  allDone: boolean;
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
  streak: number;
  payout?: Payout;
}

export function dailyJobsFor(kidId: string, jobs: Job[], day: string): Job[] {
  const wd = weekdayOf(day);
  return jobs
    .filter((j) => j.kid_id === kidId && j.kind === 'daily' && j.active && j.days.includes(wd))
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
}

export function bonusJobsFor(kidId: string, jobs: Job[]): Job[] {
  return jobs
    .filter((j) => j.kid_id === kidId && j.kind === 'bonus' && j.active)
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
    const c = completions.find((x) => x.job_id === job.id && x.day === day);
    if (!c) return false;
    const at = localParts(new Date(c.created_at), settings.timezone);
    if (at.day !== day || at.secondsOfDay > deadline) return false;
  }
  return true;
}

function allDoneOn(kidId: string, day: string, jobs: Job[], completions: Completion[]): boolean | null {
  const dayJobs = dailyJobsFor(kidId, jobs, day);
  if (dayJobs.length === 0) return null; // nothing to do that day — doesn't count either way
  return dayJobs.every((j) => completions.some((c) => c.job_id === j.id && c.day === day));
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

export function summarizeKid(kid: Kid, data: FamilyData, now: Date): KidSummary {
  const { settings, jobs } = data;
  const today = localParts(now, settings.timezone).day;
  const ws = weekStart(today);
  const completions = data.completions.filter((c) => c.kid_id === kid.id);
  const bonusLogs = data.bonusLogs.filter((b) => b.kid_id === kid.id);
  const adjustments = data.adjustments.filter((a) => a.kid_id === kid.id);

  const todayJobs: TodayJob[] = dailyJobsFor(kid.id, jobs, today).map((job) => {
    const completion = completions.find((c) => c.job_id === job.id && c.day === today);
    return { job, done: !!completion, completion };
  });
  const doneCount = todayJobs.filter((t) => t.done).length;

  const weekLogs = bonusLogs.filter((b) => inWeek(b.day, ws));
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

  // Stars this week: ticked jobs + approved bonus jobs + speed bonuses + parent star adjustments.
  let speedBonuses = 0;
  for (let d = ws; d <= today; d = addDays(d, 1)) {
    if (earnedSpeedBonus(kid.id, d, jobs, completions, settings)) speedBonuses++;
  }
  const weekStars =
    sum(completions.filter((c) => inWeek(c.day, ws)).map((c) => c.stars)) +
    sum(weekLogs.filter((b) => b.status === 'approved').map((b) => b.stars)) +
    speedBonuses * settings.speed_bonus_stars +
    sum(adjustments.filter((a) => a.kind === 'stars' && inWeek(a.day, ws)).map((a) => Number(a.amount)));
  const pendingStars = sum(weekLogs.filter((b) => b.status === 'pending').map((b) => b.stars));

  // Pocket money: $1 per `stars_per_dollar` stars, up to the weekly amount, then any money given/taken.
  const target = Number(kid.weekly_pocket_money);
  const spd = Math.max(1, settings.stars_per_dollar);
  const countedStars = Math.max(0, weekStars);
  const earnedDollars = Math.min(target, Math.floor(countedStars / spd));
  const weekMoneyAdj = adjustments.filter((a) => a.kind === 'money' && inWeek(a.day, ws));
  const moneyAdjust = sum(weekMoneyAdj.map((a) => Number(a.amount)));
  const money = Math.max(0, Math.round((earnedDollars + moneyAdjust) * 100) / 100);
  const toGo = Math.max(0, Math.round((target - money) * 100) / 100);
  const starsToNextDollar = earnedDollars >= target ? 0 : spd - (countedStars % spd);
  const coinsTotal = Math.ceil(target);

  // Tech time is a daily allowance.
  const todayTech = adjustments.filter((a) => a.kind === 'tech' && a.day === today);
  const techEarned = sum(
    bonusLogs.filter((b) => b.day === today && b.status === 'approved').map((b) => b.tech_minutes),
  );
  const techGiven = sum(todayTech.filter((a) => a.amount > 0).map((a) => Number(a.amount)));
  const techTaken = -sum(todayTech.filter((a) => a.amount < 0).map((a) => Number(a.amount)));
  const tech: TechState = {
    base: kid.daily_tech_minutes,
    earned: techEarned,
    given: techGiven,
    taken: techTaken,
    total: Math.max(0, kid.daily_tech_minutes + techEarned + techGiven - techTaken),
    takenReasons: todayTech.filter((a) => a.amount < 0),
  };

  const lifetimeStars = Math.max(
    0,
    sum(completions.map((c) => c.stars)) +
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
    moneyTaken: weekMoneyAdj.filter((a) => a.amount < 0),
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
