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

      if (!userId) {
        return NextResponse.json({ error: 'User ID not found in metadata' }, { status: 400 });
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

      // 2. Increment user token balance
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('token_balance')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error('Error fetching user:', userError);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const newTokenBalance = (user.token_balance || 0) + 1;

      const { error: updateError } = await supabase
        .from('users')
        .update({ token_balance: newTokenBalance })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user balance:', updateError);
        return NextResponse.json({ error: 'Database update error' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, message: 'Event ignored' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
