import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SceneData {
  image_prompt: string;
  voice_text: string;
  camera_effect: string;
  transition: string;
}

// Real Polza.ai LLM generation using openai/gpt-4o-mini
async function generateScript(userPrompt: string): Promise<SceneData[]> {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    console.warn('POLZA_API_KEY is not defined, using mock script.');
    return Array.from({ length: 15 }, (_, i) => ({
      image_prompt: `cyberpunk neon noir scene part ${i + 1} maintaining the main character design in 90s anime style, based on ${userPrompt}`,
      voice_text: `Сцена ${i + 1}: Глубокий закадровый текст на русском. Сюжет для "${userPrompt}"`,
      camera_effect: i % 2 === 0 ? 'pan-diagonal' : 'zoom-in-fast',
      transition: i % 2 === 0 ? 'fade-to-black' : 'glitch-cut'
    }));
  }

  const response = await fetch('https://polza.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Ты — режиссер и сценарист вирусных кинематографичных Reels/TikTok видео (в стиле крутых эдитов из CapCut). Твоя задача — создать глубокий, психологический или остросюжетный мини-сериал, который ощущается как ОДНО ЦЕЛЬНОЕ непрерывное видео из 15 кадров.

Стиль: flat vector 2d cartoon style, 90s anime aesthetic, cinematic lighting.
Важно: зафиксируй внешность персонажей, прописывай её в каждом image_prompt, чтобы они не менялись внешне. Эти кадры будут склеены в одно видео, поэтому визуальный стиль должен быть максимально консистентным.

Правила драматургии и озвучки (CapCut style):
Кадры 1-3: Мощный хук (hook), экспозиция, завязка. Закадровый голос должен интриговать с первой секунды.
Кадры 4-10: Развитие сюжета, нарастание напряжения. Текст (voice_text) должен плавно перетекать из кадра в кадр, как единый монолог диктора, а не отдельные обрывки.
Кадры 11-14: Пик конфликта, экшен, безысходность.
Кадр 15: Клиффхэнгер или мощный вывод. Сцена обрывается на интригующем моменте.

В полях camera_effect используй значения: 'zoom-in-fast', 'zoom-out-slow', 'camera-shake', 'zoom-in-spin', 'pan-left', 'pan-right', 'pan-diagonal'. Чередуй их логично для видео-монтажа.
В полях transition используй: 'fade-to-black', 'glitch-cut', 'white-flash', 'cross-blur', 'cross-fade'.

Выдай ответ СТРОГО в формате JSON (массив из 15 объектов), без markdown-разметки:
[
  {
    "frame": 1,
    "image_prompt": "Detailed description of the scene for Flux Schnell/Z-Image in English, maintaining the main character's design and 90s anime style",
    "voice_text": "Глубокий непрерывный закадровый текст на русском для TTS. Плотный сюжет, фраза может начаться здесь...",
    "camera_effect": "camera-shake",
    "transition": "cross-fade"
  },
  {
    "frame": 2,
    "image_prompt": "...",
    "voice_text": "...и логично продолжиться в следующем кадре, создавая эффект непрерывного аудио-потока.",
    "camera_effect": "zoom-in-fast",
    "transition": "glitch-cut"
  }
]
`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Polza Script Generation failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  
  // Clean potential markdown wrap
  const cleanContent = content.trim().replace(/^```json\s*/, '').replace(/```$/, '');
  const parsed = JSON.parse(cleanContent);
  
  const rawScenes = Array.isArray(parsed) ? parsed : (parsed.scenes || parsed.storyboard || []);
  if (!Array.isArray(rawScenes) || rawScenes.length === 0) {
    throw new Error('Invalid response structure from Polza script generation');
  }

  const transitions = ['fade-to-black', 'glitch-cut', 'white-flash', 'cross-blur', 'cross-fade'];
  const cameraEffects = ['zoom-in-fast', 'zoom-out-slow', 'camera-shake', 'zoom-in-spin', 'pan-left', 'pan-right', 'pan-diagonal'];

  return rawScenes.slice(0, 15).map((scene: unknown, i) => {
    const s = scene as Record<string, unknown>;
    return {
      image_prompt: typeof s.image_prompt === 'string' ? s.image_prompt : 'cinematic shot, 90s anime style',
      voice_text: typeof s.voice_text === 'string' ? s.voice_text : '',
      camera_effect: typeof s.camera_effect === 'string' && cameraEffects.includes(s.camera_effect)
        ? s.camera_effect
        : cameraEffects[i % cameraEffects.length],
      transition: typeof s.transition === 'string' && transitions.includes(s.transition)
        ? s.transition
        : transitions[i % transitions.length]
    };
  });
}

export async function POST(request: Request) {
  let userId: string | null = null;
  let balanceToRevert: number | null = null;

  try {
    const body = await request.json();
    userId = body.userId;
    const prompt = body.prompt;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Deduct 1 token
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (userError || !user || user.token_balance < 1) {
      return NextResponse.json({ error: 'Insufficient tokens' }, { status: 402 });
    }

    balanceToRevert = user.token_balance;

    await supabase
      .from('users')
      .update({ token_balance: user.token_balance - 1 })
      .eq('id', userId);

    // 2. Generate the storyboard script via LLM
    const script = await generateScript(prompt || 'киберпанк приключение');

    // 3. Create pending episode record with the scenes array initialized
    const initialAssets = {
      progress: 10,
      step: 'keyframes' as const,
      userPrompt: prompt || 'киберпанк приключение',
      scenes: script
    };

    const { data: episode, error: epError } = await supabase
      .from('episodes')
      .insert({
        user_id: userId,
        status: 'pending',
        assets_json: initialAssets
      })
      .select()
      .single();

    if (epError || !episode) {
      throw new Error('Failed to create episode record in DB');
    }

    return NextResponse.json({ success: true, episodeId: episode.id, scenes: script });

  } catch (error) {
    console.error('Episode creation error:', error);
    
    // Revert token deduction if we failed during LLM or DB insertion
    if (userId && balanceToRevert !== null) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('users')
          .update({ token_balance: balanceToRevert })
          .eq('id', userId);
      } catch (refundErr) {
        console.error('Failed to refund token after generation error:', refundErr);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
