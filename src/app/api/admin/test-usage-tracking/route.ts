/**
 * API Route: Test Usage Tracking System
 * Tests all components of the usage tracking pipeline
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const logUsageTracking = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_USAGE_TRACKING_LOGS === 'true') {
      console.log(`[usage_tracking] ${message}`, ...args);
    }
  };

  try {
    logUsageTracking('🧪 Starting usage tracking system test');

    const testResults: { step: string; status: 'success' | 'error'; details?: string }[] = [];

    // Test 1: Create a session
    logUsageTracking('Test 1: Creating test session');
    const testUserId = `test_user_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const { data: session, error: sessionError } = await supabase
      .from('usage_sessions')
      .insert({
        user_id: testUserId,
        anonymous_id: null,
        session_start: timestamp,
        user_agent: 'Test Agent',
        page_views: 0,
        metadata: { test: true }
      })
      .select('id')
      .single();

    if (sessionError) {
      testResults.push({ step: 'Create Session', status: 'error', details: sessionError.message });
      logUsageTracking('❌ Test 1 failed:', sessionError.message);
    } else {
      testResults.push({ step: 'Create Session', status: 'success' });
      logUsageTracking('✅ Test 1 passed: Session created', { sessionId: session.id });
    }

    // Test 2: Test upsert logic fix
    if (session) {
      logUsageTracking('Test 2: Testing user summary upsert');
      const summaryData = {
        user_id: testUserId,
        anonymous_id: null,
        first_visit: timestamp,
        last_visit: timestamp,
        total_sessions: 1,
        total_page_views: 0,
        total_time_spent_minutes: 0
      };

      const { error: summaryError } = await supabase
        .from('user_usage_summary')
        .upsert(summaryData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (summaryError) {
        testResults.push({ step: 'User Summary Upsert', status: 'error', details: summaryError.message });
        logUsageTracking('❌ Test 2 failed:', summaryError.message);
      } else {
        testResults.push({ step: 'User Summary Upsert', status: 'success' });
        logUsageTracking('✅ Test 2 passed: User summary upserted');
      }
    }

    // Test 3: Create an event
    if (session) {
      logUsageTracking('Test 3: Creating test event');
      const { error: eventError } = await supabase
        .from('usage_events')
        .insert({
          session_id: session.id,
          event_type: 'test_event',
          event_data: { test: true },
          page_path: '/test',
          timestamp: timestamp
        });

      if (eventError) {
        testResults.push({ step: 'Create Event', status: 'error', details: eventError.message });
        logUsageTracking('❌ Test 3 failed:', eventError.message);
      } else {
        testResults.push({ step: 'Create Event', status: 'success' });
        logUsageTracking('✅ Test 3 passed: Event created');
      }
    }

    // Test 4: End session properly
    if (session) {
      logUsageTracking('Test 4: Ending test session');
      const endTime = new Date(Date.now() + 30000).toISOString(); // 30 seconds later

      const { error: endError } = await supabase
        .from('usage_sessions')
        .update({
          session_end: endTime,
          page_views: 1
        })
        .eq('id', session.id);

      if (endError) {
        testResults.push({ step: 'End Session', status: 'error', details: endError.message });
        logUsageTracking('❌ Test 4 failed:', endError.message);
      } else {
        testResults.push({ step: 'End Session', status: 'success' });
        logUsageTracking('✅ Test 4 passed: Session ended');
      }
    }

    // Test 5: Update user summary
    if (session) {
      logUsageTracking('Test 5: Updating user summary totals');
      const { data: currentSummary, error: fetchError } = await supabase
        .from('user_usage_summary')
        .select('total_sessions, total_page_views, total_time_spent_minutes')
        .eq('user_id', testUserId)
        .single();

      if (fetchError) {
        testResults.push({ step: 'Fetch Summary', status: 'error', details: fetchError.message });
        logUsageTracking('❌ Test 5a failed:', fetchError.message);
      } else {
        const { error: updateError } = await supabase
          .from('user_usage_summary')
          .update({
            last_visit: timestamp,
            total_sessions: (currentSummary.total_sessions || 0) + 1,
            total_page_views: (currentSummary.total_page_views || 0) + 1,
            total_time_spent_minutes: (currentSummary.total_time_spent_minutes || 0) + 1
          })
          .eq('user_id', testUserId);

        if (updateError) {
          testResults.push({ step: 'Update Summary', status: 'error', details: updateError.message });
          logUsageTracking('❌ Test 5b failed:', updateError.message);
        } else {
          testResults.push({ step: 'Update Summary', status: 'success' });
          logUsageTracking('✅ Test 5 passed: User summary updated');
        }
      }
    }

    // Cleanup test data
    logUsageTracking('Cleaning up test data');
    if (session) {
      await supabase.from('usage_events').delete().eq('session_id', session.id);
      await supabase.from('usage_sessions').delete().eq('id', session.id);
      await supabase.from('user_usage_summary').delete().eq('user_id', testUserId);
      logUsageTracking('✅ Test data cleaned up');
    }

    const successCount = testResults.filter(r => r.status === 'success').length;
    const totalTests = testResults.length;

    logUsageTracking('🧪 Usage tracking test completed', {
      passed: successCount,
      failed: totalTests - successCount,
      total: totalTests
    });

    return NextResponse.json({
      success: true,
      results: testResults,
      summary: {
        passed: successCount,
        failed: totalTests - successCount,
        total: totalTests,
        allPassed: successCount === totalTests
      }
    });

  } catch (error) {
    logUsageTracking('❌ Critical error in usage tracking test', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      results: []
    }, { status: 500 });
  }
}