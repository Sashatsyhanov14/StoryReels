import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

      // Start transaction process equivalent
      
      // 1. Create transaction record
      const { error: txError } = await supabaseAdmin
        .from('transactions')
        .insert({
          id: paymentId, // Optional: using YooKassa payment ID as tx ID
          user_id: userId,
          amount_rub: parseFloat(amount),
          status: 'success'
        });

      if (txError) {
        console.error('Error inserting transaction:', txError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // 2. Increment user token balance
      // We will read first, then update
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('token_balance')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error('Error fetching user:', userError);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const newTokenBalance = (user.token_balance || 0) + 1; // Assuming 1 payment = 1 token

      const { error: updateError } = await supabaseAdmin
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
