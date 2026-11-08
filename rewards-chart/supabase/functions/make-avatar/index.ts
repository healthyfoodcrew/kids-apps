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

// Each style has its own costume, art style, pose and backdrop, so they look properly different.
type Style = { outfit: string; art: string; scene: string };
const STYLES: Record<string, Style> = {
  hero: {
    outfit: 'a bold action hero in a colourful adventure jacket, fingerless gloves and a utility belt',
    art: 'stylised 3D battle-royale cartoon game art, smooth shading, bold saturated colours',
    scene: 'a sunny floating island with palm trees and a supply drop balloon in the sky',
  },
  armour: {
    outfit: 'a sleek sci-fi armoured hero with glowing panel lines, helmet visor flipped up so the face shows',
    art: 'glossy 3D game render with neon rim lighting',
    scene: 'a futuristic hangar with blue holograms and light beams',
  },
  explorer: {
    outfit: 'a jungle explorer with a backpack, rope, goggles on the forehead and rolled-up sleeves',
    art: 'warm painterly 3D adventure game art',
    scene: 'a misty jungle with ancient temple ruins and vines',
  },
  space: {
    outfit: 'a space ranger in a bright astronaut suit with a glowing badge, helmet tucked under one arm',
    art: 'clean 3D animated film style with soft lighting',
    scene: 'outer space with a ringed planet, stars and a small rocket',
  },
  ninja: {
    outfit: 'a cool ninja in a coloured hooded outfit and headband, mask pulled down so the face shows, no weapons',
    art: 'dynamic 3D anime-inspired cartoon art with speed lines',
    scene: 'rooftops at sunset with paper lanterns and cherry blossom petals',
  },
  knight: {
    outfit: 'a brave young knight in shiny armour with a cape and a crest shield on the back, no sword',
    art: 'storybook 3D fantasy game art',
    scene: 'a castle courtyard with flags flying and a friendly dragon peeking in the distance',
  },
  wizard: {
    outfit: 'a young wizard in a starry robe and a pointy hat, holding a glowing staff with magic sparkles',
    art: 'magical 3D animated film style with glowing particles',
    scene: 'a cosy magic library with floating books and candles',
  },
  racer: {
    outfit: 'a racing driver in a sponsor-free racing suit with a helmet held at the hip',
    art: 'shiny 3D racing game art with motion blur',
    scene: 'a racetrack pit lane with a colourful race car and chequered flags',
  },
  pirate: {
    outfit: 'a friendly pirate captain with a tricorn hat, long coat and a parrot on the shoulder, no weapons',
    art: 'bright 3D cartoon adventure art',
    scene: 'the deck of a pirate ship on a sparkling sea with a treasure map',
  },
  sports: {
    outfit: 'a sports superstar in a bright team jersey and sports gear, with a ball, celebrating a big win (an original team, no real club or brand)',
    art: 'glossy 3D sports video game cover art with dramatic lighting',
    scene: 'a packed stadium under floodlights with confetti and a cheering crowd',
  },
  skater: {
    outfit: 'a cool skateboarder in a hoodie, cap and sneakers holding a skateboard',
    art: 'street-art cartoon style with graffiti colours and thick outlines',
    scene: 'a skate park with ramps and colourful graffiti walls',
  },
  pixel: {
    outfit: 'a retro video game hero in a colourful tunic',
    art: 'detailed 16-bit pixel art sprite portrait, crisp pixels, limited bright palette',
    scene: 'a pixel-art world with blocky clouds, hills and floating coins',
  },
  comic: {
    outfit: 'an original comic book superhero with a cape, chest emblem shaped like a star, and a mask pushed up on the forehead',
    art: 'bold comic book illustration with ink outlines, halftone dots and a POW-style burst behind',
    scene: 'a city skyline at dusk',
  },
};

// A random twist on every go, so making another one gives something new.
const EXPRESSIONS = ['a huge cheeky grin', 'a confident smirk', 'a big excited laugh', 'a determined game face', 'a friendly wink', 'a proud victory smile'];
const POSES = [
  'head-and-shoulders, looking straight at the camera',
  'three-quarter view with arms crossed',
  'mid-action pose leaning into the frame',
  'victory pose with a fist in the air',
  'over-the-shoulder look back at the camera',
  'thumbs up to the camera',
];
const EXTRAS = [
  'a glowing trail of sparkles',
  'a cool pet sidekick (a small robot or a puppy)',
  'a shiny trophy',
  'confetti bursting in the air',
  'gold stars floating around',
  'a pair of cool sunglasses pushed up on the head',
  'a backpack covered in badges',
  'glowing sneakers',
];
const COLOURS = ['red and gold', 'turquoise and purple', 'green and orange', 'blue and silver', 'pink and yellow', 'black and neon green', 'orange and teal'];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function ageLook(age: number | null): string {
  if (!age) return '';
  if (age <= 8) return `They are ${age} years old: draw them as a young ${age}-year-old kid with a playful, cute, youthful look and child proportions, not a teenager.`;
  if (age <= 12) return `They are ${age} years old: draw them as a ${age}-year-old pre-teen with a cooler, slightly more grown-up look, still clearly a kid, not an adult.`;
  return `They are ${age} years old: draw them as a teenager, not an adult.`;
}

function buildPrompt(styleId: string, age: number | null): { prompt: string; style: string } {
  const id = STYLES[styleId] ? styleId : pick(Object.keys(STYLES));
  const st = STYLES[id];
  const prompt = [
    `Turn the child in this photo into an original video-game character: ${st.art}.`,
    `Dress them as ${st.outfit}, with a ${pick(COLOURS)} colour scheme.`,
    `Pose: ${pick(POSES)}, with ${pick(EXPRESSIONS)}. Add ${pick(EXTRAS)}.`,
    `Background: ${st.scene}.`,
    ageLook(age),
    'Keep their face shape, hair, skin tone and eye colour recognisable so the family can tell who it is.',
    'Square portrait, the character fills most of the frame. Age-appropriate and wholesome.',
    'No text, no logos, no weapons, and not any existing or copyrighted character.',
  ].join(' ');
  return { prompt, style: id };
}

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
  const { kid_id, image, style = 'surprise' } = body;
  if (!kid_id || !image || !image.startsWith('data:image/')) return json({ error: 'Missing photo or child' }, 400);
  if (image.length > 8_000_000) return json({ error: 'That photo is too big. Try a smaller one.' }, 413);

  const admin = createClient(url, service);
  const { data: kid } = await admin.from('kids').select('id, age').eq('id', kid_id).maybeSingle();
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
          prompt: built.prompt,
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

  const built = buildPrompt(style, kid.age ?? null);
  log('start', { style: built.style, age: kid.age, photoKB: Math.round(image.length / 1024) });
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
