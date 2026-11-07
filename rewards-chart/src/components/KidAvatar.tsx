import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import type { Kid } from '../lib/types';

// Pictures live in a private store, so each device asks for a short-lived link and keeps it for a while.
const cache = new Map<string, { url: string; expires: number }>();

export function useAvatarUrl(path?: string | null): string | null {
  const cached = path ? cache.get(path) : undefined;
  const [url, setUrl] = useState<string | null>(cached && cached.expires > Date.now() ? cached.url : null);

  useEffect(() => {
    if (!path || !supabase) {
      setUrl(null);
      return;
    }
    const hit = cache.get(path);
    if (hit && hit.expires > Date.now()) {
      setUrl(hit.url);
      return;
    }
    let live = true;
    supabase.storage
      .from('avatars')
      .createSignedUrl(path, 60 * 60 * 12)
      .then(({ data }) => {
        if (!data?.signedUrl) return;
        cache.set(path, { url: data.signedUrl, expires: Date.now() + 60 * 60 * 11 * 1000 });
        if (live) setUrl(data.signedUrl);
      });
    return () => {
      live = false;
    };
  }, [path]);

  return url;
}

/** The kid's game character if they have one, otherwise their initial on their colour. */
export function KidAvatar({ kid, className, style }: { kid: Kid; className?: string; style?: CSSProperties }) {
  const url = useAvatarUrl(kid.avatar_path);
  return (
    <div className={className} style={{ background: kid.color, overflow: 'hidden', ...style }}>
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        kid.name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
