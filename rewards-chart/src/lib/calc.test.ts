import { describe, expect, it } from 'vitest';
import { dailyJobsFor, earnedSpeedBonus, kidsOnDuty, payHistory, streakFor, summarizeKid, timerState } from './calc';
import { addDays, localParts, weekStart } from './time';
import { DEFAULT_SETTINGS, type FamilyData, type Job, type Kid } from './types';

const settings = { ...DEFAULT_SETTINGS };
const kid: Kid = { id: 'k1', name: 'Louie', age: 7, color: '#2EE6D6', weekly_pocket_money: 8, weekly_tech_minutes: 210, sort: 1 };

function job(id: string, kind: 'daily' | 'bonus', stars = 10, days = [1, 2, 3, 4, 5, 6, 7], extra: Partial<Job> = {}): Job {
  return { id, kid_ids: ['k1'], title: id, icon: 'star', kind, period: 'morning', assign_mode: 'each', rotation_offset: 0, stars, max_per_week: 3, days, active: true, sort: 0, ...extra };
}

const jobs = [job('bed', 'daily'), job('teeth', 'daily'), job('dish', 'bonus', 15)];

// Wednesday 12 Nov 2025 07:40 in Melbourne (UTC+11) = Tuesday 20:40 UTC.
const wedMorning = new Date('2025-11-11T20:40:00Z');
const today = '2025-11-12';

function data(partial: Partial<FamilyData>): FamilyData {
  return { settings, kids: [kid], jobs, completions: [], bonusLogs: [], adjustments: [], payouts: [], techSessions: [], ...partial };
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
    expect(s.tech.total).toBe(220);
  });
});

describe('tech time', () => {
  it('is a weekly allowance: bonus minutes and parent changes count all week, then it starts again on Monday', () => {
    const adjustments = [
      { id: 'a1', kid_id: 'k1', kind: 'tech' as const, amount: -10, reason: 'screens after bedtime', day: today, created_at: '' },
      { id: 'a2', kid_id: 'k1', kind: 'tech' as const, amount: -15, reason: 'Monday', day: '2025-11-10', created_at: '' },
      { id: 'a3', kid_id: 'k1', kind: 'tech' as const, amount: 5, reason: 'helpful', day: today, created_at: '' },
      { id: 'a4', kid_id: 'k1', kind: 'tech' as const, amount: -60, reason: 'last week', day: '2025-11-09', created_at: '' },
    ];
    const bonusLogs = [
      { id: 'b1', job_id: 'dish', kid_id: 'k1', day: '2025-11-10', stars: 15, tech_minutes: 10, status: 'approved' as const, created_at: '' },
      { id: 'b2', job_id: 'dish', kid_id: 'k1', day: '2025-11-08', stars: 15, tech_minutes: 10, status: 'approved' as const, created_at: '' },
    ];
    const s = summarizeKid(kid, data({ adjustments, bonusLogs }), wedMorning);
    expect(s.tech.earned).toBe(10);
    expect(s.tech.taken).toBe(25);
    expect(s.tech.given).toBe(5);
    expect(s.tech.total).toBe(210 + 10 + 5 - 25);
  });
});

describe('pay day', () => {
  const sundayEvening = new Date('2025-11-16T08:00:00Z'); // Sun 16 Nov, 7pm Melbourne
  const kidSince = { ...kid, created_at: '2025-10-27T00:00:00Z' }; // joined the week of Mon 27 Oct
  it('lists each week, newest first, as due on Sunday and missed after that', () => {
    const payouts = [{ id: 'p1', kid_id: 'k1', week_start: '2025-10-27', amount: 3, paid_at: '' }];
    // $2 earned in the week of 3 Nov (never paid), $1 in the week of 10 Nov (pay day today).
    const adjustments = [
      { id: 'a1', kid_id: 'k1', kind: 'stars' as const, amount: 60, reason: '', day: '2025-11-05', created_at: '' },
      { id: 'a2', kid_id: 'k1', kind: 'stars' as const, amount: 30, reason: '', day: '2025-11-12', created_at: '' },
    ];
    const hist = payHistory(kidSince, data({ kids: [kidSince], payouts, adjustments }), sundayEvening);
    expect(hist.map((w) => [w.weekStart, w.payday, w.status, w.amount])).toEqual([
      ['2025-11-10', '2025-11-16', 'due', 1],
      ['2025-11-03', '2025-11-09', 'missed', 2],
      ['2025-10-27', '2025-11-02', 'paid', 0],
    ]);
  });
  it('does not count a week with nothing earned as missed', () => {
    const hist = payHistory(kidSince, data({ kids: [kidSince] }), sundayEvening);
    expect(hist[1].status).toBe('none');
  });
  it('shows the current week as in progress before Sunday', () => {
    const hist = payHistory(kidSince, data({ kids: [kidSince] }), wedMorning);
    expect(hist[0].status).toBe('in-progress');
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

describe('shared jobs, turns and evening jobs', () => {
  it('gives an "everyone" job to every assigned kid', () => {
    const j = job('teeth', 'daily', 10, [1, 2, 3, 4, 5, 6, 7], { kid_ids: ['k1', 'k2'] });
    expect(kidsOnDuty(j, today)).toEqual(['k1', 'k2']);
  });

  it('takes turns each time the job comes round, skipping days it is off', () => {
    const j = job('bins', 'daily', 10, [1, 2, 3, 4, 5], { kid_ids: ['k1', 'k2'], assign_mode: 'rotate_daily' });
    // Mon 10 Nov 2025 → Fri 14 Nov, then Mon 17 Nov carries on alternating.
    const seq = ['2025-11-10', '2025-11-11', '2025-11-12', '2025-11-13', '2025-11-14', '2025-11-17'].map((d) => kidsOnDuty(j, d)[0]);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });

  it('takes turns weekly, and the offset changes whose turn it is', () => {
    const j = job('bath', 'daily', 10, [1, 2, 3, 4, 5, 6, 7], { kid_ids: ['k1', 'k2'], assign_mode: 'rotate_weekly' });
    const a = kidsOnDuty(j, '2025-11-10')[0];
    expect(kidsOnDuty(j, '2025-11-16')[0]).toBe(a); // same week
    expect(kidsOnDuty(j, '2025-11-17')[0]).not.toBe(a); // next week
    expect(kidsOnDuty({ ...j, rotation_offset: 1 }, '2025-11-10')[0]).not.toBe(a);
  });

  it('keeps evening jobs separate from morning quests (which unlock tech time)', () => {
    const jobs2 = [job('bed', 'daily'), job('dishes', 'daily', 10, [1, 2, 3, 4, 5, 6, 7], { period: 'evening' })];
    expect(dailyJobsFor('k1', jobs2, today, 'morning').map((x) => x.id)).toEqual(['bed']);
    expect(dailyJobsFor('k1', jobs2, today, 'evening').map((x) => x.id)).toEqual(['dishes']);
    const s = summarizeKid(kid, data({ jobs: jobs2, completions: [done('bed', today, '2025-11-11T20:00:00Z')] }), wedMorning);
    expect(s.allDone).toBe(true);
    expect(s.eveningJobs).toHaveLength(1);
    expect(s.eveningDone).toBe(0);
  });
});

describe('tech time dead', () => {
  it('zeroes tech time while banned and ends by itself when the time is up', () => {
    const banned = { ...kid, tech_banned: true, tech_ban_until: '2025-11-14T00:00:00Z', tech_ban_reason: 'Lied about homework' };
    const s = summarizeKid(banned, data({ kids: [banned] }), wedMorning);
    expect(s.tech.ban?.reason).toBe('Lied about homework');
    expect(s.tech.total).toBe(0);
    const later = summarizeKid(banned, data({ kids: [banned] }), new Date('2025-11-15T00:00:00Z'));
    expect(later.tech.ban).toBeNull();
    expect(later.tech.total).toBe(210);
  });
  it('stays banned until lifted when there is no end time', () => {
    const banned = { ...kid, tech_banned: true, tech_ban_until: null };
    expect(summarizeKid(banned, data({ kids: [banned] }), new Date('2030-01-01T00:00:00Z')).tech.ban).not.toBeNull();
  });
});

describe("Bruno's tasks", () => {
  it('gives the two boys different dog jobs each day, swapping the next day', () => {
    const feed = job('feed', 'daily', 10, [1, 2, 3, 4, 5, 6, 7], { kid_ids: ['k1', 'k2'], assign_mode: 'rotate_daily', rotation_offset: 0, category: 'pet' });
    const water = job('water', 'daily', 10, [1, 2, 3, 4, 5, 6, 7], { kid_ids: ['k1', 'k2'], assign_mode: 'rotate_daily', rotation_offset: 1, category: 'pet' });
    for (const d of ['2025-11-10', '2025-11-11', '2025-11-12', '2025-11-16', '2025-11-17']) {
      expect(kidsOnDuty(feed, d)[0]).not.toBe(kidsOnDuty(water, d)[0]);
      expect(kidsOnDuty(feed, d)[0]).not.toBe(kidsOnDuty(feed, addDays(d, 1))[0]);
    }
  });
});

describe('weekend tech timer', () => {
  const sat = new Date('2025-11-14T23:00:00Z'); // Sat 15 Nov 2025, 10am Melbourne
  it('counts down from the weekly allowance and never overruns a session', () => {
    const techSessions = [
      { id: 's1', kid_id: 'k1', started_at: '2025-11-14T22:00:00Z', allowed_seconds: 30 * 60, ended_at: null }, // ran 60 min but only 30 allowed
      { id: 's2', kid_id: 'k1', started_at: '2025-11-07T22:00:00Z', allowed_seconds: 3600, ended_at: '2025-11-07T23:00:00Z' }, // last week
    ];
    const s = summarizeKid(kid, data({ techSessions }), sat);
    expect(s.tech.weekend).toBe(true);
    expect(s.tech.usedSeconds).toBe(30 * 60);
    expect(s.tech.remainingSeconds).toBe(210 * 60 - 30 * 60);
    expect(s.tech.running).toBeNull(); // its allowed time is used up
  });
  it('shows a running timer and is not the weekend on school days', () => {
    const techSessions = [{ id: 's1', kid_id: 'k1', started_at: '2025-11-14T22:50:00Z', allowed_seconds: 3600, ended_at: null }];
    const s = summarizeKid(kid, data({ techSessions }), sat);
    expect(s.tech.running?.id).toBe('s1');
    expect(s.tech.remainingSeconds).toBe(210 * 60 - 600);
    expect(summarizeKid(kid, data({}), wedMorning).tech.weekend).toBe(false);
  });
  it('counts down the time they chose, and the rest carries over', () => {
    // Picked 30 min at 9:50am; it's 10am, so 20 min left of this go.
    const techSessions = [{ id: 's1', kid_id: 'k1', started_at: '2025-11-14T22:50:00Z', allowed_seconds: 30 * 60, ended_at: null }];
    const s = summarizeKid(kid, data({ techSessions }), sat);
    expect(s.tech.sessionLeft).toBe(20 * 60);
    expect(s.tech.remainingSeconds).toBe(200 * 60);
    // Next day (Sunday) the session is over and what's left of the week is still there.
    const sun = summarizeKid(kid, data({ techSessions }), new Date('2025-11-15T23:00:00Z'));
    expect(sun.tech.running).toBeNull();
    expect(sun.tech.sessionLeft).toBe(0);
    expect(sun.tech.remainingSeconds).toBe(180 * 60);
    // Monday: a fresh week, back to the full allowance.
    const mon = summarizeKid(kid, data({ techSessions }), new Date('2025-11-16T23:00:00Z'));
    expect(mon.tech.remainingSeconds).toBe(210 * 60);
  });
});
