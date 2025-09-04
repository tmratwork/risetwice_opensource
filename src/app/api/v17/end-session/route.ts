// src/app/api/v17/end-session/route.ts
// V17 Eleven Labs End Session - Adapted from V16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logTriageHandoffServer, generateHandoffCorrelationId } from '@/utils/server-logger';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const handoffCorrelationId = generateHandoffCorrelationId();
  
  try {
    const body = await request.json();
    const { conversationId, specialistType, contextSummary, reason } = body;

    logV17('🛑 V17 end-session request', {
      conversationId,
      specialistType: specialistType || 'unknown',
      hasContextSummary: !!contextSummary,
      reason
    });

    logTriageHandoffServer({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'HANDOFF',
      operation: 'v17-step-2-end-triage-session',
      correlationId: handoffCorrelationId,
      conversationId,
      specialistType: specialistType || 'unknown',
      data: {
        version: 'V17',
        provider: 'eleven-labs',
        reason,
        contextSummaryLength: contextSummary?.length || 0,
        contextSummaryPreview: contextSummary ? contextSummary.substring(0, 100) + '...' : null
      }
    });

    if (!conversationId) {
      logV17('❌ Missing conversation ID');
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    logV17('🔄 Updating conversation to end V17 specialist session');

    // Update conversation to mark specialist session as ended
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        current_specialist: null,
        specialist_history: supabase.rpc('jsonb_set', {
          target: 'specialist_history',
          path: `{-1,ended_at}`,
          new_value: JSON.stringify(new Date().toISOString())
        }),
        metadata: supabase.rpc('jsonb_set', {
          target: 'metadata',
          path: '{last_session_end}',
          new_value: JSON.stringify(new Date().toISOString())
        })
      })
      .eq('id', conversationId);

    if (updateError) {
      logV17('❌ Error updating conversation for session end', updateError);
      return NextResponse.json(
        { error: `Failed to end session: ${updateError.message}` },
        { status: 500 }
      );
    }

    logV17('✅ Conversation updated for V17 session end');

    // If there's a context summary, save it for potential handoff
    if (contextSummary) {
      logV17('💾 Saving context summary for potential handoff', {
        contextLength: contextSummary.length
      });

      logTriageHandoffServer({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        category: 'HANDOFF',
        operation: 'v17-step-2-save-context-summary',
        correlationId: handoffCorrelationId,
        conversationId,
        specialistType: specialistType || 'unknown',
        data: {
          version: 'V17',
          provider: 'eleven-labs',
          contextLength: contextSummary.length,
          savingToRoutingMetadata: true
        }
      });
      
      // Save to messages table with routing metadata using admin client
      const { error: messageError } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'system',
          content: `V17 session ended. Context summary: ${contextSummary}`,
          routing_metadata: {
            type: 'session_end',
            version: 'V17',
            provider: 'eleven-labs',
            specialist: specialistType,
            reason,
            context_summary: contextSummary,
            timestamp: new Date().toISOString()
          }
        });

      if (messageError) {
        logV17('⚠️ Error saving context summary (non-critical)', messageError);
        // Don't fail the request for this error
      } else {
        logV17('✅ Context summary saved successfully');
      }
    }

    logV17('🎯 V17 session ended successfully', {
      conversationId,
      specialistType,
      reason,
      hasContextSummary: !!contextSummary
    });

    return NextResponse.json({
      success: true,
      version: 'V17',
      provider: 'eleven-labs',
      conversationId,
      contextSummary,
      endedAt: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Unexpected error in V17 end-session', error);
    console.error('[V17] end-session error:', error);
    return NextResponse.json(
      { error: 'Internal server error ending V17 session' },
      { status: 500 }
    );
  }
}