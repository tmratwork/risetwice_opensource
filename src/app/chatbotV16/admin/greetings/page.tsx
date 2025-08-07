'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { SUPPORTED_LANGUAGES } from '@/lib/language-utils';

interface Greeting {
  id: string;
  greeting_type: string;
  language_code: string;
  greeting_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

interface GreetingType {
  type: string;
  description: string;
}

const GREETING_TYPES: GreetingType[] = [
  { type: 'resources', description: 'Resource Locator Greeting' },
  { type: 'triage', description: 'Triage AI Initial Greeting' },
  { type: 'crisis', description: 'Crisis Support Greeting' },
  { type: 'general', description: 'General Support Greeting' }
];

export default function GreetingsAdmin() {
  const { user } = useAuth();
  const [greetings, setGreetings] = useState<Greeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('triage');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [editingGreeting, setEditingGreeting] = useState<Greeting | null>(null);
  const [newGreetingContent, setNewGreetingContent] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationResults, setTranslationResults] = useState<{
    summary?: {
      greeting_type: string;
      source_language: string;
      total_languages: number;
      successful_translations: number;
      failed_translations: number;
      success_rate: number;
    };
    results?: Array<{
      language_code: string;
      language_name: string;
      success: boolean;
      translation_preview?: string;
      error?: string;
    }>;
  } | null>(null);
  const [showTranslationModal, setShowTranslationModal] = useState(false);

  // Check if user has admin access (implement your admin check logic)
  const isAdmin = user?.uid === "NbewAuSvZNgrb64yNDkUebjMHa23"; // Adjust based on your admin logic

  useEffect(() => {
    if (!isAdmin) {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }
    
    loadGreetings();
  }, [isAdmin]);

  const loadGreetings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v16/admin/greetings');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setGreetings(data.greetings || []);
    } catch (err) {
      console.error('Error loading greetings:', err);
      setError(`Failed to load greetings: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentGreeting = (): Greeting | undefined => {
    return greetings.find(g => 
      g.greeting_type === selectedType && 
      g.language_code === selectedLanguage &&
      g.is_active
    );
  };

  const handleEdit = (greeting: Greeting) => {
    setEditingGreeting(greeting);
    setNewGreetingContent(greeting.greeting_content);
    setIsCreatingNew(false);
  };

  const handleCreate = () => {
    setEditingGreeting(null);
    setNewGreetingContent('');
    setIsCreatingNew(true);
  };

  const handleSave = async () => {
    if (!newGreetingContent.trim()) {
      setError('Greeting content cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const url = editingGreeting 
        ? `/api/v16/admin/greetings/${editingGreeting.id}`
        : '/api/v16/admin/greetings';
      
      const method = editingGreeting ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          greeting_type: selectedType,
          language_code: selectedLanguage,
          greeting_content: newGreetingContent.trim(),
          is_active: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Reload greetings and reset form
      await loadGreetings();
      setEditingGreeting(null);
      setNewGreetingContent('');
      setIsCreatingNew(false);
      
    } catch (err) {
      console.error('Error saving greeting:', err);
      setError(`Failed to save greeting: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (greeting: Greeting) => {
    if (!confirm(`Are you sure you want to delete this greeting for ${greeting.greeting_type} in ${greeting.language_code}?`)) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/v16/admin/greetings/${greeting.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      await loadGreetings();
    } catch (err) {
      console.error('Error deleting greeting:', err);
      setError(`Failed to delete greeting: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoTranslate = async () => {
    // Check if English greeting exists
    const englishGreeting = greetings.find(g => 
      g.greeting_type === selectedType && 
      g.language_code === 'en' &&
      g.is_active
    );

    if (!englishGreeting) {
      setError(`No English greeting found for type '${selectedType}'. Please create an English greeting first to use as the translation source.`);
      return;
    }

    // Estimate cost (rough estimate: ~$0.001 per language * 56 languages = ~$0.056)
    const estimatedCost = (56 * 0.001).toFixed(3);
    
    if (!confirm(`This will translate the English greeting for &apos;${selectedType}&apos; into 56 other languages using GPT-4o.\n\nEstimated cost: ~$${estimatedCost}\n\nExisting translations will be preserved unless you enable overwrite.\n\nContinue?`)) {
      return;
    }

    const overwriteExisting = confirm('Do you want to overwrite existing translations? Click OK to overwrite, Cancel to skip existing translations.');

    try {
      setTranslating(true);
      setTranslationResults(null);
      setShowTranslationModal(true);
      setError(null);

      const response = await fetch('/api/v16/admin/greetings/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          greeting_type: selectedType,
          source_language: 'en',
          overwrite_existing: overwriteExisting
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      setTranslationResults(data);
      
      // Reload greetings to show new translations
      await loadGreetings();
      
    } catch (err) {
      console.error('Error during auto-translation:', err);
      setError(`Auto-translation failed: ${(err as Error).message}`);
    } finally {
      setTranslating(false);
    }
  };

  const closeTranslationModal = () => {
    setShowTranslationModal(false);
    setTranslationResults(null);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-sage-200 dark:bg-[#131314] flex items-center justify-center">
        <div className="text-center text-sage-500 dark:text-gray-200">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Admin privileges required to access greeting management.</p>
        </div>
      </div>
    );
  }

  const currentGreeting = getCurrentGreeting();
  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);

  return (
    <div className="min-h-screen bg-sage-200 dark:bg-[#131314] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-sage-100 dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-sage-500 dark:text-gray-200">
              Greeting Management
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handleAutoTranslate}
                disabled={translating || loading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {translating ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Translating...
                  </>
                ) : (
                  <>
                    🌐 Auto-Translate from English
                  </>
                )}
              </button>
              <button
                onClick={() => window.location.href = '/chatbotV16/admin'}
                className="px-4 py-2 bg-sage-300 dark:bg-gray-700 text-sage-500 dark:text-gray-200 rounded hover:bg-sage-400 dark:hover:bg-gray-600"
              >
                ← Back to Admin
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
              <p className="text-red-800 dark:text-red-300 font-medium">Error:</p>
              <p className="text-red-700 dark:text-red-400 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Selection Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-sage-500 dark:text-gray-200 mb-2">
                Greeting Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2 border border-sage-400 dark:border-gray-600 rounded bg-sage-50 dark:bg-gray-700 text-sage-500 dark:text-gray-200"
              >
                {GREETING_TYPES.map((type) => (
                  <option key={type.type} value={type.type}>
                    {type.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-sage-500 dark:text-gray-200 mb-2">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full p-2 border border-sage-400 dark:border-gray-600 rounded bg-sage-50 dark:bg-gray-700 text-sage-500 dark:text-gray-200"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Greeting Display */}
          <div className="mb-6">
            <h2 className="text-lg font-medium text-sage-500 dark:text-gray-200 mb-3">
              Current Greeting: {selectedType} - {currentLanguage?.nativeName}
            </h2>
            
            {loading ? (
              <div className="p-4 bg-sage-50 dark:bg-gray-700 rounded border">
                <p className="text-sage-400 dark:text-gray-400">Loading...</p>
              </div>
            ) : currentGreeting ? (
              <div className="p-4 bg-sage-50 dark:bg-gray-700 rounded border">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-sage-400 dark:text-gray-400">
                    ID: {currentGreeting.id} | Created: {new Date(currentGreeting.created_at).toLocaleString()}
                    {currentGreeting.updated_at !== currentGreeting.created_at && (
                      <> | Updated: {new Date(currentGreeting.updated_at).toLocaleString()}</>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(currentGreeting)}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(currentGreeting)}
                      className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-sage-500 dark:text-gray-200 whitespace-pre-wrap">
                  {currentGreeting.greeting_content}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded">
                <p className="text-yellow-800 dark:text-yellow-300">
                  No greeting found for {selectedType} in {currentLanguage?.nativeName}.
                </p>
                <button
                  onClick={handleCreate}
                  className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Create New Greeting
                </button>
              </div>
            )}
          </div>

          {/* Edit/Create Form */}
          {(editingGreeting !== null || isCreatingNew) && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded">
              <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-3">
                {editingGreeting ? 'Edit Greeting' : 'Create New Greeting'}
              </h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Greeting Content ({selectedType} - {currentLanguage?.nativeName})
                </label>
                <textarea
                  value={newGreetingContent}
                  onChange={(e) => setNewGreetingContent(e.target.value)}
                  className="w-full h-32 p-3 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-sage-500 dark:text-gray-200"
                  placeholder="Enter the greeting content that users will see when starting a conversation..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !newGreetingContent.trim()}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : (editingGreeting ? 'Update' : 'Create')}
                </button>
                <button
                  onClick={() => {
                    setEditingGreeting(null);
                    setNewGreetingContent('');
                    setIsCreatingNew(false);
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="mt-6 p-4 bg-sage-50 dark:bg-gray-700 rounded">
            <h3 className="text-sm font-medium text-sage-500 dark:text-gray-200 mb-2">
              Statistics
            </h3>
            <div className="text-xs text-sage-400 dark:text-gray-400">
              Total greetings: {greetings.length} | 
              Languages available: {new Set(greetings.map(g => g.language_code)).size} |
              Types available: {new Set(greetings.map(g => g.greeting_type)).size}
            </div>
          </div>
        </div>
      </div>

      {/* Translation Progress Modal */}
      {showTranslationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Auto-Translation Progress
                </h2>
                {!translating && (
                  <button
                    onClick={closeTranslationModal}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {translating && (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Translating greeting for &apos;{selectedType}&apos; into 56 languages...
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    This process takes about 1-2 minutes due to rate limiting
                  </p>
                </div>
              )}

              {translationResults && (
                <div>
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded">
                    <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">
                      Translation Complete!
                    </h3>
                    <div className="text-sm text-green-700 dark:text-green-400">
                      <p>Greeting Type: <strong>{translationResults.summary?.greeting_type}</strong></p>
                      <p>Source Language: <strong>{translationResults.summary?.source_language}</strong></p>
                      <p>Total Languages: <strong>{translationResults.summary?.total_languages}</strong></p>
                      <p>Successful: <strong>{translationResults.summary?.successful_translations}</strong></p>
                      <p>Failed: <strong>{translationResults.summary?.failed_translations}</strong></p>
                      <p>Success Rate: <strong>{translationResults.summary?.success_rate}%</strong></p>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                      Translation Results:
                    </h4>
                    
                    {translationResults.results?.map((result, index: number) => (
                      <div 
                        key={index}
                        className={`p-3 rounded border text-sm ${
                          result.success 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {result.language_name} ({result.language_code})
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            result.success 
                              ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200' 
                              : 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'
                          }`}>
                            {result.success ? '✓ Success' : '✗ Failed'}
                          </span>
                        </div>
                        
                        {result.success && result.translation_preview && (
                          <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs">
                            {result.translation_preview}
                          </p>
                        )}
                        
                        {!result.success && result.error && (
                          <p className="text-red-600 dark:text-red-400 mt-1 text-xs">
                            Error: {result.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-center">
                    <button
                      onClick={closeTranslationModal}
                      className="px-6 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}