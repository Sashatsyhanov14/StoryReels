import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// YooKassa Webhook Handler
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verification of the YooKassa event
    if (body.event === 'payment.succeeded') {
      const paymentId = body.object.id;
      const amount = body.object.amount.value;
      const userId = body.object.metadata?.user_id;
      const episodeId = body.object.metadata?.episode_id;

      if (!userId || !episodeId) {
        return NextResponse.json({ error: 'User ID or Episode ID not found in metadata' }, { status: 400 });
      }

      const supabase = getSupabaseAdmin();

      // Check if transaction already exists to ensure idempotency
      const { data: existingTx, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('id', paymentId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking transaction existence:', checkError);
        return NextResponse.json({ error: 'Database check error' }, { status: 500 });
      }

      if (existingTx) {
        console.log(`Transaction ${paymentId} already processed (idempotency guard)`);
        return NextResponse.json({ success: true, message: 'Already processed' });
      }

      // 1. Create transaction record
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          id: paymentId,
          user_id: userId,
          amount_rub: parseFloat(amount),
          status: 'success'
        });

      if (txError) {
        console.error('Error inserting transaction:', txError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // 2. Fetch the episode to get the number of messages
      const { data: episode, error: epError } = await supabase
        .from('episodes')
        .select('assets_json')
        .eq('id', episodeId)
        .single();

      if (epError || !episode) {
        console.error('Error fetching episode:', epError);
        return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
      }

      // 3. Update unlockedTillIndex inside assets_json
      const assets = episode.assets_json as any;
      if (assets && assets.messages) {
        assets.unlockedTillIndex = assets.messages.length; // unlock all

        const { error: updateError } = await supabase
          .from('episodes')
          .update({ assets_json: assets })
          .eq('id', episodeId);

        if (updateError) {
          console.error('Error updating episode:', updateError);
          return NextResponse.json({ error: 'Database update error' }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, message: 'Event ignored' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
