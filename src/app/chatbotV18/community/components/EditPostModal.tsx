'use client';

import { useState, useEffect } from 'react';
import { CommunityPost } from '../types/community';

interface EditPostModalProps {
  isOpen: boolean;
  post: CommunityPost | null;
  onClose: () => void;
  onSave: (postId: string, title: string, content: string, tags: string[]) => void;
  loading?: boolean;
}

export function EditPostModal({ isOpen, post, onClose, onSave, loading = false }: EditPostModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: [] as string[]
  });
  const [tagInput, setTagInput] = useState('');

  // Update form data when post changes
  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        content: post.content,
        tags: [...post.tags]
      });
    }
  }, [post]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    
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
    
    const isValid = formData.title.trim() && formData.content.trim();
    
    if (isValid) {
      onSave(post.id, formData.title.trim(), formData.content.trim(), formData.tags);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tag]
        }));
        setTagInput('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleClose = () => {
    setTagInput('');
    onClose();
  };

  if (!isOpen || !post) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1a1a1b] border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Edit Post</h3>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Post Type Display (read-only) */}
          <div className="mb-4">
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>Post Type:</span>
              <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded-full capitalize">
                {post.post_type === 'text' && '📝 Text'}
                {post.post_type === 'audio' && '🎙️ Audio'}
                {post.post_type === 'question' && '❓ Question'}
              </span>
            </div>
          </div>

          {/* Title Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Title
            </label>
            <input
              type="text"
              placeholder="Give your post a title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-[#0f0f10] border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              maxLength={200}
              required
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {formData.title.length}/200
            </div>
          </div>

          {/* Content Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Content
            </label>
            {post.post_type === 'audio' ? (
              <div className="bg-[#0f0f10] border border-gray-600 rounded-lg p-4">
                <div className="text-gray-400 text-sm text-center">
                  Audio content cannot be edited. Only title and tags can be modified.
                </div>
                {post.audio_url && (
                  <div className="mt-3 flex items-center justify-center">
                    <div className="text-blue-400 text-sm">Original audio duration: {post.audio_duration ? `${Math.floor(post.audio_duration / 60)}:${(post.audio_duration % 60).toString().padStart(2, '0')}` : 'Unknown'}</div>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                placeholder="Share your thoughts, experiences, or ask a question..."
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="w-full bg-[#0f0f10] border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                rows={6}
                maxLength={2000}
                required
              />
            )}
            {post.post_type !== 'audio' && (
              <div className="text-xs text-gray-500 mt-1 text-right">
                {formData.content.length}/2000
              </div>
            )}
          </div>

          {/* Tags Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <input
              type="text"
              placeholder="Add tags (press Enter, comma, or space to add)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full bg-[#0f0f10] border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              disabled={formData.tags.length >= 5}
            />

            {/* Tag Display */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-blue-900/50 text-blue-300 text-sm px-3 py-1 rounded-full flex items-center space-x-1"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-400 hover:text-blue-200 transition-colors"
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
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !formData.title.trim() || (post.post_type !== 'audio' && !formData.content.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}