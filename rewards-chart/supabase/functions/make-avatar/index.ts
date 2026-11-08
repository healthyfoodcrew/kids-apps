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
// Optional poses / extras replace the random ones for that style.
type Style = { outfit: string; art: string; scene: string; poses?: string[]; extras?: string[] };
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
  space: {
    outfit: 'a space ranger in a bright astronaut suit with a glowing badge, helmet tucked under one arm',
    art: 'clean 3D animated film style with soft lighting',
    scene: 'outer space with a ringed planet, stars and a small rocket',
  },
  knight: {
    outfit: 'a brave young knight in shiny armour with a cape and a crest shield on the back, no sword',
    art: 'storybook 3D fantasy game art',
    scene: 'a castle courtyard with flags flying and a friendly dragon peeking in the distance',
  },
  basketball: {
    outfit: 'a pro basketball player in an original team jersey with a big number on the chest and wristbands, nothing on his head (no headband, no sweatband, no hat), his real hair showing, like an official pro-league player profile photo (no real team, league or brand)',
    art: 'premium pro basketball player profile portrait, like an official media-day headshot, glossy 3D game style with crisp studio lighting and strong rim light',
    scene: 'a championship celebration blurred behind him in a packed arena: confetti falling, streamers, cheering crowd, bright arena lights and a glowing scoreboard',
    poses: [
      'waist-up player profile shot, arms crossed confidently, facing the camera',
      'waist-up, arms crossed with a basketball tucked under one arm, facing the camera',
      'chest-up, arms crossed, chin slightly raised like a champion, facing the camera',
      'waist-up, arms crossed, leaning back slightly with a confident grin, facing the camera',
    ],
    extras: ['gold confetti falling around him', 'a championship trophy glowing in the background', 'camera flashes popping in the crowd', 'smoke and spotlights behind him'],
  },
  afl: {
    outfit: 'an Australian Rules football star in a sleeveless guernsey in original colours (no real club), shorts and long socks, holding an oval AFL-style football ready to kick',
    art: 'glossy 3D sports video game cover art with dramatic lighting',
    scene: 'a big oval footy ground under lights with the tall goal posts, a cheering crowd and confetti',
  },
  martial: {
    outfit: 'a martial arts champion in a crisp white gi with a black belt, in a strong karate stance with a focused look',
    art: 'dynamic 3D fighting-game character art with energy swirls and speed lines',
    scene: 'a dojo with wooden floors, paper screens and a glowing sunrise through the window',
  },
  soccer: {
    outfit: 'a soccer star in a bright original team kit with shin pads and boots, a soccer ball at their feet or balanced on a knee (no real club or brand)',
    art: 'glossy 3D soccer video game cover art with dramatic stadium lighting',
    scene: 'a green soccer pitch in a huge stadium under floodlights, the goal net behind and fans cheering',
  },
  army: {
    outfit: 'an army soldier hero in camouflage fatigues, a combat helmet with goggles pushed up, a tactical vest with pouches and a radio, dog tags and gloves (no guns or weapons)',
    art: 'gritty but kid-friendly 3D military video game cover art with dramatic lighting',
    scene: 'a desert or forest base camp with sandbags, a big transport helicopter and a flag waving at sunset',
    poses: ['waist-up, arms crossed, facing the camera', 'saluting proudly, facing the camera', 'hands on his vest straps, facing the camera', 'thumbs up, facing the camera'],
    extras: ['dust blowing in the wind', 'a helicopter flying overhead', 'a badge of honour on his chest', 'night-vision goggles on the helmet'],
  },
  swat: {
    outfit: 'an elite special forces / SWAT team member in a black tactical uniform, a tactical helmet with night-vision goggles flipped up, an armoured vest with team patches and a radio earpiece, tactical gloves (no guns or weapons)',
    art: 'sleek 3D tactical action video game cover art with high-contrast lighting',
    scene: 'a city rooftop at night with an armoured team truck, searchlights and a helicopter spotlight',
    poses: ['waist-up, arms crossed, facing the camera', 'chest-up, steely confident look, facing the camera', 'hands on his vest straps, facing the camera', 'walking towards the camera like a team leader'],
    extras: ['red and blue lights glowing behind him', 'a helicopter spotlight beam', 'rain and city lights', 'his squad in silhouette behind him'],
  },
  skater: {
    outfit: 'a cool skateboarder in a hoodie, cap and sneakers holding a skateboard',
    art: 'street-art cartoon style with graffiti colours and thick outlines',
    scene: 'a skate park with ramps and colourful graffiti walls',
  },
};

// A random twist on every go, so making another one gives something new.
const EXPRESSIONS = ['a big cheeky grin', 'a confident grin', 'a big excited laugh', 'a determined game face', 'a proud victory smile'];
// Every pose keeps his face towards the camera so it stays true to the photo.
const POSES = [
  'head-and-shoulders, facing the camera',
  'arms crossed, facing the camera',
  'victory pose with a fist in the air, face towards the camera',
  'thumbs up, facing the camera',
  'holding his gear proudly, facing the camera',
  'hands on hips like a champion, facing the camera',
];
const EXTRAS = [
  'a cool energy glow around the fists',
  'a cool pet sidekick (a small robot or a puppy)',
  'a shiny trophy',
  'confetti bursting in the air',
  'a champion medal around the neck',
  'a sweatband on the forehead',
  'a backpack covered in badges',
  'glowing sneakers',
];
const COLOURS = ['red and gold', 'turquoise and navy', 'green and orange', 'blue and silver', 'red and black', 'black and neon green', 'orange and teal'];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

function ageLook(age: number | null): string {
  if (!age) return '';
  if (age <= 8) return `They are ${age} years old: draw him as a young ${age}-year-old boy with a playful, energetic, cheeky look and young boy proportions, not a teenager.`;
  if (age <= 12) return `They are ${age} years old: draw him as a ${age}-year-old pre-teen boy with a cooler, sportier, slightly more grown-up look, still clearly a kid, not an adult.`;
  return `They are ${age} years old: draw him as a teenage boy, not an adult.`;
}

function buildPrompt(styleId: string, age: number | null): { prompt: string; style: string } {
  const id = STYLES[styleId] ? styleId : pick(Object.keys(STYLES));
  const st = STYLES[id];
  const prompt = [
    'Most important: keep this exact boy\'s real face so he is instantly recognisable as himself. Match his face shape, eye shape and colour, eyebrows, nose, mouth and smile, ears, skin tone, and any freckles, dimples or missing teeth, plus his real hair colour, length and style. Stylise the clothes, scene and lighting, but only lightly stylise the face; do not change his features or make him look like a different child.',
    `Turn him into an original video-game character: ${st.art}.`,
    `Dress him as ${st.outfit}, with a ${pick(COLOURS)} colour scheme.`,
    `Pose: ${pick(st.poses ?? POSES)}, with ${pick(EXPRESSIONS)}. Add ${pick(st.extras ?? EXTRAS)}.`,
    `Background: ${st.scene}.`,
    ageLook(age),
    'Make him look like a real boy: sporty, tough and cool, with his own natural boyish face. No makeup, no lipstick, no eyeliner, no long eyelashes, no glossy or pouty lips, no glitter, no hearts, no flamboyant or overly pretty styling.',
    'Both eyes open, no winking.',
    'Keep the face true to the photo: same person, just in costume.',
    'Square portrait, the character fills most of the frame. Age-appropriate and wholesome.',
    'No words or logos (a jersey number is fine), no weapons, and not any existing or copyrighted character.',
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
