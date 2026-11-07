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

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return json({ error: 'The AI key has not been added yet (OPENAI_API_KEY).' }, 500);

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

  // The server function may only run for 150 seconds, so give the AI 130 and fail politely after that.
  const callAI = async (extra: Record<string, unknown>) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 130_000);
    try {
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-image-2',
          images: [{ image_url: image }],
          prompt: BASE_PROMPT(STYLES[style] ?? STYLES.hero),
          output_format: 'jpeg',
          output_compression: 88,
          n: 1,
          ...extra,
        }),
      });
      return { res, body: await res.json().catch(() => null) };
    } finally {
      clearTimeout(timer);
    }
  };

  let ai: { res: Response; body: any };
  try {
    // Low complexity is much faster and keeps the face closer to the photo.
    ai = await callAI({ complexity: 'low', size: '1024x1024' });
    if (!ai.res.ok && /complexity|size/i.test(ai.body?.error?.message ?? '')) ai = await callAI({});
  } catch {
    return json({ error: 'The AI took too long this time. Please try again in a minute.' }, 504);
  }
  if (!ai.res.ok) {
    const message: string = ai.body?.error?.message ?? `AI service error (${ai.res.status})`;
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

  const { data: signed } = await admin.storage.from('avatars').createSignedUrl(path, 60 * 60);
  return json({ path, url: signed?.signedUrl ?? null });
});
