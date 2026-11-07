export type Role = 'parent' | 'tablet';

export interface Settings {
  id: number;
  timezone: string;
  leave_time: string; // 'HH:MM:SS'
  school_days: number[]; // 1 = Monday … 7 = Sunday
  countdown_minutes: number;
  speed_bonus_minutes: number;
  speed_bonus_stars: number;
  stars_per_dollar: number;
  bonus_tech_minutes: number;
}

export interface Kid {
  id: string;
  name: string;
  age: number | null;
  color: string;
  weekly_pocket_money: number;
  daily_tech_minutes: number;
  avatar_path?: string | null; // game-character picture in the private 'avatars' store
  sort: number;
}

export type JobKind = 'daily' | 'bonus';

export interface Job {
  id: string;
  kid_id: string;
  title: string;
  icon: string;
  kind: JobKind;
  stars: number;
  max_per_week: number;
  days: number[];
  active: boolean;
  sort: number;
}

export interface Completion {
  id: string;
  job_id: string;
  kid_id: string;
  day: string; // 'YYYY-MM-DD'
  stars: number;
  created_at: string;
}

export type BonusStatus = 'pending' | 'approved' | 'rejected';

export interface BonusLog {
  id: string;
  job_id: string;
  kid_id: string;
  day: string;
  stars: number;
  tech_minutes: number;
  status: BonusStatus;
  created_at: string;
}

export type AdjustmentKind = 'money' | 'tech' | 'stars';

export interface Adjustment {
  id: string;
  kid_id: string;
  kind: AdjustmentKind;
  amount: number; // positive = given, negative = taken away
  reason: string;
  day: string;
  created_at: string;
}

export interface Payout {
  id: string;
  kid_id: string;
  week_start: string;
  amount: number;
  paid_at: string;
}

export interface FamilyData {
  settings: Settings;
  kids: Kid[];
  jobs: Job[];
  completions: Completion[];
  bonusLogs: BonusLog[];
  adjustments: Adjustment[];
  payouts: Payout[];
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  timezone: 'Australia/Melbourne',
  leave_time: '08:15:00',
  school_days: [1, 2, 3, 4, 5],
  countdown_minutes: 45,
  speed_bonus_minutes: 15,
  speed_bonus_stars: 20,
  stars_per_dollar: 30,
  bonus_tech_minutes: 10,
};
