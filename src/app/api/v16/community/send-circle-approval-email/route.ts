import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const {
      to,
      circleName,
      requesterName,
      adminResponse,
    } = await request.json();

    if (!to || !circleName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    // Create the email HTML content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">Great News!</h1>
          <h2 style="color: #374151; margin: 10px 0;">You've been accepted to join a circle</h2>
        </div>
        
        <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h3 style="color: #1f2937; margin-top: 0;">Circle: ${circleName}</h3>
          ${requesterName ? `<p style="color: #6b7280; margin: 10px 0;"><strong>Hello ${requesterName},</strong></p>` : ''}
          <p style="color: #374151; line-height: 1.6;">
            Your request to join <strong>"${circleName}"</strong> has been approved! You can now participate in discussions, share experiences, and connect with other members.
          </p>
          ${adminResponse ? `
          <div style="margin-top: 20px; padding: 15px; background-color: #e0f2fe; border-left: 4px solid #2563eb; border-radius: 4px;">
            <p style="margin: 0; color: #1f2937;"><strong>Message from the circle admin:</strong></p>
            <p style="margin: 10px 0 0; color: #374151; font-style: italic;">"${adminResponse}"</p>
          </div>
          ` : ''}
        </div>
        
        <div style="text-align: center; margin-bottom: 25px;">
          <a href="https://www.r2ai.me/chatbotV16/community/circles" 
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Enter Your Circle
          </a>
        </div>
        
        <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p>This email was sent because you requested to join a circle and opted to receive notifications.</p>
          <p>If you have any questions, please contact support.</p>
          <p style="margin-top: 15px;">
            RiseTwice.com
          </p>
        </div>
      </div>
    `;

    // Send the email
    const { data, error } = await resend.emails.send({
      from: 'noreply@contactus.risetwice.com',
      to: [to],
      subject: `Welcome to "${circleName}" - Your membership has been approved! Contact "${circleName}" for 
  questions, or drbyron@risetwice.com`,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    console.log('Circle approval email sent successfully:', { to, circleName, emailId: data?.id });

    return NextResponse.json({
      success: true,
      emailId: data?.id
    });

  } catch (error) {
    console.error('Error in send-circle-approval-email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}