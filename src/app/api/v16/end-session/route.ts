import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logTriageEvent, generateCorrelationId } from '@/utils/triage-logger';
import { logTriageHandoffServer, generateHandoffCorrelationId } from '@/utils/server-logger';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId();
  const handoffCorrelationId = generateHandoffCorrelationId();
  
  try {
    const body = await request.json();
    const { conversationId, specialistType, contextSummary, reason } = body;

    logTriageHandoffServer({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'HANDOFF',
      operation: 'step-2-end-triage-session',
      correlationId: handoffCorrelationId,
      conversationId,
      specialistType: specialistType || 'unknown',
      data: {
        reason,
        contextSummaryLength: contextSummary?.length || 0,
        contextSummaryPreview: contextSummary ? contextSummary.substring(0, 100) + '...' : null
      }
    });

    logTriageEvent({
      level: 'INFO',
      category: 'API',
      operation: 'end-session-request',
      correlationId,
      conversationId,
      specialistType: specialistType || 'unknown',
      data: {
        hasContextSummary: !!contextSummary,
        contextLength: contextSummary?.length || 0,
        reason
      }
    });

    // console.log(`[V16] 📡 API: end-session request received`, {
    //   conversationId,
    //   specialistType: specialistType || 'unknown',
    //   hasContextSummary: !!contextSummary,
    //   contextLength: contextSummary?.length || 0,
    //   reason,
    //   timestamp: new Date().toISOString(),
    //   correlationId
    // });

    if (!conversationId) {
      logTriageEvent({
        level: 'ERROR',
        category: 'API',
        operation: 'end-session-validation-failed',
        correlationId,
        error: 'Missing conversation ID'
      });
      // console.error(`[V16] ❌ API: end-session - missing conversation ID`);
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // console.log(`[V16] 🔄 API: Updating conversation to end specialist session`, {
    //   conversationId,
    //   currentSpecialist: specialistType
    // });

    // Update conversation to mark specialist session as ended
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        current_specialist: null,
        specialist_history: supabase.rpc('jsonb_set', {
          target: 'specialist_history',
          path: `{-1,ended_at}`,
          new_value: JSON.stringify(new Date().toISOString())
        })
      })
      .eq('id', conversationId);

    if (updateError) {
      // console.error('[V16] ❌ API: Error updating conversation for session end', {
      //   conversationId,
      //   error: updateError.message,
      //   code: updateError.code
      // });
      return NextResponse.json(
        { error: `Failed to end session: ${updateError.message}` },
        { status: 500 }
      );
    }

    // console.log(`[V16] ✅ API: Conversation updated successfully for session end`);

    // If there's a context summary, save it for potential handoff
    if (contextSummary) {
      logTriageHandoffServer({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        category: 'HANDOFF',
        operation: 'step-2-save-context-summary',
        correlationId: handoffCorrelationId,
        conversationId,
        specialistType: specialistType || 'unknown',
        data: {
          contextLength: contextSummary.length,
          savingToRoutingMetadata: true
        }
      });
      
      // console.log(`[triageAI][handoff] 💾 Step 2/5: Saving context summary for handoff`, {
      //   conversationId,
      //   contextLength: contextSummary.length,
      //   reason
      // });
      
      // Save to messages table with routing metadata using admin client
      const { error: messageError } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'system',
          content: `Session ended. Context summary: ${contextSummary}`,
          routing_metadata: {
            type: 'session_end',
            specialist: specialistType,
            reason,
            context_summary: contextSummary,
            timestamp: new Date().toISOString()
          }
        });

      if (messageError) {
        // console.error('[V16] ⚠️ API: Error saving context summary (non-critical)', {
        //   conversationId,
        //   error: messageError.message,
        //   code: messageError.code
        // });
        // Don't fail the request for this error, just log it
      } else {
        // console.log(`[V16] ✅ API: Context summary saved successfully`);
      }
    }

    // console.log(`[V16] 🎯 API: Session ended successfully`, {
    //   conversationId,
    //   specialistType,
    //   reason,
    //   hasContextSummary: !!contextSummary
    // });

    return NextResponse.json({
      success: true,
      conversationId,
      contextSummary,
      endedAt: new Date().toISOString()
    });

  } catch (error) {
    // console.error('[V16] ❌ API: Unexpected error in end-session', {
    //   error: (error as Error).message,
    //   stack: (error as Error).stack
    // });
    void error;
    return NextResponse.json(
      { error: 'Internal server error ending session' },
      { status: 500 }
    );
  }
}