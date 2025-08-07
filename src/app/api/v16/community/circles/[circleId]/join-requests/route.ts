import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'pending';

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Verify user is admin of this circle
    const { data: membership } = await supabase
      .from('circle_memberships')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all join requests for this circle
    const { data: requests, error } = await supabase
      .from('circle_join_requests')
      .select('*')
      .eq('circle_id', circleId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching join requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await params;
    const { 
      userId, 
      requestId, 
      decision, 
      adminResponse, 
      notificationMethod, 
      adminNotes 
    } = await request.json();

    if (!userId || !requestId || !decision) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user is admin of this circle
    const { data: membership } = await supabase
      .from('circle_memberships')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the join request details
    const { data: joinRequest, error: requestError } = await supabase
      .from('circle_join_requests')
      .select('*')
      .eq('id', requestId)
      .eq('circle_id', circleId)
      .single();

    if (requestError || !joinRequest) {
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
    }

    // Update the join request
    const { error: updateError } = await supabase
      .from('circle_join_requests')
      .update({
        status: decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        admin_response: adminResponse || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If approved, add user to circle
    if (decision === 'approved') {
      const { error: membershipError } = await supabase
        .from('circle_memberships')
        .insert({
          circle_id: circleId,
          user_id: joinRequest.requester_id,
          role: 'member',
          joined_at: new Date().toISOString(),
        });

      if (membershipError) {
        console.error('Error adding member to circle:', membershipError);
        // Don't fail the request, just log the error
      }

      // Update circle member count manually since we don't have the RPC function yet
      const { data: currentCircle } = await supabase
        .from('circles')
        .select('member_count, name')
        .eq('id', circleId)
        .single();
      
      if (currentCircle) {
        await supabase
          .from('circles')
          .update({ member_count: currentCircle.member_count + 1 })
          .eq('id', circleId);
      }

      // Send notifications based on user preferences
      if (currentCircle) {
        // Send approval email if user has notification email
        if (joinRequest.notification_email) {
          try {
            const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/v16/community/send-circle-approval-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: joinRequest.notification_email,
                circleName: currentCircle.name,
                requesterName: null, // We don't have user names in the current schema
                adminResponse: adminResponse || null,
                circleId: circleId,
              }),
            });

            if (!emailResponse.ok) {
              console.error('Failed to send approval email:', await emailResponse.text());
            } else {
              console.log('Approval email sent successfully to:', joinRequest.notification_email);
            }
          } catch (emailError) {
            console.error('Error sending approval email:', emailError);
            // Don't fail the approval process if email fails
          }
        }

        // Send approval SMS if user has notification phone
        if (joinRequest.notification_phone) {
          try {
            const smsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/v16/community/send-circle-approval-sms`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                phone: joinRequest.notification_phone,
                circleName: currentCircle.name,
                requesterName: null, // We don't have user names in the current schema
                adminResponse: adminResponse || null,
              }),
            });

            if (!smsResponse.ok) {
              console.error('Failed to send approval SMS:', await smsResponse.text());
            } else {
              const smsData = await smsResponse.json();
              console.log('Approval SMS sent successfully to:', joinRequest.notification_phone, 'TextID:', smsData.textId);
            }
          } catch (smsError) {
            console.error('Error sending approval SMS:', smsError);
            // Don't fail the approval process if SMS fails
          }
        }
      }
    }

    // Log notification tracking
    if (notificationMethod && notificationMethod !== 'none') {
      await supabase
        .from('admin_notification_log')
        .insert({
          request_id: requestId,
          notification_method: notificationMethod,
          notification_sent: false, // Will be updated when actually sent
          admin_notes: adminNotes || null,
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing join request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}