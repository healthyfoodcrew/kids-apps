import { useState, type FormEvent, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { KidScreen } from './kid/KidScreen';
import { PinPad } from './kid/PinPad';
import { PlayerPick } from './kid/PlayerPick';
import { useAuth, useCanManage } from './lib/store';
import { supabase } from './lib/supabase';
import { Adjust } from './parent/Adjust';
import { ParentHome } from './parent/Home';
import { Jobs } from './parent/Jobs';
import { Payday } from './parent/Payday';
import { KidsSettings, PinSettings, RulesSettings, SetupMenu } from './parent/Settings';

function MessagePage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="message-page">
      <div className="message-card">
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    setError(err);
  }

  return (
    <main className="p-login">
      <form onSubmit={submit}>
        <h1>REWARDS CHART</h1>
        <p>Parents: sign in with your own login. On the kids' iPad, use the iPad login — you only do this once.</p>
        <label className="p-field">
          <span>Email</span>
          <input className="p-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="p-field">
          <span>Password</span>
          <input className="p-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="p-msg err" role="alert">{error}</div>}
        <button className="p-btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function ParentRoutes() {
  return (
    <Routes>
      <Route index element={<ParentHome />} />
      <Route path="adjust" element={<Adjust />} />
      <Route path="payday" element={<Payday />} />
      <Route path="setup" element={<SetupMenu />} />
      <Route path="setup/jobs" element={<Jobs />} />
      <Route path="setup/kids" element={<KidsSettings />} />
      <Route path="setup/rules" element={<RulesSettings />} />
      <Route path="setup/pin" element={<PinSettings />} />
      <Route path="*" element={<Navigate to="/parent" replace />} />
    </Routes>
  );
}

/** Parent screens: open for parent logins; on the iPad only after the PIN. */
function ParentGate() {
  const canManage = useCanManage();
  return canManage ? <ParentRoutes /> : <PinPad />;
}

export function App() {
  const { ready, session, role, signOut } = useAuth();

  if (!supabase) {
    return (
      <MessagePage title="Almost there">
        <p>The app isn't connected to its database yet.</p>
        <p>
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your hosting settings (or
          <code>.env.local</code> on your computer), then rebuild. The README has the steps.
        </p>
      </MessagePage>
    );
  }
  if (!ready) return null;
  if (!session) return <Login />;
  if (!role) {
    return (
      <MessagePage title="Login not set up yet">
        <p>
          You're signed in as <b>{session.user.email}</b>, but this login hasn't been added to the family yet. Run{' '}
          <code>supabase/add-logins.sql</code> with this email (see the README), then reopen the app.
        </p>
        <button className="p-btn" onClick={() => signOut()}>Sign out</button>
      </MessagePage>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={role === 'parent' ? <Navigate to="/parent" replace /> : <PlayerPick />} />
        <Route path="/kids" element={<PlayerPick />} />
        <Route path="/kid/:kidId" element={<KidScreen />} />
        <Route path="/parent/*" element={<ParentGate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
