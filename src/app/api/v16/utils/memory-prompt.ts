/**
 * SINGLE SOURCE OF TRUTH: Therapeutic Continuity Guidelines
 * 
 * This constant contains the authoritative version of the therapeutic continuity guidelines
 * used throughout the V16 system. Other files should import this constant rather than
 * duplicating the text to ensure consistency.
 * 
 * Used by:
 * - This file's enhancePromptWithMemory function (primary usage)
 * - Admin UI to show users what guidelines are applied
 */
export const THERAPEUTIC_CONTINUITY_GUIDELINES = `THERAPEUTIC CONTINUITY GUIDELINES
- Recognize repeat topics/questions and acknowledge previous conversations
- Reference ongoing situations and check in on life context
- Follow up on previous suggestions and coping strategies discussed
- Build on established patterns and what works for the user
- Create session continuity - don't treat each message as isolated
- Adapt based on relationship history and communication style that works
Remember: You are an ongoing therapeutic presence, not a one-off advice giver.`;

export const enhancePromptWithMemory = (baseContent: string, aiSummary: string): string => {
  return `${baseContent}
IMPORTANT USER MEMORY CONTEXT:
The following information has been learned about this user from previous conversations. Use this context to provide more personalized and relevant support.
${aiSummary}

${THERAPEUTIC_CONTINUITY_GUIDELINES}`;
};

export const enhanceSpecialistPromptWithMemory = (baseContent: string, aiSummary: string): string => {
  return `${baseContent}

IMPORTANT USER MEMORY CONTEXT:
The following information has been learned about this user from previous conversations. Use this context to provide more personalized and relevant support, but do not explicitly mention that you "remember" things unless directly relevant to the conversation.

${aiSummary}

Please use this context to:
1. Provide more personalized responses and suggestions
2. Avoid topics or approaches that have been problematic in the past
3. Build on previous progress and insights
4. Adapt your communication style to what works best for this user
5. Be sensitive to known triggers and emotional patterns

Remember: This context should inform your responses naturally without making the user feel like they're being monitored or analyzed.`;
};