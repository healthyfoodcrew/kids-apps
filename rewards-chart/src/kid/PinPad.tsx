import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/store';

/** Shown on the kids' iPad before the parent screens open. */
export function PinPad() {
  const { unlock } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  function press(d: string) {
    if (checking) return;
    setPin((p) => (p + d).slice(0, 6));
    setMsg('');
  }

  async function submit() {
    if (checking || pin.length < 4) return;
    setChecking(true);
    const res = await unlock(pin);
    setChecking(false);
    if (res === 'ok') return; // the parent screens take over from here
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
    setPin('');
    setMsg(
      res === 'locked'
        ? 'Too many tries. Wait 5 minutes.'
        : res === 'error'
          ? 'Could not check the PIN. Try again.'
          : 'Wrong PIN',
    );
  }

  function back() {
    if (pin.length) {
      setPin('');
      setMsg('');
    } else {
      navigate('/');
    }
  }

  return (
    <main className="pin-screen">
      <h1>PARENTS ONLY</h1>
      <div className={`pin-dots${shake ? ' shake' : ''}`} aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pin-msg" role="alert">{msg}</div>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)}>{d}</button>
        ))}
        <button className="ghost" onClick={back}>{pin.length ? 'Clear' : 'Back'}</button>
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" onClick={submit} disabled={pin.length < 4 || checking}>
          {checking ? '…' : 'OK'}
        </button>
      </div>
    </main>
  );
}
