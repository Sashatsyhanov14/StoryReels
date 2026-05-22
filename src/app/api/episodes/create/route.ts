import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ChatMessage, ChatEpisodePayload } from '@/lib/chat-types';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';
export const maxDuration = 60; // LLM script generation may take up to 60s

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_MESSAGES = 12;

// ─── LLM Script Generation ─────────────────────────────────────────────────

async function generateScript(userPrompt: string): Promise<ChatMessage[]> {
  const apiKey = process.env.POLZA_API_KEY;

  if (!apiKey) {
    console.warn('[generateScript] POLZA_API_KEY missing — using mock script');
    return createMockScript(userPrompt);
  }

  console.log(`[generateScript] Requesting chat script for: "${userPrompt.substring(0, 60)}..."`);

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
      temperature: 0.75,
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

  const messages = parseAndValidateMessages(content);
  console.log(`[generateScript] ✓ Parsed ${messages.length} messages`);
  return messages;
}

function createMockScript(userPrompt: string): ChatMessage[] {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `msg-${i + 1}`,
    sender: i % 2 === 0 ? 'Ты' : 'Собеседник',
    text: `Сообщение ${i + 1} в истории про "${userPrompt}"`,
    typingDelayMs: 1500,
    mediaPrompt: i === 4 ? `Scary shadow behind the door, dark room, 9:16 aspect ratio` : undefined,
    isCliffhanger: i === 5 ? true : undefined,
  }));
}

function buildSystemPrompt(): string {
  return `Ты — сценарист вирусных интерактивных чат-историй (в стиле Hooked, Yarn, переписки-страшилки). Твоя задача — создать захватывающий диалог из 15-20 сообщений.

Каждое сообщение в диалоге должно быть объектом с полями:
- "id": уникальная строка, например "msg-1", "msg-2", ...
- "sender": имя отправителя, строго одно из двух: "Ты" (главный герой) или другое имя (собеседник, например "Маньяк", "Мама", "Неизвестный").
- "text": текст сообщения на русском языке. Пиши кратко, живо, как в реальном мессенджере.
- "typingDelayMs": число (мс), задержка перед показом сообщения (имитация печатания). Для обычных реплик от 1000 до 3000.
- "mediaPrompt": (необязательно) если реплика подразумевает отправку фото (например: "Смотри, что за окном" или "Я отправил тебе фото..."), укажи детальный промпт для генерации картинки на английском языке. Будь конкретен (например: "A dark scary street, viewed through a dirty window, night time, cinematic lighting, 9:16 aspect ratio"). Максимум 1-2 таких фото во всей истории.
- "isCliffhanger": (необязательно, boolean) установи true ровно для ОДНОГО сообщения во второй половине диалога (обычно между 5-м и 8-м сообщением), на самом интригующем или пугающем моменте (например, прямо перед или сразу после отправки жуткого фото, или важного сюжетного поворота). Это заблокирует чтение и вызовет paywall.

Выдай ответ СТРОГО в формате JSON (массив объектов без markdown-разметки):
[
  {
    "id": "msg-1",
    "sender": "Ты",
    "text": "Привет! Ты где?",
    "typingDelayMs": 1500
  },
  ...
]`;
}

function parseAndValidateMessages(rawContent: string): ChatMessage[] {
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse LLM response as JSON');
    }
  }

  const rawMessages = Array.isArray(parsed) ? parsed : [];
  if (rawMessages.length === 0) {
    throw new Error('LLM response contains no messages array');
  }

  return rawMessages.map((rawItem: unknown, i: number): ChatMessage => {
    const raw = rawItem as Record<string, any>;
    return {
      id: typeof raw.id === 'string' ? raw.id : `msg-${i + 1}`,
      sender: typeof raw.sender === 'string' ? raw.sender : (i % 2 === 0 ? 'Ты' : 'Собеседник'),
      text: typeof raw.text === 'string' ? raw.text : '',
      typingDelayMs: typeof raw.typingDelayMs === 'number' ? raw.typingDelayMs : 1500,
      mediaPrompt: typeof raw.mediaPrompt === 'string' && raw.mediaPrompt ? raw.mediaPrompt : undefined,
      isCliffhanger: typeof raw.isCliffhanger === 'boolean' ? raw.isCliffhanger : undefined,
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

    balanceToRevert = user.token_balance;

    const { error: deductErr } = await supabase
      .from('users')
      .update({ token_balance: user.token_balance - 1 })
      .eq('id', userId);

    if (deductErr) {
      throw new Error(`Failed to deduct token: ${deductErr.message}`);
    }

    console.log(`[create] Token deducted: ${user.token_balance} → ${user.token_balance - 1}`);

    // ── 2. Generate chat messages script via LLM ─────────────────────────
    const messages = await generateScript(prompt);

    // Find first cliffhanger index
    let cliffhangerIndex = messages.findIndex(m => m.isCliffhanger);
    if (cliffhangerIndex === -1 || cliffhangerIndex < 3) {
      cliffhangerIndex = Math.min(5, messages.length - 1);
      if (messages[cliffhangerIndex]) {
        messages[cliffhangerIndex].isCliffhanger = true;
      }
    }

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

    // ── 4. Insert episode record with JSONB payload ──────────────────────
    const payload: ChatEpisodePayload = {
      messages,
      unlockedTillIndex: cliffhangerIndex,
    };

    const { data: episode, error: epError } = await supabase
      .from('episodes')
      .insert({
        user_id: userId,
        show_id: showId,
        status: 'ready', // We set it to ready immediately since script is generated
        assets_json: payload,
      })
      .select('id')
      .single();

    if (epError || !episode) {
      throw new Error(`Failed to insert episode: ${epError?.message || 'no data'}`);
    }

    console.log(`[create] ✓ Episode ${episode.id.substring(0, 8)}... created with ${messages.length} messages`);

    // ── 5. Return response ───────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      episodeId: episode.id,
      payload,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[create] ✗ Error:', message);

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
