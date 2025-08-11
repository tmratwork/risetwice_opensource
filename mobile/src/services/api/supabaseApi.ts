import { supabase } from '../../config/supabase';

export interface ConversationData {
  id?: string;
  user_id: string;
  specialist_type?: string;
  messages: any[];
  created_at?: string;
  updated_at?: string;
}

export interface UserMemoryData {
  user_id: string;
  memory_content: Record<string, any>;
  last_updated: string;
}

export interface PromptData {
  id: string;
  type: string;
  content: string;
  specialist_type?: string;
  language?: string;
  is_active: boolean;
}

export class SupabaseAPI {
  // Conversation management
  static async saveConversation(conversationData: ConversationData): Promise<string> {
    const { data, error } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save conversation: ${error.message}`);
    }

    return data.id;
  }

  static async updateConversation(conversationId: string, updates: Partial<ConversationData>): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  static async getConversation(conversationId: string): Promise<ConversationData | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get conversation: ${error.message}`);
    }

    return data;
  }

  static async getUserConversations(userId: string, limit = 20): Promise<ConversationData[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get user conversations: ${error.message}`);
    }

    return data || [];
  }

  // User memory management
  static async getUserMemory(userId: string): Promise<UserMemoryData | null> {
    const { data, error } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get user memory: ${error.message}`);
    }

    return data;
  }

  static async updateUserMemory(userId: string, memoryContent: Record<string, any>): Promise<void> {
    const { error } = await supabase
      .from('user_memory')
      .upsert({
        user_id: userId,
        memory_content: memoryContent,
        last_updated: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to update user memory: ${error.message}`);
    }
  }

  // Prompt management
  static async getPrompts(type?: string, specialistType?: string, language = 'en'): Promise<PromptData[]> {
    let query = supabase
      .from('prompts')
      .select('*')
      .eq('is_active', true)
      .eq('language', language);

    if (type) {
      query = query.eq('type', type);
    }

    if (specialistType) {
      query = query.eq('specialist_type', specialistType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get prompts: ${error.message}`);
    }

    return data || [];
  }

  static async getGreetingPrompt(specialistType?: string, language = 'en'): Promise<PromptData | null> {
    const prompts = await this.getPrompts('greeting', specialistType, language);
    return prompts.length > 0 ? prompts[0] : null;
  }

  // Analytics and usage tracking
  static async logUserSession(userId: string, sessionData: Record<string, any>): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_data: sessionData,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to log user session:', error);
      // Don't throw error for analytics failures
    }
  }

  static async logFunctionExecution(
    userId: string, 
    functionName: string, 
    parameters: Record<string, any>, 
    result?: any
  ): Promise<void> {
    const { error } = await supabase
      .from('function_executions')
      .insert({
        user_id: userId,
        function_name: functionName,
        parameters,
        result,
        executed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to log function execution:', error);
      // Don't throw error for analytics failures
    }
  }

  // Real-time subscriptions
  static subscribeToUserMemoryUpdates(userId: string, callback: (data: UserMemoryData) => void) {
    return supabase
      .channel('user-memory-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_memory',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as UserMemoryData);
        }
      )
      .subscribe();
  }
}