// Turns a photo of one of the kids into an original game-style character picture.
//
// Only a parent (or the iPad with the PIN entered) can call it. The photo goes to the
// AI image service and is never saved; only the finished character picture is stored,
// in the private "avatars" bucket.
//
// Needs the secret OPENAI_API_KEY (Supabase → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { decodeBase64 } from 'jsr:@std/encoding@1/base64';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STYLES: Record<string, string> = {
  hero: 'a bold action hero in a colourful adventure outfit with a cool jacket and gloves',
  armour: 'a sci-fi armoured hero in a sleek glowing suit, helmet visor pushed up so the face shows',
  explorer: 'a jungle explorer adventurer with a backpack, goggles on the forehead and a confident grin',
  space: 'a space ranger in a bright astronaut-style suit with a glowing badge, helmet off',
};

const BASE_PROMPT = (style: string) =>
  [
    'Turn the child in this photo into an original stylised 3D video-game character portrait,',
    'in a bright, playful battle-royale cartoon art style: smooth shading, bold colours, slightly exaggerated proportions.',
    `Dress them as ${style}.`,
    'Keep their face, hair, skin tone and expression recognisable so the family can tell who it is.',
    'Head-and-shoulders framing, friendly confident pose, age-appropriate and wholesome.',
    'Plain vibrant gradient-free background in a single bold colour.',
    'No text, no logos, no weapons, and not any existing or copyrighted game character.',
  ].join(' ');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const started = Date.now();

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.log('[make-avatar] OPENAI_API_KEY is missing');
    return json({ error: 'The AI key has not been added yet (OPENAI_API_KEY).' }, 500);
  }

  // Who is calling? Must be a parent, or the iPad with parent mode unlocked.
  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: allowed, error: roleError } = await asUser.rpc('can_manage');
  if (roleError || allowed !== true) return json({ error: 'Only a parent can make character pictures.' }, 403);

  let body: { kid_id?: string; image?: string; style?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const { kid_id, image, style = 'hero' } = body;
  if (!kid_id || !image || !image.startsWith('data:image/')) return json({ error: 'Missing photo or child' }, 400);
  if (image.length > 8_000_000) return json({ error: 'That photo is too big. Try a smaller one.' }, 413);

  const admin = createClient(url, service);
  const { data: kid } = await admin.from('kids').select('id').eq('id', kid_id).maybeSingle();
  if (!kid) return json({ error: 'Child not found' }, 404);

  // The server kills this function 150 seconds after it starts, so everything has to be
  // finished well before that. Faster picture models are tried first; a model or setting the
  // account can't use fails in a second and the next one is tried.
  const DEADLINE_MS = 115_000;
  const log = (...a: unknown[]) => console.log(`[make-avatar +${((Date.now() - started) / 1000).toFixed(1)}s]`, ...a);
  const ATTEMPTS: Record<string, unknown>[] = [
    { model: 'gpt-image-2.5-flare', quality: 'medium', size: '1024x1024' },
    { model: 'gpt-image-1-mini', quality: 'medium', size: '1024x1024' },
    { model: 'gpt-image-2', quality: 'low', complexity: 'low', size: '1024x1024' },
  ];

  const callAI = async (opts: Record<string, unknown>) => {
    const left = DEADLINE_MS - (Date.now() - started);
    if (left < 10_000) throw new Error('timeout');
    const ctrl = new AbortController();
    let timer: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new Error('timeout'));
      }, left);
    });
    const request = (async () => {
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [{ image_url: image }],
          prompt: BASE_PROMPT(STYLES[style] ?? STYLES.hero),
          output_format: 'jpeg',
          output_compression: 88,
          n: 1,
          ...opts,
        }),
      });
      return { res, body: await res.json().catch(() => null) };
    })();
    try {
      return await Promise.race([request, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  log('start', { style, photoKB: Math.round(image.length / 1024) });
  let ai: { res: Response; body: any } | null = null;
  try {
    for (const opts of ATTEMPTS) {
      log('trying', opts.model);
      ai = await callAI(opts);
      log('reply', opts.model, ai.res.status, ai.res.ok ? 'ok' : ai.body?.error?.message);
      if (ai.res.ok) break;
      const m: string = ai.body?.error?.message ?? '';
      // Only move on when the model or a setting isn't available; real errors stop here.
      const unsupported = ai.res.status === 404 || /model|parameter|unsupported|not supported|invalid value|unknown|does not exist|access/i.test(m);
      if (!unsupported || /safety|policy|moderation/i.test(m)) break;
    }
  } catch (e) {
    log('gave up', String(e));
    return json({ error: 'The AI took too long this time. Please try again in a minute.' }, 504);
  }
  if (!ai || !ai.res.ok) {
    const message: string = ai?.body?.error?.message ?? `AI service error (${ai?.res.status ?? '?'})`;
    const declined = /safety|policy|moderation|rejected/i.test(message);
    return json({ error: declined ? 'The AI service declined this photo. Try a different photo.' : message }, 502);
  }

  let bytes: Uint8Array | null = null;
  const item = ai.body?.data?.[0];
  if (item?.b64_json) {
    bytes = decodeBase64(item.b64_json);
  } else if (item?.url) {
    const img = await fetch(item.url);
    if (img.ok) bytes = new Uint8Array(await img.arrayBuffer());
  }
  if (!bytes) return json({ error: 'The AI service did not return a picture. Try again.' }, 502);

  const path = `${kid_id}/${Date.now()}.jpg`;
  const { error: upError } = await admin.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' });
  if (upError) return json({ error: upError.message }, 500);
  log('saved', path);

  const { data: signed } = await admin.storage.from('avatars').createSignedUrl(path, 60 * 60);
  return json({ path, url: signed?.signedUrl ?? null });
});
