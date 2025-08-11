import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface SupabaseFunction {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  specialist_type?: string;
  is_active: boolean;
}

export function useSupabaseFunctions(specialistType?: string) {
  const [functions, setFunctions] = useState<SupabaseFunction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadFunctions = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('ai_functions')
        .select('*')
        .eq('is_active', true);

      if (specialistType) {
        query = query.eq('specialist_type', specialistType);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) {
        throw supabaseError;
      }

      setFunctions(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading functions:', err);
    } finally {
      setLoading(false);
    }
  };

  const executeFunction = async (functionName: string, parameters: Record<string, any>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Log function execution
      await supabase
        .from('function_executions')
        .insert({
          user_id: user.uid,
          function_name: functionName,
          parameters,
          executed_at: new Date().toISOString(),
        });

      // Execute the function based on its type
      // This would be implemented based on the specific function logic
      return { success: true, result: 'Function executed successfully' };
    } catch (error: any) {
      console.error('Error executing function:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadFunctions();
  }, [user, specialistType]);

  return {
    functions,
    loading,
    error,
    loadFunctions,
    executeFunction,
  };
}