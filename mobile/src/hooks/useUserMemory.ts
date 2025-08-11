import { useState, useEffect } from 'react';
import { SupabaseAPI, UserMemoryData } from '../services/api/supabaseApi';
import { useAuth } from '../contexts/AuthContext';

export function useUserMemory() {
  const [memory, setMemory] = useState<UserMemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadUserMemory = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const memoryData = await SupabaseAPI.getUserMemory(user.uid);
      setMemory(memoryData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading user memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateMemory = async (newMemoryContent: Record<string, any>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await SupabaseAPI.updateUserMemory(user.uid, newMemoryContent);
      
      // Update local state
      setMemory({
        user_id: user.uid,
        memory_content: newMemoryContent,
        last_updated: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message);
      console.error('Error updating user memory:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addToMemory = async (key: string, value: any) => {
    const currentMemory = memory?.memory_content || {};
    const updatedMemory = {
      ...currentMemory,
      [key]: value,
    };

    await updateMemory(updatedMemory);
  };

  const removeFromMemory = async (key: string) => {
    if (!memory?.memory_content) return;

    const updatedMemory = { ...memory.memory_content };
    delete updatedMemory[key];

    await updateMemory(updatedMemory);
  };

  const getMemoryValue = (key: string, defaultValue: any = null) => {
    return memory?.memory_content?.[key] || defaultValue;
  };

  // Load memory when user changes
  useEffect(() => {
    loadUserMemory();
  }, [user]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    const subscription = SupabaseAPI.subscribeToUserMemoryUpdates(
      user.uid,
      (updatedMemory) => {
        setMemory(updatedMemory);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return {
    memory,
    loading,
    error,
    loadUserMemory,
    updateMemory,
    addToMemory,
    removeFromMemory,
    getMemoryValue,
  };
}