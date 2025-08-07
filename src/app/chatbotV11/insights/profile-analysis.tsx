"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface PromptData {
  id: string;
  title: string;
  prompt: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export default function ProfileAnalysisTab() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'system' | 'user'>('system');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemPrompts, setSystemPrompts] = useState<PromptData[]>([]);
  const [userPrompts, setUserPrompts] = useState<PromptData[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptData | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    prompt: '',
    category: 'profile_analysis'
  });

  // Fetch prompts on component mount
  useEffect(() => {
    if (!user) return;
    
    const fetchPrompts = async () => {
      try {
        setLoading(true);
        
        // Get the current user's ID token for authentication
        let idToken = '';
        try {
          idToken = await user?.getIdToken() || '';
        } catch (tokenErr) {
          console.error('Error getting user ID token:', tokenErr);
        }
        
        const response = await fetch('/api/v11/prompts?category=profile_analysis', {
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Filter prompts into system and user categories
          const system = data.prompts.filter((p: PromptData) => p.category === 'profile_analysis_system');
          const user = data.prompts.filter((p: PromptData) => p.category === 'profile_analysis_user');
          
          setSystemPrompts(system);
          setUserPrompts(user);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch prompts');
        }
      } catch (err) {
        console.error('Error fetching prompts:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrompts();
  }, [user]);
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Select a prompt to edit
  const handleSelectPrompt = (prompt: PromptData) => {
    setSelectedPrompt(prompt);
    setFormData({
      title: prompt.title,
      prompt: prompt.prompt,
      category: activeTab === 'system' ? 'profile_analysis_system' : 'profile_analysis_user'
    });
  };
  
  // Reset the form
  const handleReset = () => {
    setSelectedPrompt(null);
    setFormData({
      title: '',
      prompt: '',
      category: activeTab === 'system' ? 'profile_analysis_system' : 'profile_analysis_user'
    });
  };
  
  // Handle form submission (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get the current user's ID token for authentication
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token for prompt submission:', tokenErr);
      }
      
      const isUpdate = !!selectedPrompt;
      const endpoint = isUpdate 
        ? `/api/v11/prompts?id=${selectedPrompt?.id}`
        : '/api/v11/prompts';
      
      const method = isUpdate ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          ...formData,
          category: activeTab === 'system' ? 'profile_analysis_system' : 'profile_analysis_user'
        })
      });
      
      if (response.ok) {
        // Success - refresh the prompts list
        const data = await response.json();
        console.log(isUpdate ? 'Prompt updated:' : 'Prompt created:', data);
        
        // Refresh the prompts list
        const updatedResponse = await fetch('/api/v11/prompts?category=profile_analysis', {
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          }
        });
        
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json();
          const system = updatedData.prompts.filter((p: PromptData) => p.category === 'profile_analysis_system');
          const user = updatedData.prompts.filter((p: PromptData) => p.category === 'profile_analysis_user');
          
          setSystemPrompts(system);
          setUserPrompts(user);
        }
        
        // Reset the form
        handleReset();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save prompt');
      }
    } catch (err) {
      console.error('Error saving prompt:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  
  // Delete a prompt
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    
    try {
      // Get the current user's ID token for authentication
      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token for deletion:', tokenErr);
      }
      
      const response = await fetch(`/api/v11/prompts?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });
      
      if (response.ok) {
        // Remove the deleted prompt from the appropriate list
        if (activeTab === 'system') {
          setSystemPrompts(systemPrompts.filter(p => p.id !== id));
        } else {
          setUserPrompts(userPrompts.filter(p => p.id !== id));
        }
        
        // If the deleted prompt was being edited, reset the form
        if (selectedPrompt?.id === id) {
          handleReset();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete prompt');
      }
    } catch (err) {
      console.error('Error deleting prompt:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Render the prompt list for the active tab
  const renderPromptList = () => {
    const prompts = activeTab === 'system' ? systemPrompts : userPrompts;
    
    if (prompts.length === 0) {
      return (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded text-center">
          <p className="text-gray-500 dark:text-gray-400">No prompts found. Create your first one!</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-3">
        {prompts.map(prompt => (
          <div 
            key={prompt.id}
            className={`p-3 rounded-md border cursor-pointer ${
              selectedPrompt?.id === prompt.id 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => handleSelectPrompt(prompt)}
          >
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-gray-800 dark:text-gray-200">{prompt.title}</h3>
              <button 
                className="text-red-500 hover:text-red-700 text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(prompt.id);
                }}
              >
                Delete
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {prompt.prompt.length > 60 ? prompt.prompt.substring(0, 60) + '...' : prompt.prompt}
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Last updated: {new Date(prompt.updated_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg">
        <p className="text-red-700 dark:text-red-300">
          Authentication required. Please sign in to access this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading prompts...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          className={`py-2 px-4 font-medium border-b-2 ${
            activeTab === 'system'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => {
            setActiveTab('system');
            handleReset();
          }}
        >
          System Prompts
        </button>
        <button
          className={`py-2 px-4 font-medium border-b-2 ${
            activeTab === 'user'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => {
            setActiveTab('user');
            handleReset();
          }}
        >
          User Prompts
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prompt List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {activeTab === 'system' ? 'System Prompts' : 'User Prompts'}
          </h2>
          {renderPromptList()}
        </div>
        
        {/* Prompt Editor */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {selectedPrompt ? 'Edit Prompt' : 'Create New Prompt'}
          </h2>
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter prompt title"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                Prompt Content
              </label>
              <textarea
                name="prompt"
                value={formData.prompt}
                onChange={handleInputChange}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter prompt content"
                required
              ></textarea>
            </div>
            
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                {selectedPrompt ? 'Update Prompt' : 'Create Prompt'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}