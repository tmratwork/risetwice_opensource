// src/app/api/provider/save-access-code/route.ts
// Saves provider access code after successful validation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessCode, providerUserId, intakeId } = body;

    if (!accessCode || !providerUserId || !intakeId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this combination already exists
    const { data: existing } = await supabase
      .from('provider_access_codes')
      .select('id')
      .eq('provider_user_id', providerUserId)
      .eq('access_code', accessCode)
      .single();

    if (existing) {
      // Update existing entry with new timestamp
      const { error: updateError } = await supabase
        .from('provider_access_codes')
        .update({
          last_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating access code:', updateError);
        return NextResponse.json(
          { error: 'Failed to update access code' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        updated: true
      });
    } else {
      // Insert new entry
      const { error: insertError } = await supabase
        .from('provider_access_codes')
        .insert({
          provider_user_id: providerUserId,
          access_code: accessCode,
          intake_id: intakeId,
          first_entered_at: new Date().toISOString(),
          last_entered_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting access code:', insertError);
        return NextResponse.json(
          { error: 'Failed to save access code' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        created: true
      });
    }

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
