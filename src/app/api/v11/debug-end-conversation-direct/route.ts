// src/app/api/v11/debug-end-conversation-direct/route.ts
/**
 * V11 API - Debug End Conversation Direct Endpoint
 * 
 * This endpoint directly executes a SQL query to mark a conversation as inactive
 * For debugging purposes only - to be used when the regular endpoint isn't working
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[V11-DEBUG-END-CONV-${requestId}]`;

  console.log(`${logPrefix} Received debug end conversation direct request`);

  try {
    // Get query parameters
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const conversationId = url.searchParams.get('conversationId');

    // Validate request
    if (!userId) {
      console.error(`${logPrefix} Missing userId parameter`);
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    console.log(`${logPrefix} Processing debug end conversation for user: ${userId}`);

    // Log the SQL we would execute for debug purposes
    const sqlStatement = conversationId
      ? `UPDATE conversations SET is_active = false WHERE human_id = '${userId}' AND id = '${conversationId}'`
      : `UPDATE conversations SET is_active = false WHERE human_id = '${userId}' AND is_active = true`;

    console.log(`${logPrefix} SQL Statement: ${sqlStatement}`);

    // First directly check if the conversation exists
    let verifyQuery = supabase
      .from('conversations')
      .select('id, is_active, created_at')
      .eq('human_id', userId);

    if (conversationId) {
      verifyQuery = verifyQuery.eq('id', conversationId);
    }

    const { data: verifyData, error: verifyError } = await verifyQuery;

    if (verifyError) {
      console.error(`${logPrefix} Error verifying conversation:`, verifyError);
      return NextResponse.json({
        success: false,
        error: 'Verify query failed',
        details: verifyError.message
      }, { status: 500 });
    }

    console.log(`${logPrefix} Found ${verifyData?.length || 0} conversations matching criteria`);

    if (verifyData && verifyData.length > 0) {
      // Log all conversations found
      verifyData.forEach((conv, idx) => {
        console.log(`${logPrefix} [${idx + 1}] id=${conv.id}, active=${conv.is_active}, created=${new Date(conv.created_at).toISOString()}`);
      });

      // Only update active conversations
      const activeConvs = verifyData.filter(c => c.is_active);
      console.log(`${logPrefix} Found ${activeConvs.length} ACTIVE conversations to update`);

      if (activeConvs.length === 0) {
        return NextResponse.json({
          success: true,
          updatedCount: 0,
          message: 'No active conversations found to update'
        });
      }

      // Execute the update using the RPC endpoint from supabase-js
      const updatePromises = activeConvs.map(conv =>
        supabase
          .from('conversations')
          .update({ is_active: false })
          .eq('id', conv.id)
      );

      // Execute all updates in parallel
      const updateResults = await Promise.all(updatePromises);

      // Count successful updates
      let successCount = 0;
      const errorMessages: string[] = [];

      updateResults.forEach((result, idx) => {
        if (result.error) {
          console.error(`${logPrefix} Error updating conversation ${activeConvs[idx].id}:`, result.error);
          errorMessages.push(`Error on ${activeConvs[idx].id}: ${result.error.message}`);
        } else {
          successCount++;
          console.log(`${logPrefix} Successfully updated conversation ${activeConvs[idx].id}`);
        }
      });

      return NextResponse.json({
        success: true,
        updatedCount: successCount,
        totalFound: verifyData.length,
        activeFound: activeConvs.length,
        errors: errorMessages.length > 0 ? errorMessages : undefined
      });
    } else {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: 'No conversations found matching criteria'
      });
    }
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}