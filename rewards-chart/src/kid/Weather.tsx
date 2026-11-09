import { useEffect, useState } from 'react';

// St Helena, VIC 3088.
const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-37.693&longitude=145.13' +
  '&current=temperature_2m,weather_code,is_day' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&timezone=Australia%2FMelbourne&forecast_days=1';

type Wx = { temp: number; code: number; day: boolean; max: number; min: number; rain: number };

/** WMO weather codes → a kid-friendly word and a picture. */
function describe(code: number, day: boolean): { label: string; kind: 'sun' | 'moon' | 'part' | 'cloud' | 'fog' | 'rain' | 'storm' | 'snow' } {
  if (code === 0) return { label: day ? 'Sunny' : 'Clear', kind: day ? 'sun' : 'moon' };
  if (code <= 2) return { label: 'Some clouds', kind: 'part' };
  if (code === 3) return { label: 'Cloudy', kind: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Foggy', kind: 'fog' };
  if (code >= 95) return { label: 'Stormy', kind: 'storm' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow!', kind: 'snow' };
  if (code >= 51) return { label: code >= 80 ? 'Showers' : 'Rainy', kind: 'rain' };
  return { label: 'Cloudy', kind: 'cloud' };
}

function Pic({ kind }: { kind: ReturnType<typeof describe>['kind'] }) {
  const sun = <circle cx="22" cy="20" r="9" fill="#FFC94A" />;
  const rays = (
    <g stroke="#FFC94A" strokeWidth="3" strokeLinecap="round">
      <path d="M22 4v4M22 32v4M6 20h4M34 20h4M10.7 8.7l2.8 2.8M30.5 28.5l2.8 2.8M10.7 31.3l2.8-2.8M30.5 11.5l2.8-2.8" />
    </g>
  );
  const cloud = (x = 0, y = 0, c = '#E8ECFF') => (
    <path transform={`translate(${x} ${y})`} d="M14 38h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 9 9 0 0 0-1 18z" fill={c} />
  );
  return (
    <svg width="64" height="56" viewBox="0 0 52 48" aria-hidden="true">
      {kind === 'sun' && (<>{rays}{sun}</>)}
      {kind === 'moon' && <path d="M30 6a14 14 0 1 0 12 20A12 12 0 0 1 30 6z" fill="#FFE59A" />}
      {kind === 'part' && (<>{rays}{sun}{cloud(4, 6)}</>)}
      {kind === 'cloud' && (<>{cloud(-4, -4, '#B9C1E8')}{cloud(4, 4)}</>)}
      {kind === 'fog' && (<>{cloud(0, -6, '#B9C1E8')}<path d="M8 38h36M12 44h28" stroke="#B9C1E8" strokeWidth="3" strokeLinecap="round" /></>)}
      {kind === 'rain' && (<>{cloud(0, -8)}<path d="M16 36l-3 7M26 36l-3 7M36 36l-3 7" stroke="#4FB8FF" strokeWidth="3" strokeLinecap="round" /></>)}
      {kind === 'storm' && (<>{cloud(0, -8, '#8E97C8')}<path d="M27 32l-6 9h6l-4 7" stroke="#FFC94A" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>)}
      {kind === 'snow' && (<>{cloud(0, -8)}<path d="M16 38v6M13 41h6M30 38v6M27 41h6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></>)}
    </svg>
  );
}

/** Little weather box for the home screen. Quietly hides itself if the weather can't be loaded. */
export function Weather() {
  const [wx, setWx] = useState<Wx | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(URL)
        .then((r) => r.json())
        .then((j) => {
          if (!alive || !j?.current) return;
          setWx({
            temp: Math.round(j.current.temperature_2m),
            code: j.current.weather_code,
            day: j.current.is_day === 1,
            max: Math.round(j.daily.temperature_2m_max[0]),
            min: Math.round(j.daily.temperature_2m_min[0]),
            rain: j.daily.precipitation_probability_max?.[0] ?? 0,
          });
        })
        .catch(() => {});
    load();
    const t = window.setInterval(load, 30 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  if (!wx) return null;
  const d = describe(wx.code, wx.day);
  const tip = wx.rain >= 50 ? 'Pack a raincoat!' : wx.max >= 28 ? 'Hat & sunscreen!' : wx.max <= 14 ? 'Grab a jumper!' : '';
  return (
    <section className="weather" aria-label={`Weather in St Helena: ${d.label}, ${wx.temp} degrees`}>
      <Pic kind={d.kind} />
      <div className="wx-text">
        <span className="wx-temp">{wx.temp}°</span>
        <span className="wx-label">{d.label}</span>
        <span className="wx-range">
          H {wx.max}° · L {wx.min}°{wx.rain >= 20 ? ` · ${wx.rain}% rain` : ''}
        </span>
        {tip && <span className="wx-tip">{tip}</span>}
      </div>
    </section>
  );
}
