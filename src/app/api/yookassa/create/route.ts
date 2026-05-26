import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { userId, episodeId } = await request.json();

    if (!userId || !episodeId) {
      return NextResponse.json({ error: 'User ID and Episode ID are required' }, { status: 400 });
    }

    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    const idempotenceKey = uuidv4();

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: {
          value: '100.00', // 100 RUB per token
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success`,
        },
        description: 'Разблокировка концовки истории',
        metadata: {
          user_id: userId,
          episode_id: episodeId,
        },
      }),
    });

    const paymentData = await response.json();

    if (!response.ok) {
      console.error('YooKassa error:', paymentData);
      return NextResponse.json({ error: 'Payment creation failed' }, { status: response.status });
    }

    return NextResponse.json({ 
      confirmation_url: paymentData.confirmation.confirmation_url 
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
