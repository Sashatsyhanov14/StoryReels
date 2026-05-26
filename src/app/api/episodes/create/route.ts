import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ChatMessage, ChatEpisodePayload } from '@/lib/chat-types';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';
export const maxDuration = 60; // LLM script generation may take up to 60s

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_MESSAGES = 12;

// ─── LLM Script Generation ─────────────────────────────────────────────────

async function generateScript(userPrompt: string): Promise<{ messages: ChatMessage[], scenario: string }> {
  const apiKey = process.env.POLZA_API_KEY;

  if (!apiKey) {
    console.warn('[generateScript] POLZA_API_KEY missing — using mock script');
    return { messages: createMockScript(userPrompt), scenario: "Mock scenario" };
  }

  console.log(`[generateScript] Requesting scenario for: "${userPrompt.substring(0, 60)}..."`);

  // Step 1: Generate Scenario
  const scenarioResponse = await fetch('https://polza.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: buildScenarioPrompt() },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.75,
    }),
  });

  if (!scenarioResponse.ok) {
    const errorText = await scenarioResponse.text().catch(() => '(unreadable)');
    throw new Error(`Polza LLM (Scenario) HTTP ${scenarioResponse.status}: ${errorText.substring(0, 300)}`);
  }

  const scenarioResult = await scenarioResponse.json();
  const scenarioText = scenarioResult?.choices?.[0]?.message?.content;

  if (!scenarioText || typeof scenarioText !== 'string') {
    throw new Error('LLM scenario response missing content');
  }

  console.log(`[generateScript] ✓ Scenario generated (${scenarioText.length} chars)`);
  console.log(`[generateScript] Requesting messages based on scenario...`);

  // Step 2: Generate Messages
  const messagesResponse = await fetch('https://polza.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: buildMessagesPrompt() },
        { role: 'user', content: `СЦЕНАРИЙ:\n${scenarioText}` },
      ],
      temperature: 0.75,
    }),
  });

  if (!messagesResponse.ok) {
    const errorText = await messagesResponse.text().catch(() => '(unreadable)');
    throw new Error(`Polza LLM (Messages) HTTP ${messagesResponse.status}: ${errorText.substring(0, 300)}`);
  }

  const messagesResult = await messagesResponse.json();
  const messagesContent = messagesResult?.choices?.[0]?.message?.content;

  if (!messagesContent || typeof messagesContent !== 'string') {
    throw new Error('LLM messages response missing content');
  }

  const messages = parseAndValidateMessages(messagesContent);
  console.log(`[generateScript] ✓ Parsed ${messages.length} messages`);
  
  return { messages, scenario: scenarioText };
}

function createMockScript(userPrompt: string): ChatMessage[] {
  return Array.from({ length: 15 }, (_, i) => ({
    id: `msg-${i + 1}`,
    sender: i % 2 === 0 ? 'Ты' : 'Собеседник',
    text: `Сообщение ${i + 1} в истории про "${userPrompt}"`,
    typingDelayMs: 1500,
    isCliffhanger: i === 5 ? true : undefined,
  }));
}

function buildScenarioPrompt(): string {
  return `Ты — профессиональный сценарист триллеров, драм и хорроров. 
Твоя задача — написать краткий, но захватывающий сценарий для чат-истории (3-4 абзаца) на основе идеи пользователя.
В сценарии обязательно должны быть:
1. Завязка сюжета.
2. Нарастание напряжения.
3. Кульминация (самый напряженный момент примерно в середине или чуть дальше, где будет стоять paywall).
4. Развязка или интригующий финал.
Главный герой чата всегда "Ты". Выдай только текст сценария.`;
}

function buildMessagesPrompt(): string {
  return `Ты — сценарист вирусных интерактивных чат-историй (в стиле Hooked). Твоя задача — опираясь на предоставленный СЦЕНАРИЙ, написать захватывающий диалог из 25-35 сообщений.

Каждое сообщение в диалоге должно быть объектом с полями:
- "id": уникальная строка, например "msg-1", "msg-2", ...
- "sender": имя отправителя, строго одно из двух: "Ты" (главный герой) или другое имя (собеседник).
- "text": текст сообщения на русском языке. Пиши кратко, живо, как в реальном мессенджере.
- "typingDelayMs": число (мс), задержка (имитация печатания). Для обычных реплик от 1000 до 3000.
- "isCliffhanger": (необязательно, boolean) установи true ровно для ОДНОГО сообщения во второй половине диалога (обычно между 12-м и 18-м сообщением), на самом кульминационном моменте из сценария. Это заблокирует чтение и вызовет paywall.

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
    const { messages, scenario } = await generateScript(prompt);

    // Find first cliffhanger index
    let cliffhangerIndex = messages.findIndex(m => m.isCliffhanger);
    if (cliffhangerIndex === -1 || cliffhangerIndex < 5) {
      cliffhangerIndex = Math.min(15, messages.length - 2);
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
    const payload: ChatEpisodePayload & { scenario?: string } = {
      messages,
      unlockedTillIndex: cliffhangerIndex,
      scenario,
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
