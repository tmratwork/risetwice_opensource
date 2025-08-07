import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const {
      phone,
      circleName,
      adminResponse
    } = await request.json();

    if (!phone || !circleName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.TEXTBELT_API_KEY) {
      console.error('TEXTBELT_API_KEY not configured');
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
    }

    // Create the SMS message content
    let message = `🎉 Great news! Your request to join "${circleName}" has been approved!`;

    if (adminResponse) {
      message += `\n\nMessage from admin: "${adminResponse}"`;
    }

    message += `\n\nVisit https://www.r2ai.me/chatbotV16/community/circles to enter your circle.`;

    // Add signature
    message += `\n\n- RiseTwice`;

    // Send SMS via Textbelt API
    const textbeltResponse = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        phone: phone,
        message: message,
        key: process.env.TEXTBELT_API_KEY,
      }),
    });

    const textbeltData = await textbeltResponse.json();

    if (!textbeltData.success) {
      console.error('Textbelt error:', textbeltData.error);
      return NextResponse.json({
        error: `Failed to send SMS: ${textbeltData.error}`
      }, { status: 500 });
    }

    console.log('Circle approval SMS sent successfully:', {
      phone,
      circleName,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    });

    return NextResponse.json({
      success: true,
      textId: textbeltData.textId,
      quotaRemaining: textbeltData.quotaRemaining
    });

  } catch (error) {
    console.error('Error in send-circle-approval-sms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}