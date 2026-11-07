import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { addDays, localParts } from './time';
import {
  DEFAULT_SETTINGS,
  type AdjustmentKind,
  type BonusStatus,
  type FamilyData,
  type Job,
  type Kid,
  type Role,
  type Settings,
} from './types';

// ─────────────────────────────── Auth ───────────────────────────────

export interface AuthState {
  ready: boolean;
  session: Session | null;
  role: Role | null; // null = signed in but not added to the family yet
  unlockedUntil: number; // tablet: parent mode open until (ms), 0 = locked
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  unlock(pin: string): Promise<'ok' | 'wrong' | 'locked' | 'error'>;
  lock(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [unlockedUntil, setUnlockedUntil] = useState(0);

  const loadAccess = useCallback(async (s: Session | null) => {
    if (!supabase || !s) {
      setRole(null);
      setUnlockedUntil(0);
      return;
    }
    const { data } = await supabase.rpc('my_access');
    const row = Array.isArray(data) ? data[0] : null;
    setRole((row?.role as Role) ?? null);
    const until = row?.parent_unlocked_until ? Date.parse(row.parent_unlocked_until) : 0;
    setUnlockedUntil(until > Date.now() ? until : 0);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadAccess(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void loadAccess(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAccess]);

  // Parent mode on the iPad closes itself when its time runs out.
  useEffect(() => {
    if (!unlockedUntil) return;
    const t = window.setTimeout(() => setUnlockedUntil(0), Math.max(0, unlockedUntil - Date.now()));
    return () => window.clearTimeout(t);
  }, [unlockedUntil]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      role,
      unlockedUntil,
      async signIn(email, password) {
        if (!supabase) return 'The app is not connected to Supabase yet.';
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? error.message : null;
      },
      async signOut() {
        await supabase?.auth.signOut();
      },
      async unlock(pin) {
        if (!supabase) return 'error';
        const { data, error } = await supabase.rpc('unlock_parent_mode', { pin });
        if (error) return 'error';
        if (data === 'ok') {
          await loadAccess(session);
          return 'ok';
        }
        return data === 'locked' ? 'locked' : 'wrong';
      },
      async lock() {
        await supabase?.rpc('lock_parent_mode');
        setUnlockedUntil(0);
      },
    }),
    [ready, session, role, unlockedUntil, loadAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}

/** True for a parent login, or the iPad while the PIN has parent mode open. */
export function useCanManage(): boolean {
  const { role, unlockedUntil } = useAuth();
  return role === 'parent' || (role === 'tablet' && unlockedUntil > Date.now());
}

// ─────────────────────────────── Family data ───────────────────────────────

const EMPTY: FamilyData = {
  settings: DEFAULT_SETTINGS,
  kids: [],
  jobs: [],
  completions: [],
  bonusLogs: [],
  adjustments: [],
  payouts: [],
};

export interface JobInput {
  id?: string;
  kid_id: string;
  title: string;
  icon: string;
  kind: 'daily' | 'bonus';
  stars: number;
  max_per_week: number;
  days: number[];
  active: boolean;
}

export interface FamilyState {
  data: FamilyData;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  today(): string;
  toggleJob(job: Job, completionId?: string): Promise<string | null>;
  logBonus(job: Job): Promise<string | null>;
  undoBonus(logId: string): Promise<string | null>;
  reviewBonus(logId: string, status: BonusStatus): Promise<string | null>;
  addAdjustment(kidId: string, kind: AdjustmentKind, amount: number, reason: string): Promise<string | null>;
  removeAdjustment(id: string): Promise<string | null>;
  saveJob(job: JobInput): Promise<string | null>;
  deleteJob(id: string): Promise<string | null>;
  moveJob(job: Job, dir: -1 | 1): Promise<string | null>;
  saveKid(kid: Partial<Kid> & { id?: string }): Promise<string | null>;
  saveSettings(patch: Partial<Settings>): Promise<string | null>;
  setPin(pin: string): Promise<string | null>;
  recordPayout(kidId: string, weekStart: string, amount: number): Promise<string | null>;
  undoPayout(id: string): Promise<string | null>;
  makeAvatar(kidId: string, photo: string, style: string): Promise<{ path?: string; url?: string | null; error?: string }>;
}

export const FamilyContext = createContext<FamilyState | null>(null);

function friendly(message: string): string {
  if (message.includes('Weekly limit')) return 'That job is all done for this week!';
  if (message.includes('row-level security')) return 'Only a parent can do that.';
  if (message.includes('duplicate key')) return 'Already done!';
  return message;
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { session, role } = useAuth();
  const [data, setData] = useState<FamilyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tzRef = useRef(DEFAULT_SETTINGS.timezone);

  const today = useCallback(() => localParts(new Date(), tzRef.current).day, []);

  const refresh = useCallback(async () => {
    if (!supabase || !session || !role) return;
    const since = addDays(today(), -120);
    const [settings, kids, jobs, completions, bonusLogs, adjustments, payouts] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('kids').select('*').order('sort'),
      supabase.from('jobs').select('*').order('sort'),
      supabase.from('completions').select('*').gte('day', since),
      supabase.from('bonus_logs').select('*').gte('day', since),
      supabase.from('adjustments').select('*').gte('day', since).order('created_at', { ascending: false }),
      supabase.from('payouts').select('*').gte('week_start', since),
    ]);
    const firstError = [settings, kids, jobs, completions, bonusLogs, adjustments, payouts].find((r) => r.error)?.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }
    const s = (settings.data as Settings | null) ?? DEFAULT_SETTINGS;
    tzRef.current = s.timezone;
    setData({
      settings: s,
      kids: (kids.data ?? []) as Kid[],
      jobs: (jobs.data ?? []) as Job[],
      completions: completions.data ?? [],
      bonusLogs: bonusLogs.data ?? [],
      adjustments: (adjustments.data ?? []).map((a) => ({ ...a, amount: Number(a.amount) })),
      payouts: (payouts.data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })),
    } as FamilyData);
    setError(null);
    setLoading(false);
  }, [session, role, today]);

  // Load, then stay in sync: any change on any device triggers a quick reload.
  useEffect(() => {
    if (!supabase || !session || !role) return;
    void refresh();
    let pending: number | undefined;
    const soon = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => void refresh(), 250);
    };
    const channel = supabase.channel('family');
    for (const table of ['settings', 'kids', 'jobs', 'completions', 'bonus_logs', 'adjustments', 'payouts']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
    }
    channel.subscribe();
    // Catch up when the iPad wakes up or the app comes back to the front, and at midnight.
    const onVisible = () => document.visibilityState === 'visible' && soon();
    document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(soon, 60_000);
    return () => {
      window.clearTimeout(pending);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase?.removeChannel(channel);
    };
  }, [session, role, refresh]);

  const run = useCallback(
    async (op: () => PromiseLike<{ error: { message: string } | null }>): Promise<string | null> => {
      if (!supabase) return 'Not connected';
      const { error: e } = await op();
      await refresh();
      return e ? friendly(e.message) : null;
    },
    [refresh],
  );

  const value = useMemo<FamilyState>(() => {
    const db = supabase!;
    return {
      data,
      loading,
      error,
      refresh,
      today,
      toggleJob: (job, completionId) =>
        run(() =>
          completionId
            ? db.from('completions').delete().eq('id', completionId)
            : db.from('completions').insert({ job_id: job.id, kid_id: job.kid_id, day: today() }),
        ),
      logBonus: (job) => run(() => db.from('bonus_logs').insert({ job_id: job.id, kid_id: job.kid_id, day: today() })),
      undoBonus: (id) => run(() => db.from('bonus_logs').delete().eq('id', id)),
      reviewBonus: (id, status) =>
        run(() => db.from('bonus_logs').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)),
      addAdjustment: (kidId, kind, amount, reason) =>
        run(() => db.from('adjustments').insert({ kid_id: kidId, kind, amount, reason, day: today() })),
      removeAdjustment: (id) => run(() => db.from('adjustments').delete().eq('id', id)),
      saveJob: (job) =>
        run(() => {
          const { id, ...rest } = job;
          if (id) return db.from('jobs').update(rest).eq('id', id);
          const siblings = data.jobs.filter((j) => j.kid_id === job.kid_id && j.kind === job.kind);
          const sort = siblings.reduce((m, j) => Math.max(m, j.sort), 0) + 1;
          return db.from('jobs').insert({ ...rest, sort });
        }),
      deleteJob: (id) => run(() => db.from('jobs').delete().eq('id', id)),
      moveJob: async (job, dir) => {
        const list = data.jobs
          .filter((j) => j.kid_id === job.kid_id && j.kind === job.kind)
          .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
        const i = list.findIndex((j) => j.id === job.id);
        const other = list[i + dir];
        if (!other) return null;
        // Re-number the whole list so equal sort values can't get stuck.
        const order = [...list];
        [order[i], order[i + dir]] = [order[i + dir], order[i]];
        return run(async () => {
          for (let n = 0; n < order.length; n++) {
            const res = await db.from('jobs').update({ sort: n + 1 }).eq('id', order[n].id);
            if (res.error) return res;
          }
          return { error: null };
        });
      },
      saveKid: (kid) =>
        run(() => {
          const { id, ...rest } = kid;
          return id ? db.from('kids').update(rest).eq('id', id) : db.from('kids').insert(rest);
        }),
      saveSettings: (patch) => run(() => db.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)),
      setPin: (pin) => run(() => db.rpc('set_parent_pin', { new_pin: pin })),
      recordPayout: (kidId, weekStart, amount) =>
        run(() => db.from('payouts').upsert({ kid_id: kidId, week_start: weekStart, amount }, { onConflict: 'kid_id,week_start' })),
      undoPayout: (id) => run(() => db.from('payouts').delete().eq('id', id)),
      makeAvatar: async (kidId, photo, style) => {
        const { data: res, error: e } = await db.functions.invoke('make-avatar', { body: { kid_id: kidId, image: photo, style } });
        if (e) {
          // The function's own message is in the response body.
          let message = e.message;
          try {
            const body = await (e as { context?: Response }).context?.json();
            if (body?.error) message = body.error;
          } catch {
            /* keep the generic message */
          }
          return { error: message };
        }
        return res as { path: string; url: string | null };
      },
    };
  }, [data, loading, error, refresh, today, run]);

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily(): FamilyState {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily outside FamilyProvider');
  return ctx;
}

/** Re-renders every `ms` so clocks and countdowns stay live. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
