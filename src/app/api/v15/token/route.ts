import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * V15 token endpoint - primarily for session validation and debugging
 * V15 uses session-based authentication but this endpoint provides fallback support
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    // Get OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error('V15: OPENAI_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // For V15, we primarily use session-based auth, but provide basic token info
    const tokenInfo = {
      hasApiKey: !!apiKey,
      sessionId: sessionId || null,
      timestamp: new Date().toISOString(),
      version: 'v15'
    };

    return NextResponse.json(tokenInfo);
  } catch (error) {
    console.error('Error in V15 token endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process token request' },
      { status: 500 }
    );
  }
}

// TODO: improve authentication/session management capabilities if app has users
// What This Is About:

//   The token endpoint is like an "ID check" system that verifies if someone is allowed to use the app and provides
//   information about their session.

//   What It Currently Does (Minimal):

//   Very Basic Information Only:
//   - Confirms that the server has the necessary API key to work ✓
//   - Records what session ID was provided (if any) ✓
//   - Provides a timestamp of when the check happened ✓
//   - Says "this is V15" ✓

//   What's Missing (Full Session Management):

//   More Complete Token Systems Usually:
//   - Generate actual authentication tokens (this one doesn't create tokens)
//   - Validate existing tokens (this one doesn't check if tokens are valid/expired)
//   - Refresh expired tokens (this one has no refresh mechanism)
//   - Track user permissions (this one doesn't manage what users can/can't do)
//   - Handle token expiration (this one doesn't manage token lifetimes)
//   - Store session data (this one doesn't remember anything between requests)

//   Real-World Analogy:

//   Current Basic Version:
//   - Like a store greeter who just says "Yes, we're open" and writes down the time you asked

//   Full Session Management Would Be:
//   - Like a complete security system that issues ID badges, tracks who's inside, renews expired badges, and manages
//   different access levels

//   Why This Might Be Fine for Alpha:

//   - Simple is better for testing - fewer moving parts to break
//   - Users aren't reporting authentication issues - so current approach works
//   - V15 uses session-based auth primarily - this is just a fallback/info endpoint

//   When You'd Need Full Session Management:

//   - Multiple user accounts with different permissions
//   - Token expiration and renewal requirements
//   - Complex session tracking across devices
//   - Security auditing and session management

//   Bottom line: The token endpoint is very simple and just provides basic information rather than full
//   authentication/session management capabilities. For alpha testing with straightforward use cases, this may be
//   perfectly adequate.