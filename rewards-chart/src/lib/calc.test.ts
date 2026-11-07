import { describe, expect, it } from 'vitest';
import { earnedSpeedBonus, streakFor, summarizeKid, timerState } from './calc';
import { addDays, localParts, weekStart } from './time';
import { DEFAULT_SETTINGS, type FamilyData, type Job, type Kid } from './types';

const settings = { ...DEFAULT_SETTINGS };
const kid: Kid = { id: 'k1', name: 'Louie', age: 7, color: '#2EE6D6', weekly_pocket_money: 8, daily_tech_minutes: 30, sort: 1 };

function job(id: string, kind: 'daily' | 'bonus', stars = 10, days = [1, 2, 3, 4, 5, 6, 7]): Job {
  return { id, kid_id: 'k1', title: id, icon: 'star', kind, stars, max_per_week: 3, days, active: true, sort: 0 };
}

const jobs = [job('bed', 'daily'), job('teeth', 'daily'), job('dish', 'bonus', 15)];

// Wednesday 12 Nov 2025 07:40 in Melbourne (UTC+11) = Tuesday 20:40 UTC.
const wedMorning = new Date('2025-11-11T20:40:00Z');
const today = '2025-11-12';

function data(partial: Partial<FamilyData>): FamilyData {
  return { settings, kids: [kid], jobs, completions: [], bonusLogs: [], adjustments: [], payouts: [], ...partial };
}

function done(jobId: string, day: string, atUtc: string) {
  return { id: `${jobId}-${day}`, job_id: jobId, kid_id: 'k1', day, stars: 10, created_at: atUtc };
}

describe('time helpers', () => {
  it('uses the family time zone for today', () => {
    expect(localParts(wedMorning, 'Australia/Melbourne').day).toBe(today);
    expect(localParts(wedMorning, 'Australia/Melbourne').weekday).toBe(3);
  });
  it('weeks start on Monday', () => {
    expect(weekStart(today)).toBe('2025-11-10');
    expect(weekStart('2025-11-16')).toBe('2025-11-10');
    expect(weekStart('2025-11-17')).toBe('2025-11-17');
  });
});

describe('pocket money', () => {
  it('pays $1 per 30 stars, capped at the weekly amount, then applies deductions', () => {
    const completions = [];
    for (let i = 0; i < 3; i++) {
      const d = addDays('2025-11-10', i);
      completions.push(done('bed', d, `${addDays(d, -1)}T22:00:00Z`), done('teeth', d, `${addDays(d, -1)}T22:00:00Z`));
    }
    // 60 stars from jobs + 3 speed bonuses (finished 9:00am? no — 22:00Z = 9:00am local, too late) = 60
    const s = summarizeKid(kid, data({ completions }), wedMorning);
    expect(s.weekStars).toBe(60);
    expect(s.earnedDollars).toBe(2);
    expect(s.starsToNextDollar).toBe(30);

    const withLoss = summarizeKid(
      kid,
      data({ completions, adjustments: [{ id: 'a', kid_id: 'k1', kind: 'money', amount: -0.5, reason: 'rude', day: today, created_at: '' }] }),
      wedMorning,
    );
    expect(withLoss.money).toBe(1.5);
    expect(withLoss.toGo).toBe(6.5);
    expect(withLoss.coinsFilled).toBe(1);
    expect(withLoss.moneyTaken).toHaveLength(1);
  });

  it('never goes over the weekly amount from stars alone', () => {
    const s = summarizeKid(
      kid,
      data({ adjustments: [{ id: 'a', kid_id: 'k1', kind: 'stars', amount: 1000, reason: '', day: today, created_at: '' }] }),
      wedMorning,
    );
    expect(s.earnedDollars).toBe(8);
    expect(s.toGo).toBe(0);
    expect(s.starsToNextDollar).toBe(0);
  });

  it('counts only approved bonus jobs; pending ones show separately', () => {
    const bonusLogs = [
      { id: 'b1', job_id: 'dish', kid_id: 'k1', day: today, stars: 15, tech_minutes: 10, status: 'approved' as const, created_at: '2025-11-11T20:00:00Z' },
      { id: 'b2', job_id: 'dish', kid_id: 'k1', day: today, stars: 15, tech_minutes: 10, status: 'pending' as const, created_at: '2025-11-11T20:10:00Z' },
    ];
    const s = summarizeKid(kid, data({ bonusLogs }), wedMorning);
    expect(s.weekStars).toBe(15);
    expect(s.pendingStars).toBe(15);
    expect(s.bonusJobs[0].usedThisWeek).toBe(2);
    expect(s.bonusJobs[0].remaining).toBe(1);
    expect(s.bonusJobs[0].latestPendingId).toBe('b2');
    expect(s.tech.earned).toBe(10);
    expect(s.tech.total).toBe(40);
  });
});

describe('tech time', () => {
  it('adds bonus minutes and takes away parent deductions for today only', () => {
    const adjustments = [
      { id: 'a1', kid_id: 'k1', kind: 'tech' as const, amount: -10, reason: 'screens after bedtime', day: today, created_at: '' },
      { id: 'a2', kid_id: 'k1', kind: 'tech' as const, amount: -10, reason: 'yesterday', day: addDays(today, -1), created_at: '' },
      { id: 'a3', kid_id: 'k1', kind: 'tech' as const, amount: 5, reason: 'helpful', day: today, created_at: '' },
    ];
    const s = summarizeKid(kid, data({ adjustments }), wedMorning);
    expect(s.tech.taken).toBe(10);
    expect(s.tech.given).toBe(5);
    expect(s.tech.total).toBe(25);
  });
});

describe('speed bonus and streak', () => {
  it('awards the speed bonus when everything is done 15+ minutes before leaving', () => {
    // Done at 7:50am local (20:50Z previous day): leave 8:15, deadline 8:00 → yes
    const early = [done('bed', today, '2025-11-11T20:45:00Z'), done('teeth', today, '2025-11-11T20:50:00Z')];
    expect(earnedSpeedBonus('k1', today, jobs, early, settings)).toBe(true);
    // Teeth at 8:05am local → no
    const late = [done('bed', today, '2025-11-11T20:45:00Z'), done('teeth', today, '2025-11-11T21:05:00Z')];
    expect(earnedSpeedBonus('k1', today, jobs, late, settings)).toBe(false);
    // Saturday isn't a school day → no bonus
    const sat = '2025-11-15';
    const satDone = [done('bed', sat, '2025-11-14T20:00:00Z'), done('teeth', sat, '2025-11-14T20:00:00Z')];
    expect(earnedSpeedBonus('k1', sat, jobs, satDone, settings)).toBe(false);
  });

  it('counts days in a row, and today only once it is finished', () => {
    const completions = [] as ReturnType<typeof done>[];
    for (const d of [addDays(today, -1), addDays(today, -2)]) {
      completions.push(done('bed', d, `${d}T00:00:00Z`), done('teeth', d, `${d}T00:00:00Z`));
    }
    completions.push(done('bed', addDays(today, -4), 'x'), done('teeth', addDays(today, -4), 'x'));
    expect(streakFor('k1', today, jobs, completions)).toBe(2);
    completions.push(done('bed', today, 'x'), done('teeth', today, 'x'));
    expect(streakFor('k1', today, jobs, completions)).toBe(3);
  });
});

describe('school countdown', () => {
  it('moves through the zones as leave time gets closer', () => {
    expect(timerState(settings, new Date('2025-11-11T20:40:00Z')).phase).toBe('bonus'); // 7:40, 35 min left
    expect(timerState(settings, new Date('2025-11-11T21:05:00Z')).phase).toBe('move'); // 8:05
    expect(timerState(settings, new Date('2025-11-11T21:12:00Z')).phase).toBe('closing'); // 8:12
    expect(timerState(settings, new Date('2025-11-11T21:20:00Z')).phase).toBe('go'); // 8:20
    expect(timerState(settings, new Date('2025-11-11T23:00:00Z')).phase).toBe('none'); // 10:00
    expect(timerState(settings, new Date('2025-11-14T20:40:00Z')).schoolDay).toBe(false); // Saturday
  });
});
