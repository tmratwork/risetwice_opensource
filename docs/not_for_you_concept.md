Not About You
Tagline: What if there is no you?
Rewire how you relate to experiences.
Purpose
This is a 30-day AI coaching app that teaches users to create space between what happens and how they react to it.
The core skill: stop taking everything personally. Your failures, your emotions, your conflicts—when you stop centering yourself in every narrative, life gets lighter.
The method comes from a Buddhist-influenced practice called "non-self" or "no-self" reframing. Users learn to describe events, emotions, and interactions without placing "I" at the center. Instead of "I got angry because they disrespected me," users learn to say "Anger arose when certain information was received." This isn't word games—it rewires how users relate to their own experience.
Users enter for stress relief. They leave with something deeper.
How It Works
The Curriculum
30 working days (not calendar days—if user misses a day, curriculum extends)
4 weeks, progressing in difficulty:
Week 1: Actions and decisions
Week 2: Emotions
Week 3: Social interactions
Week 4: Integration and high-stakes situations
Daily Sessions
User opens the app
AI initiates conversation with that day's opening prompt
User responds via voice or text
AI critiques user's framing—directly, not gently—and demands rewrites
AI teaches the principle behind each correction
Session continues until user selects "end session"
User can revisit the same day's lesson multiple times
AI Personality
The AI is:
Direct, not subtle — explicitly teaches lessons
Critical, not gentle — points out every self-centered construction
Demanding — requires user to redo incorrect framings
Explanatory — always explains WHY the correction matters
The AI is NOT:
Encouraging or validating
Accepting of approximations
Gentle or soft
Progression
User must complete days in order (rigid curriculum)
User can skip any day/lesson if stuck
One session per day, but unlimited revisits within that day
No gamification—no streaks, points, or achievements
End State
After Day 30:
Completion state (no certificate or fanfare)
Optional: maintenance mode with random daily prompts

Technical Overview
Existing Infrastructure
Next.js chatbot UI (voice and text input)
OpenAI Realtime API integration
Supabase database
Core App Flow
User authenticates
App determines user's current day in curriculum
App loads that day's lesson data (focus, opening prompt, examples, success criteria)
App assembles system prompt from lesson data + user's history
User has conversation with AI
On session end, app stores transcript and AI assessment
App updates user progress

Work Breakdown
Claude.ai Tasks (Content Development)
The following content needs to be developed in detail before coding begins:
1. Base System Prompt
Core teaching philosophy
Correction style and tone guidelines
How to identify self-centered constructions
How to demand and evaluate rewrites
How to teach principles (not just correct words)
2. 30-Day Curriculum (Detailed)
For each of the 30 days, develop:
Day number and week
Focus area (actions / emotions / social / integration)
Specific topic (e.g., "decisions," "anger," "disagreements," "self-judgment")
Opening prompt (exact words AI uses to start session)
Lesson explanation (the principle being taught that day)
Success criteria (what does "good enough" look like for this day)
Common errors (specific mistakes users will make on this topic)
Example corrections (10-20 before/after pairs relevant to this day's topic)
3. Error Pattern Library
Comprehensive list of self-centered constructions and their corrections
Categorized by type (action, emotion, social, identity)
Includes subtle errors like:
"The body felt tired" (still implies ownership)
Using "one" instead of "I" (same illusion)
Passive voice that still centers self
4. Assessment Criteria
How AI evaluates if user successfully reframed
How AI decides when to push harder vs. accept an attempt
How AI summarizes session performance
Weekly assessment prompts (Days 7, 14, 21, 28)
5. Edge Case Handling
User gets frustrated with the practice itself
User argues with the philosophy
User gives very short responses
User wants to quit
User has breakthrough moment
6. Onboarding Content
Explanation of what the practice is
Why the AI is critical (not gentle)
What to expect over 30 days
How to approach the practice

Claude Code Tasks (Implementation)
The following features need to be built. Existing chatbot UI and Supabase tables are already in place.
1. Curriculum Data Storage
Store the 30-day curriculum in Supabase
Include all lesson components (opening prompts, examples, success criteria, etc.)
Make curriculum data accessible to the chat system
2. User Progress Tracking
Track which day each user is on
Track completed vs. skipped days
Track session history per day
Allow multiple sessions on same day without advancing curriculum
3. Dynamic System Prompt Assembly
Load base system prompt
Inject current day's lesson data (focus, examples, criteria)
Inject user's weak areas from previous sessions (if any)
Pass assembled prompt to Realtime API
4. Session Management
Detect when user starts a session
Detect when user ends a session (user-initiated)
Store session transcript or summary on end
Store AI's assessment of user performance on end
5. Day Advancement Logic
User can only advance after completing (or skipping) current day
User can revisit current day unlimited times
"Complete" = user ended at least one session on that day
Track total working days elapsed
6. AI Assessment Storage
After each session, AI generates brief assessment
Store: corrections count, error types observed, overall evaluation
Use for identifying user's weak areas over time
7. Week-End Summary Generation
On Days 7, 14, 21, 28: AI generates progress summary
Summary stored and surfaced to user
Summary informs subsequent days' system prompts
8. Onboarding Flow
New user sees onboarding content before Day 1
User confirms understanding before starting
Onboarding only shown once
9. Skip Day Functionality
User can skip current day at any time
Skipped day is marked as skipped (not completed)
Curriculum advances to next day
10. End-of-Curriculum State
Detect when user completes Day 30
Mark curriculum as complete
Determine what user sees after completion (maintenance mode, restart option, or static completion state)

Open Questions
Session transcript storage: Store full transcript or AI-generated summary? (Full transcript = more data, more storage. Summary = less detail but sufficient for progress tracking.)
Voice transcript handling: How does Realtime API transcript get captured and stored?
Weak area detection: How sophisticated should this be? Simple (count error types) or complex (ML-based pattern detection)?
Post-completion experience: What exactly happens after Day 30? Maintenance mode needs its own prompt design.

File Structure (Suggested)
/curriculum
  /base-system-prompt.md
  /week-1
    day-01.json
    day-02.json
    ...
  /week-2
  /week-3
  /week-4
  /error-patterns.json
  /onboarding.md

/supabase
  (existing tables + new curriculum/progress tables)

/app
  (existing Next.js chatbot UI)


Next Steps
Claude.ai: Develop complete Day 1-7 curriculum content as prototype
Claude Code: Set up curriculum data model and storage
Claude.ai: Refine based on what's learnable from testing Day 1-7
Claude Code: Implement progress tracking and dynamic prompt assembly
Iterate until Week 1 works end-to-end
Claude.ai: Develop Weeks 2-4 content
Claude Code: Build remaining features

