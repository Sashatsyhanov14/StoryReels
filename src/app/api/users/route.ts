import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId, addTokens } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Try to get user
    const { data: dbUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let user = dbUser;

    // If user does not exist, create it with 5 starter tokens
    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: userId,
          token_balance: 5
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      user = newUser;
    }

    // If addTokens is specified, update the user balance in Supabase
    if (addTokens) {
      const { data: updatedUser, error: updateErr } = await supabase
        .from('users')
        .update({ token_balance: (user.token_balance || 0) + addTokens })
        .eq('id', userId)
        .select()
        .single();

      if (!updateErr && updatedUser) {
        user = updatedUser;
      }
    }

    return NextResponse.json({ 
      userId: user.id, 
      tokenBalance: user.token_balance 
    });
  } catch (error) {
    console.error('Sync user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
