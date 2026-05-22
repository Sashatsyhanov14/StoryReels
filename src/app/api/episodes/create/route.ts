import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // LLM script generation may take up to 30s

// ─── Types ──────────────────────────────────────────────────────────────────

interface SceneData {
  scene_text: string;
  image_prompt: string;
  voice_text: string;
  camera_effect: string;
  transition: string;
}

interface EpisodeAssets {
  progress: number;
  step: 'script' | 'keyframes' | 'voiceover' | 'compiling' | 'done';
  userPrompt: string;
  scenes: SceneData[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SCENE_COUNT = 12;

const VALID_CAMERA_EFFECTS = [
  'zoom-in-fast', 'zoom-out-slow', 'camera-shake',
  'zoom-in-spin', 'pan-left', 'pan-right', 'pan-diagonal',
] as const;

const VALID_TRANSITIONS = [
  'fade-to-black', 'glitch-cut', 'white-flash', 'cross-blur', 'cross-fade',
] as const;

// ─── LLM Script Generation ─────────────────────────────────────────────────

/**
 * Generates a storyboard script of SCENE_COUNT scenes via Polza.ai (gpt-4o-mini).
 * Returns validated and sanitized scene data.
 */
async function generateScript(userPrompt: string): Promise<SceneData[]> {
  const apiKey = process.env.POLZA_API_KEY;

  if (!apiKey) {
    console.warn('[generateScript] POLZA_API_KEY missing — using mock script');
    return createMockScript(userPrompt);
  }

  console.log(`[generateScript] Requesting ${SCENE_COUNT}-scene script for: "${userPrompt.substring(0, 60)}..."`);

  const response = await fetch('https://polza.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(unreadable)');
    throw new Error(`Polza LLM HTTP ${response.status}: ${errorText.substring(0, 300)}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;

  if (!content || typeof content !== 'string') {
    throw new Error('LLM response missing content');
  }

  const scenes = parseAndValidateScenes(content);
  console.log(`[generateScript] ✓ Parsed ${scenes.length} scenes`);
  return scenes;
}

/**
 * Creates a deterministic mock script for development/testing.
 */
function createMockScript(userPrompt: string): SceneData[] {
  return Array.from({ length: SCENE_COUNT }, (_, i) => ({
    scene_text: `Описание действия и визуала для кадра ${i + 1}`,
    image_prompt: `16-bit pixel art style, retro JRPG aesthetic, SNES HD-2D style, detailed pixel art, scene from: ${userPrompt}`,
    voice_text: `Сцена ${i + 1}: Глубокий закадровый текст на русском. Сюжет для "${userPrompt}"`,
    camera_effect: VALID_CAMERA_EFFECTS[i % VALID_CAMERA_EFFECTS.length],
    transition: VALID_TRANSITIONS[i % VALID_TRANSITIONS.length],
  }));
}

/**
 * Builds the system prompt for the LLM scriptwriter.
 */
function buildSystemPrompt(): string {
  return `Ты — режиссер и сценарист вирусных кинематографичных Reels/TikTok видео (в стиле крутых эдитов из CapCut). Твоя задача — создать глубокий, психологический или остросюжетный мини-сериал, который ощущается как ОДНО ЦЕЛЬНОЕ непрерывное видео из ${SCENE_COUNT} кадров.

Стиль: СТРОГО 16-bit pixel art style, retro JRPG aesthetic, SNES HD-2D style, detailed pixel art. Все сцены должны выглядеть как кадры из одной ретро-игры на Super Nintendo.
Важно: зафиксируй внешность персонажей, прописывай её в каждом image_prompt, чтобы они не менялись внешне. Эти кадры будут склеены в одно видео, поэтому визуальный стиль должен быть максимально консистентным. Каждый image_prompt ОБЯЗАТЕЛЬНО должен начинаться со слов: "16-bit pixel art style, retro JRPG aesthetic, SNES HD-2D style".

Правила драматургии и озвучки (CapCut style):
Кадры 1-2: Мощный хук (hook), экспозиция, завязка. Закадровый голос должен интриговать с первой секунды.
Кадры 3-5: Развитие сюжета, знакомство с миром и персонажами. Текст (voice_text) должен плавно перетекать из кадра в кадр, как единый монолог диктора.
Кадры 6-8: Нарастание напряжения, усложнение конфликта. Визуал становится динамичнее.
Кадры 9-10: Кульминация, пик конфликта, экшен.
Кадр 11: Развязка или ложная развязка.
Кадр 12: Клиффхэнгер или мощный вывод. Сцена обрывается на интригующем моменте.

В полях camera_effect используй значения: ${VALID_CAMERA_EFFECTS.map(e => `'${e}'`).join(', ')}. Чередуй их логично для видео-монтажа.
В полях transition используй: ${VALID_TRANSITIONS.map(t => `'${t}'`).join(', ')}.

Выдай ответ СТРОГО в формате JSON (массив из ${SCENE_COUNT} объектов), без markdown-разметки:
[
  {
    "frame": 1,
    "scene_text": "Текст сценария: краткое описание того, что происходит в этой сцене",
    "image_prompt": "16-bit pixel art style, retro JRPG aesthetic, SNES HD-2D style, [English description of the scene for the image generator, maintaining the main character's design]",
    "voice_text": "Глубокий непрерывный закадровый текст на русском для TTS. Плотный сюжет, фраза может начаться здесь...",
    "camera_effect": "camera-shake",
    "transition": "cross-fade"
  }
]`;
}

/**
 * Parses the LLM JSON output and validates each scene has all required fields.
 * Strips markdown wrappers, handles edge cases.
 */
function parseAndValidateScenes(rawContent: string): SceneData[] {
  // Strip markdown code fences if present
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Attempt to extract JSON array from the content
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse LLM response as JSON');
    }
  }

  const parsedObj = parsed as Record<string, unknown>;
  const rawScenes = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsedObj?.scenes) ? parsedObj.scenes : null)
      || (Array.isArray(parsedObj?.storyboard) ? parsedObj.storyboard : null)
      || [];

  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    throw new Error('LLM response contains no scenes array');
  }

  return rawScenes.slice(0, SCENE_COUNT).map((rawItem: unknown, i: number): SceneData => {
    const raw = rawItem as Record<string, unknown>;
    return {
    scene_text: typeof raw.scene_text === 'string'
      ? raw.scene_text
      : `Сцена ${i + 1}`,
    image_prompt: typeof raw.image_prompt === 'string'
      ? raw.image_prompt
      : '16-bit pixel art style, retro JRPG aesthetic, SNES HD-2D style',
    voice_text: typeof raw.voice_text === 'string'
      ? raw.voice_text
      : `Сцена ${i + 1}`,
    camera_effect: typeof raw.camera_effect === 'string' && (VALID_CAMERA_EFFECTS as readonly string[]).includes(raw.camera_effect)
      ? raw.camera_effect
      : VALID_CAMERA_EFFECTS[i % VALID_CAMERA_EFFECTS.length],
    transition: typeof raw.transition === 'string' && (VALID_TRANSITIONS as readonly string[]).includes(raw.transition)
      ? raw.transition
      : VALID_TRANSITIONS[i % VALID_TRANSITIONS.length],
    };
  });
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let userId: string | null = null;
  let balanceToRevert: number | null = null;

  try {
    const body = await request.json();
    userId = body.userId;
    const prompt: string = body.prompt || '';
    let showId: string | undefined = body.showId;

    // ── Validate ──────────────────────────────────────────────────────────
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    console.log(`\n━━━ Create Episode for user ${userId.substring(0, 8)}... ━━━`);
    console.log(`[create] Prompt: "${prompt.substring(0, 80)}..."`);

    const supabase = getSupabaseAdmin();

    // ── 1. Check & deduct token balance ───────────────────────────────────
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.token_balance < 1) {
      return NextResponse.json({ error: 'Insufficient tokens' }, { status: 402 });
    }

    // Save pre-deduction balance for potential rollback
    balanceToRevert = user.token_balance;

    const { error: deductErr } = await supabase
      .from('users')
      .update({ token_balance: user.token_balance - 1 })
      .eq('id', userId);

    if (deductErr) {
      throw new Error(`Failed to deduct token: ${deductErr.message}`);
    }

    console.log(`[create] Token deducted: ${user.token_balance} → ${user.token_balance - 1}`);

    // ── 2. Generate storyboard script via LLM ────────────────────────────
    const scenes = await generateScript(prompt);

    // ── 3. Create show if not provided ───────────────────────────────────
    if (!showId) {
      const showTitle = prompt.length > 30
        ? prompt.substring(0, 30) + '...'
        : prompt;

      const { data: newShow, error: showError } = await supabase
        .from('shows')
        .insert({ user_id: userId, title: showTitle })
        .select('id')
        .single();

      if (!showError && newShow) {
        showId = newShow.id;
        console.log(`[create] New show created: ${showId?.substring(0, 8)}...`);
      }
    }

    // ── 4. Insert episode record ─────────────────────────────────────────
    const initialAssets: EpisodeAssets = {
      progress: 0,
      step: 'keyframes',
      userPrompt: prompt,
      scenes,
    };

    const { data: episode, error: epError } = await supabase
      .from('episodes')
      .insert({
        user_id: userId,
        show_id: showId,
        status: 'pending',
        assets_json: initialAssets,
      })
      .select('id')
      .single();

    if (epError || !episode) {
      throw new Error(`Failed to insert episode: ${epError?.message || 'no data'}`);
    }

    console.log(`[create] ✓ Episode ${episode.id.substring(0, 8)}... created with ${scenes.length} scenes`);

    // ── 5. Return response ───────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      episodeId: episode.id,
      scenes,
      totalScenes: scenes.length,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[create] ✗ Error:', message);

    // Rollback token deduction on failure
    if (userId && balanceToRevert !== null) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('users')
          .update({ token_balance: balanceToRevert })
          .eq('id', userId);
        console.log('[create] Token refunded');
      } catch (refundErr) {
        console.error('[create] ✗ Failed to refund token:', refundErr);
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
