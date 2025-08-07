'use client';

import { useState, useEffect } from 'react';
import { CreatePostFormProps, CreatePostRequest, PostType, Circle } from '../types/community';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { useAuth } from '../../../../contexts/auth-context';
import CircleSelector from './CircleSelector';

export function CreatePostForm({ 
  onSubmit, 
  loading = false, 
  defaultCircleId,
  availableCircles = []
}: CreatePostFormProps) {
  // Logging helper following project standards
  const logCircleSelector = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_SELECTOR_LOGS === 'true') {
      console.log(`[circle_selector] ${message}`, ...args);
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CreatePostRequest>({
    title: '',
    content: '',
    post_type: 'audio',
    tags: [],
    circle_id: defaultCircleId
  });

  // Debug: Log the props received
  logCircleSelector('CreatePostForm initialized with props:', {
    defaultCircleId,
    availableCirclesCount: availableCircles.length,
    availableCircles: availableCircles.map((c: Circle) => ({ id: c.id, name: c.name, display_name: c.display_name }))
  });

  // Debug: Log the defaultCircleId received
  console.log('[FORM_DEBUG] CreatePostForm received defaultCircleId:', defaultCircleId);
  console.log('[FORM_DEBUG] Initial formData.circle_id:', formData.circle_id);

  // Fix: Update formData when defaultCircleId changes (React state initialization issue)
  useEffect(() => {
    if (defaultCircleId && formData.circle_id !== defaultCircleId) {
      console.log('[FORM_DEBUG] Updating formData.circle_id from', formData.circle_id, 'to', defaultCircleId);
      setFormData(prev => ({ ...prev, circle_id: defaultCircleId }));
    }
  }, [defaultCircleId, formData.circle_id]);
  const [tagInput, setTagInput] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  const { user } = useAuth();
  
  // Debug: Check if user is available
  console.log('User from auth:', user);
  const audioRecording = useAudioRecording();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for pending tag text and warn user
    const pendingTag = tagInput.trim();
    if (pendingTag) {
      const confirmed = confirm(
        `You have pending tag text: "${pendingTag}"\n\n` +
        'To add this as a tag, press Enter, comma, or space bar after typing.\n' +
        'Or delete the text from the tag field.\n\n' +
        'Do you want to proceed without adding this tag?'
      );
      if (!confirmed) {
        return; // Don't submit, let user fix the tag
      }
    }
    
    // Create final form data with any pending tag input (only if user confirmed)
    const finalTags = [...formData.tags];
    const processedPendingTag = pendingTag.toLowerCase();
    if (processedPendingTag && !finalTags.includes(processedPendingTag) && finalTags.length < 5) {
      finalTags.push(processedPendingTag);
    }
    
    let finalFormData = {
      ...formData,
      tags: finalTags
    };
    
    // Handle audio post submission
    if (formData.post_type === 'audio') {
      if (!audioRecording.audioBlob) {
        setAudioError('Please record an audio message first');
        return;
      }
      
      const userId = user?.uid || 'test-user-id';
      if (!userId) {
        setAudioError('You must be logged in to post audio');
        return;
      }
      
      try {
        setUploadingAudio(true);
        setAudioError(null);
        
        // Upload audio file
        const uploadFormData = new FormData();
        uploadFormData.append('audio', audioRecording.audioBlob);
        uploadFormData.append('userId', userId);
        
        console.log('Uploading audio:', {
          blobExists: !!audioRecording.audioBlob,
          blobSize: audioRecording.audioBlob?.size,
          blobType: audioRecording.audioBlob?.type,
          userId: userId
        });
        
        const uploadResponse = await fetch('/api/v16/community/audio/upload', {
          method: 'POST',
          body: uploadFormData
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          console.error('Upload error:', errorData);
          throw new Error(errorData.error || 'Failed to upload audio');
        }
        
        const uploadResult = await uploadResponse.json();
        
        // Add audio data to form
        finalFormData = {
          ...finalFormData,
          audio_url: uploadResult.audio_url,
          audio_duration: uploadResult.audio_duration,
          content: finalFormData.content || 'Audio post' // Fallback content
        };
        
      } catch (error) {
        console.error('Error uploading audio:', error);
        setAudioError('Failed to upload audio. Please try again.');
        setUploadingAudio(false);
        return;
      } finally {
        setUploadingAudio(false);
      }
    }
    
    const isValid = finalFormData.title.trim() && 
      (finalFormData.post_type === 'audio' || finalFormData.content.trim());
    
    // Debug logging to understand what's in formData
    console.log('CreatePostForm handleSubmit - pendingTag:', processedPendingTag);
    console.log('CreatePostForm handleSubmit - finalTags:', finalTags);
    console.log('CreatePostForm handleSubmit - finalFormData:', JSON.stringify(finalFormData, null, 2));
    
    if (isValid) {
      onSubmit(finalFormData);
      setFormData({
        title: '',
        content: '',
        post_type: 'audio',
        tags: [],
        circle_id: defaultCircleId
      });
      setTagInput('');
      setAudioError(null);
      audioRecording.resetRecording();
      setIsOpen(false);
    }
  };

  const addTagFromInput = () => {
    const tag = tagInput.trim().toLowerCase();
    
    // Debug logging for tag adding
    console.log('addTagFromInput - tagInput:', tagInput);
    console.log('addTagFromInput - processed tag:', tag);
    console.log('addTagFromInput - current formData.tags:', formData.tags);
    console.log('addTagFromInput - tag already exists:', formData.tags.includes(tag));
    console.log('addTagFromInput - tags length:', formData.tags.length);
    
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
      const newTags = [...formData.tags, tag];
      console.log('addTagFromInput - adding tag, newTags will be:', newTags);
      
      setFormData(prev => ({
        ...prev,
        tags: newTags
      }));
      setTagInput('');
      return true;
    } else {
      console.log('addTagFromInput - tag not added, conditions not met');
      return false;
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTagFromInput();
    }
  };

  const handleTagInputBlur = () => {
    // Add tag when user clicks out of the input field
    addTagFromInput();
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handlePostTypeChange = (type: PostType) => {
    setFormData(prev => ({
      ...prev,
      post_type: type
    }));
  };

  const toggleRecording = async () => {
    try {
      setAudioError(null);
      
      if (audioRecording.isRecording) {
        audioRecording.stopRecording();
      } else {
        await audioRecording.startRecording();
      }
    } catch (error) {
      console.error('Recording error:', error);
      setAudioError(error instanceof Error ? error.message : 'Failed to access microphone');
    }
  };

  // Reset audio when changing post type
  useEffect(() => {
    if (formData.post_type !== 'audio') {
      audioRecording.resetRecording();
      setAudioError(null);
    }
  }, [formData.post_type]);

  if (!isOpen) {
    return (
      <div className="mb-6">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full bg-[var(--warning-background)] border border-[var(--border-color)] rounded-lg p-4 text-left hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center space-x-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
              <path d="M3 6C3 4.34315 4.34315 3 6 3H14C15.6569 3 17 4.34315 17 6V10C17 11.6569 15.6569 13 14 13H8.41421C8.149 13 7.89464 13.1054 7.70711 13.2929L5.29289 15.7071C4.90237 16.0976 4.26777 15.8253 4.26777 15.2929V13.5C3.56731 13.1872 3 12.4602 3 11.6V6Z" fill="#7FB069" stroke="#6B9B5C" strokeWidth="1"/>
              <path d="M10 8.5C10 7.67157 9.32843 7 8.5 7C7.67157 7 7 7.67157 7 8.5C7 9.32843 7.67157 10 8.5 10C9.32843 10 10 9.32843 10 8.5Z" fill="#5A8A4A"/>
              <path d="M13 8.5C13 7.67157 12.3284 7 11.5 7C10.6716 7 10 7.67157 10 8.5C10 9.32843 10.6716 10 11.5 10C12.3284 10 13 9.32843 13 8.5Z" fill="#5A8A4A"/>
              <path d="M10 9.5C10.5523 9.5 11 9.94772 11 10.5C11 11.0523 10.5523 11.5 10 11.5C9.44772 11.5 9 11.0523 9 10.5C9 9.94772 9.44772 9.5 10 9.5Z" fill="#5A8A4A"/>
              <circle cx="15.5" cy="4.5" r="1" fill="#7FB069"/>
              <circle cx="17.5" cy="5.5" r="0.8" fill="#9BC085"/>
              <circle cx="16.5" cy="6.5" r="0.6" fill="#B5D39D"/>
            </svg>
            <span className="text-white font-medium">Share your thoughts with the community...</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--text-primary)]">Create a Post</h3>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Post Type Selector */}
        <div className="flex space-x-1 mb-4 bg-[var(--bg-primary)] rounded-lg p-1">
          {[
            { type: 'text' as PostType, label: 'Text', icon: '📝' },
            { type: 'audio' as PostType, label: 'Audio', icon: '🎙️' }
          ].map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => handlePostTypeChange(option.type)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${formData.post_type === option.type
                  ? 'bg-blue-600 text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]'
                }`}
            >
              <span className="mr-2">{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Give your post a title..."
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--button-primary)] transition-colors"
            maxLength={200}
            required
          />
          <div className="text-xs text-gray-500 mt-1 text-right">
            {formData.title.length}/200
          </div>
        </div>

        {/* Circle Selection */}
        {(() => {
          const shouldShowSelector = availableCircles.length > 0;
          logCircleSelector('Circle selector rendering logic:', {
            availableCirclesLength: availableCircles.length,
            shouldShowSelector,
            formDataCircleId: formData.circle_id
          });
          
          return shouldShowSelector ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Post to Circle
              </label>
              {(() => {
                const memberships = availableCircles.map(circle => ({
                  id: `membership-${circle.id}`,
                  circle_id: circle.id,
                  user_id: 'current-user',
                  role: 'member' as const,
                  joined_at: new Date().toISOString()
                }));
                logCircleSelector('Creating CircleSelector with memberships:', { memberships, userCircles: availableCircles });
                return (
                  <CircleSelector
                    selectedCircleId={formData.circle_id}
                    onCircleChange={(circleId) => {
                      logCircleSelector('CircleSelector onCircleChange called:', { circleId });
                      setFormData(prev => ({ ...prev, circle_id: circleId || undefined }));
                    }}
                    userCircles={availableCircles}
                    userMemberships={memberships}
                    className="w-full"
                  />
                );
              })()}
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Choose which circle to post in, or leave as General Feed
              </p>
            </div>
          ) : null;
        })()}

        {/* Content Input */}
        <div className="mb-4">
          {formData.post_type === 'audio' ? (
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-4">
              {/* Audio Recording Interface */}
              <div className="flex items-center justify-center space-x-4">
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={uploadingAudio}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${audioRecording.isRecording
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#9dbbac] hover:bg-[#3b503c]'
                    }`}
                >
                  {audioRecording.isRecording ? (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v1a7 7 0 0 1-14 0v-1a1 1 0 0 1 2 0v1a5 5 0 0 0 10 0v-1a1 1 0 0 1 2 0Z" />
                      <path d="M12 18a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1Z" />
                    </svg>
                  )}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={uploadingAudio}
                    className="text-gray-800 font-medium hover:text-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {audioRecording.isRecording ? 'Recording...' : 
                     audioRecording.audioBlob ? 'Recording Complete' : 'Click to Record'}
                  </button>
                  <div className="text-gray-600 text-sm">
                    {audioRecording.isRecording ? 
                      `${Math.floor(audioRecording.duration / 60)}:${(audioRecording.duration % 60).toString().padStart(2, '0')}` : 
                      'Max 5 minutes'}
                  </div>
                </div>
              </div>

              {/* Recording Progress Bar */}
              {audioRecording.isRecording && (
                <div className="mt-4">
                  <div className="w-full bg-[#e7ece9] rounded-full h-2">
                    <div 
                      className="bg-[#9dbbac] h-2 rounded-full animate-pulse transition-all duration-1000" 
                      style={{ width: `${Math.min((audioRecording.duration / 300) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Playback Controls */}
              {audioRecording.audioBlob && !audioRecording.isRecording && (
                <div className="mt-4 p-3 bg-[#e7ece9] rounded-lg">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={audioRecording.isPlaying ? audioRecording.pauseRecording : audioRecording.playRecording}
                      className="w-10 h-10 bg-[#9dbbac] hover:bg-[#3b503c] rounded-full flex items-center justify-center transition-colors"
                    >
                      {audioRecording.isPlaying ? (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="w-full bg-[#fdfefd] rounded-full h-2">
                        <div 
                          className="bg-[#9dbbac] h-2 rounded-full transition-all duration-100" 
                          style={{ width: `${audioRecording.duration > 0 ? (audioRecording.currentTime / audioRecording.duration) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-[#3b503c] mt-1">
                        <span>
                          {Math.floor(audioRecording.currentTime / 60)}:
                          {(Math.floor(audioRecording.currentTime) % 60).toString().padStart(2, '0')}
                        </span>
                        <span>
                          {Math.floor(audioRecording.duration / 60)}:
                          {(audioRecording.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={audioRecording.resetRecording}
                      className="text-red-400 hover:text-red-300 p-1 transition-colors"
                      title="Delete recording"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {audioError && (
                <div className="mt-3 p-2 bg-red-900/50 border border-red-500/50 rounded text-red-300 text-sm">
                  {audioError}
                </div>
              )}
            </div>
          ) : (
            <textarea
              placeholder="Share your thoughts, experiences, or ask a question..."
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--button-primary)] transition-colors resize-none"
              rows={4}
              maxLength={2000}
              required
            />
          )}
          {formData.post_type !== 'audio' && (
            <div className="text-xs text-gray-500 mt-1 text-right">
              {formData.content.length}/2000
            </div>
          )}
        </div>


        {/* Tags Input */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Add tags (press Enter, comma, space, or click away to add)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            onBlur={handleTagInputBlur}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--button-primary)] transition-colors"
            disabled={formData.tags.length >= 5}
          />

          {/* Tag Display */}
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-[#c1d7ca] text-[#3b503c] text-sm px-3 py-1 rounded-full flex items-center space-x-1"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-[#3b503c] hover:text-[#9dbbac] transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-1">
            {formData.tags.length}/5 tags
            {tagInput.trim() && (
              <span className="ml-2 text-[#9dbbac]">
                (Press Enter or click away to add &quot;{tagInput.trim().toLowerCase()}&quot;)
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || uploadingAudio || !formData.title.trim() || (formData.post_type !== 'audio' && !formData.content.trim()) || (formData.post_type === 'audio' && !audioRecording.audioBlob)}
            className="bg-[#3b503c] hover:bg-[#2a3a2b] text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {(loading || uploadingAudio) && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>
              {uploadingAudio ? 'Uploading...' : loading ? 'Posting...' : 'Post'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}