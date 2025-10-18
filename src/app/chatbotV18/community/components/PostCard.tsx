'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PostCardProps, VoteType, PostComment, ReactionType } from '../types/community';
import { ReactionButtons } from './ReactionButtons';
import { NameSelectionModal } from '../../components/NameSelectionModal';

interface ActionIconsOverflowProps {
  children: React.ReactNode;
  maxVisible?: number;
}

function ActionIconsOverflow({ children, maxVisible = 4 }: ActionIconsOverflowProps) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const childrenArray = React.Children.toArray(children);
  const visibleChildren = childrenArray.slice(0, maxVisible);
  const overflowChildren = childrenArray.slice(maxVisible);
  
  if (overflowChildren.length === 0) {
    return <div className="flex items-center space-x-6">{children}</div>;
  }
  
  return (
    <div className="flex items-center space-x-6">
      {visibleChildren}
      
      {/* Three-dot overflow menu */}
      <div className="relative">
        <button
          onClick={() => setIsOverflowOpen(!isOverflowOpen)}
          className="flex items-center justify-center w-8 h-8 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="More actions"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
        
        {isOverflowOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOverflowOpen(false)}
            />
            
            {/* Overflow menu */}
            <div className="absolute right-0 bottom-full mb-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg z-20 min-w-[120px]">
              <div className="py-2 flex flex-col">
                {overflowChildren.map((child, index) => (
                  <div key={index} className="px-4 py-3 hover:bg-[var(--bg-primary)] transition-colors">
                    {child}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PostCard({ 
  post, 
  currentUserId, 
  showCircle = false,
  onVote, 
  onReport, 
  onShare,
  onEdit,
  onDelete,
  onTagSelect 
}: PostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setUserVote] = useState<VoteType | undefined>();
  const [userReaction, setUserReaction] = useState<ReactionType | undefined>();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingReplyCommentId, setPendingReplyCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Audio player state
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleVote = (voteType: VoteType) => {
    setUserVote(prevVote => prevVote === voteType ? undefined : voteType);
    onVote?.(post.id, voteType);
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = handleVote;

  const handleReaction = async (reactionType: ReactionType) => {
    if (!currentUserId) {
      alert('You must be signed in to react to posts');
      return;
    }

    // Toggle reaction - remove if same, set if different
    const newReaction = userReaction === reactionType ? undefined : reactionType;
    setUserReaction(newReaction);
    
    try {
      const response = await fetch('/api/v16/community/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          post_id: post.id,
          reaction_type: newReaction ? reactionType : null // null removes reaction
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update reaction');
      }
    } catch (error) {
      console.error('Error updating reaction:', error);
      // Revert on error
      setUserReaction(userReaction);
      alert('Failed to update reaction. Please try again.');
    }
  };

  // Audio player functions
  const toggleAudioPlayback = () => {
    if (!post.audio_url) return;
    
    try {
      setAudioError(null);
      
      if (audioRef.current) {
        if (audioPlaying) {
          audioRef.current.pause();
          setAudioPlaying(false);
        } else {
          audioRef.current.play();
          setAudioPlaying(true);
        }
      } else {
        // Create new audio element
        const audio = new Audio(post.audio_url);
        audioRef.current = audio;
        
        audio.addEventListener('loadedmetadata', () => {
          setAudioPlaying(true);
          audio.play();
        });
        
        audio.addEventListener('timeupdate', () => {
          setAudioCurrentTime(audio.currentTime);
        });
        
        audio.addEventListener('ended', () => {
          setAudioPlaying(false);
          setAudioCurrentTime(0);
        });
        
        audio.addEventListener('error', (e) => {
          console.error('Audio playback error:', e);
          setAudioError('Unable to play audio');
          setAudioPlaying(false);
        });
        
        audio.addEventListener('pause', () => {
          setAudioPlaying(false);
        });
        
        audio.addEventListener('play', () => {
          setAudioPlaying(true);
        });
      }
    } catch (error) {
      console.error('Audio toggle error:', error);
      setAudioError('Error playing audio');
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // No need to fetch display names - they're stored with posts/comments

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/v16/community/comments?post_id=${post.id}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentClick = async () => {
    if (!showComments) {
      await fetchComments();
    }
    setShowComments(!showComments);
  };

  const handleCommentSubmit = async () => {
    if (!newCommentContent.trim()) return;
    
    if (!currentUserId) {
      alert('You must be signed in to comment');
      return;
    }

    // Check if current user has display name
    setSubmittingComment(true);
    try {
      const profileResponse = await fetch(`/api/v16/user/profile?user_id=${currentUserId}`);
      if (!profileResponse.ok) {
        throw new Error('Failed to check user profile');
      }
      
      const profileData = await profileResponse.json();
      if (!profileData.has_display_name) {
        setShowNameModal(true);
        setSubmittingComment(false);
        return;
      }

      const response = await fetch('/api/v16/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          post_id: post.id,
          parent_comment_id: null,
          content: newCommentContent.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setNewCommentContent('');
      setShowCommentForm(false);
      // Refresh comments to show the new comment
      await fetchComments();
    } catch (error) {
      console.error('Failed to submit comment:', error);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReplySubmit = async (parentCommentId: string) => {
    if (!replyContent.trim()) return;
    
    if (!currentUserId) {
      alert('You must be signed in to reply to comments');
      return;
    }

    // Check if current user has display name
    setSubmittingReply(true);
    try {
      const profileResponse = await fetch(`/api/v16/user/profile?user_id=${currentUserId}`);
      if (!profileResponse.ok) {
        throw new Error('Failed to check user profile');
      }
      
      const profileData = await profileResponse.json();
      if (!profileData.has_display_name) {
        setPendingReplyCommentId(parentCommentId);
        setShowNameModal(true);
        setSubmittingReply(false);
        return;
      }

      const response = await fetch('/api/v16/community/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          post_id: post.id,
          parent_comment_id: parentCommentId,
          content: replyContent.trim()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setReplyContent('');
      setReplyingTo(null);
      // Refresh comments to show the new reply
      await fetchComments();
    } catch (error) {
      console.error('Failed to submit reply:', error);
      alert('Failed to submit reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleNameSet = async () => {
    if (pendingReplyCommentId) {
      // Continue with the reply submission after name is set
      await handleReplySubmit(pendingReplyCommentId);
      setPendingReplyCommentId(null);
    } else if (showCommentForm && newCommentContent.trim()) {
      // Continue with the main comment submission after name is set
      await handleCommentSubmit();
    }
  };

  const handleModalClose = () => {
    setShowNameModal(false);
    setPendingReplyCommentId(null);
  };

  const handleReplyClick = (commentId: string) => {
    if (replyingTo === commentId) {
      setReplyingTo(null);
      setReplyContent('');
    } else {
      setReplyingTo(commentId);
      setReplyContent('');
    }
  };

  const handleShareComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const shareData = {
      title: post.title || 'Community Post',
      text: `"${comment.content.substring(0, 200)}${comment.content.length > 200 ? '...' : ''}"`,
      url: `${window.location.origin}/chatbotV16/community/post/${post.id}/comment/${commentId}`
    };

    try {
      await navigator.clipboard.writeText(shareData.url);
      
      // Show toast notification
      const notification = document.createElement('div');
      notification.textContent = 'Comment link copied to clipboard!';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #22c55e;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      
      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 3000);

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        setTimeout(async () => {
          try {
            await navigator.share(shareData);
          } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
              console.warn('Web Share API failed:', err);
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to share comment:', error);
      alert(`Share this comment: ${shareData.url}`);
    }
  };

  const handleEditComment = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditCommentContent(content);
  };

  const handleSaveEditComment = async (commentId: string) => {
    if (!currentUserId || !editCommentContent.trim()) return;

    try {
      const response = await fetch(`/api/v16/community/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: currentUserId,
          content: editCommentContent.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      const updatedComment = await response.json();

      // Update the comment in local state
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === commentId) {
            return { ...comment, ...updatedComment };
          }
          // Check replies
          if (comment.replies) {
            const updatedReplies = comment.replies.map(reply => 
              reply.id === commentId ? { ...reply, ...updatedComment } : reply
            );
            return { ...comment, replies: updatedReplies };
          }
          return comment;
        })
      );

      setEditingCommentId(null);
      setEditCommentContent('');
      alert('Comment updated successfully');
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Failed to update comment. Please try again.');
    }
  };

  const handleCommentReaction = async (commentId: string, reactionType: ReactionType) => {
    if (!currentUserId) {
      alert('You must be signed in to react to comments');
      return;
    }

    try {
      const response = await fetch('/api/v16/community/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          comment_id: commentId,
          reaction_type: reactionType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update reaction');
      }
      
      // Refresh comments to get updated reaction counts
      await fetchComments();
    } catch (error) {
      console.error('Error updating comment reaction:', error);
      alert('Failed to update reaction. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUserId) return;

    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v16/community/comments/${commentId}?user_id=${currentUserId}&reason=User%20deleted`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove the comment from local state
      setComments(prevComments => 
        prevComments.map(comment => {
          if (comment.id === commentId) {
            // Don't remove, just mark as filtered out by returning null and filter later
            return null;
          }
          // Check replies
          if (comment.replies) {
            const filteredReplies = comment.replies.filter(reply => reply.id !== commentId);
            return { ...comment, replies: filteredReplies };
          }
          return comment;
        }).filter(Boolean) as PostComment[]
      );

      alert('Comment removed successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };


  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const shouldShowExpandButton = post.content.length > 200;

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden hover:border-[var(--button-primary)] transition-colors">
      {/* Post Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* User Avatar */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {post.user_id.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className="font-medium dark:text-white text-gray-800">
                  {post.display_name || '❌ No Display Name'}
                </span>
                {/* <ReputationBadge stats={userStats} size="sm" /> */}
              </div>
              <span className="text-xs text-[var(--text-secondary)]">{formatTimeAgo(post.created_at)}</span>
            </div>
          </div>

          {/* Post Type Badge & Circle Badge */}
          <div className="flex items-center space-x-2">
            {post.post_type === 'question' && (
              <span className="bg-[#c1d7ca] text-[#3b503c] text-xs px-2 py-1 rounded-full">
                Question
              </span>
            )}
            {post.has_best_answer && (
              <span className="bg-[#9dbbac] text-[#fdfefd] text-xs px-2 py-1 rounded-full">
                ✓ Solved
              </span>
            )}
            {showCircle && post.circle_id && (
              <span 
                className="bg-[#c1d7ca] text-[#3b503c] text-xs px-2 py-1 rounded-full font-medium cursor-pointer hover:bg-[#a8c4b3] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/chatbotV16/community?circle_id=${post.circle_id}`;
                }}
              >
                c/{post.circles?.display_name || post.circles?.name || `circle_${post.circle_id.slice(-8)}`}
              </span>
            )}
          </div>
        </div>


        {/* Post Title */}
        <h3 className="text-lg font-medium dark:text-white text-gray-800 mb-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-300 transition-colors">
          {post.title}
        </h3>

        {/* Post Content */}
        <div className="text-[var(--text-primary)] text-sm">
          {isExpanded ? post.content : truncateContent(post.content)}
          {shouldShowExpandButton && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-400 hover:text-blue-300 ml-2 text-xs font-medium"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Audio Player */}
        {post.post_type === 'audio' && post.audio_url && (
          <div className="mt-3 p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center space-x-3">
              <button 
                onClick={toggleAudioPlayback}
                className="w-10 h-10 bg-[#3b503c] hover:bg-[#2d3d2e] rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                disabled={!!audioError}
              >
                {audioPlaying ? (
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
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-[#3b503c] h-2 rounded-full transition-all duration-100" 
                    style={{ 
                      width: `${post.audio_duration && post.audio_duration > 0 ? (audioCurrentTime / post.audio_duration) * 100 : 0}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-1">
                  <span>
                    {Math.floor(audioCurrentTime / 60)}:
                    {(Math.floor(audioCurrentTime) % 60).toString().padStart(2, '0')}
                  </span>
                  <span>
                    {post.audio_duration ? 
                      `${Math.floor(post.audio_duration / 60)}:${(post.audio_duration % 60).toString().padStart(2, '0')}` : 
                      '0:00'
                    }
                  </span>
                </div>
              </div>
            </div>
            {audioError && (
              <div className="mt-2 text-red-400 text-xs">
                {audioError}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.tags.map((tag, index) => (
              <span
                key={index}
                onClick={() => onTagSelect?.(tag)}
                className="bg-[var(--border-color)] text-[var(--text-primary)] text-xs px-2 py-1 rounded-full hover:bg-[var(--button-primary)] cursor-pointer transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Post Actions */}
      <div className="px-4 py-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <ActionIconsOverflow maxVisible={4}>
            {/* Reaction Buttons */}
            <ReactionButtons
              reactions={{
                care: post.care_count,
                hugs: post.hugs_count,
                helpful: post.helpful_count,
                strength: post.strength_count,
                relatable: post.relatable_count,
                thoughtful: post.thoughtful_count,
                growth: post.growth_count,
                grateful: post.grateful_count
              }}
              userReaction={userReaction}
              onReaction={handleReaction}
            />

            {/* Comment Button */}
            <button
              onClick={handleCommentClick}
              className={`flex items-center space-x-2 transition-colors ${
                showComments ? 'text-[var(--button-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm">{post.comment_count}</span>
              {loadingComments && (
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              )}
            </button>

            {/* Share Button */}
            <button
              onClick={() => onShare?.(post.id)}
              className="flex items-center space-x-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span className="text-sm">Share</span>
            </button>


            {/* Edit Button (only for post author) */}
            {currentUserId === post.user_id && (
              <button
                onClick={() => onEdit?.(post.id)}
                className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors"
                title="Edit post"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-sm">Edit</span>
              </button>
            )}

            {/* Delete Button (only for post author) */}
            {currentUserId === post.user_id && (
              <button
                onClick={() => onDelete?.(post.id)}
                className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Delete post"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm">Delete</span>
              </button>
            )}

            {/* Report Button */}
            <button
              onClick={() => onReport?.(post.id)}
              className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors"
              title="Report post"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6H8.5l-1 1H5a2 2 0 01-2-2zm9-13.5V9" />
              </svg>
              <span className="text-sm">Report</span>
            </button>
          </ActionIconsOverflow>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-[var(--border-color)] bg-[var(--comment-background)]">
          {comments.length === 0 ? (
            <div className="p-4">
              {!showCommentForm ? (
                <div className="text-center">
                  <button
                    onClick={() => setShowCommentForm(true)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  >
                    Be the first to comment!
                  </button>
                </div>
              ) : (
                <div>
                  <textarea
                    value={newCommentContent}
                    onChange={(e) => setNewCommentContent(e.target.value)}
                    placeholder="Write your comment..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm p-3 resize-none focus:outline-none focus:border-[var(--button-primary)] min-h-[80px]"
                  />
                  <div className="flex justify-end space-x-2 mt-2">
                    <button
                      onClick={() => {
                        setShowCommentForm(false);
                        setNewCommentContent('');
                      }}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCommentSubmit}
                      disabled={!newCommentContent.trim() || submittingComment}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                    >
                      {submittingComment ? 'Posting...' : 'Comment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {comments.map((comment) => (
                <div key={comment.id} className="p-4 group">
                  <div className="flex items-start space-x-3">
                    {/* User Avatar */}
                    <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {comment.user_id.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {comment.display_name || '❌ No Display Name'}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {formatTimeAgo(comment.created_at)}
                        </span>
                        {comment.is_best_answer && (
                          <span className="bg-green-900/50 text-green-300 text-xs px-2 py-0.5 rounded-full">
                            ✓ Best Answer
                          </span>
                        )}
                      </div>
                      
                      {/* Comment content - editable if editing */}
                      {editingCommentId === comment.id ? (
                        <div className="mb-2">
                          <textarea
                            value={editCommentContent}
                            onChange={(e) => setEditCommentContent(e.target.value)}
                            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm p-2 resize-none focus:outline-none focus:border-[var(--button-primary)]"
                            rows={3}
                          />
                          <div className="flex justify-end space-x-2 mt-2">
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEditComment(comment.id)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm text-[var(--text-primary)] flex-1 mr-2">{comment.content}</p>
                          {/* Edit/Delete icons for comment author */}
                          {currentUserId === comment.user_id && (
                            <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEditComment(comment.id, comment.content)}
                                className="text-gray-400 hover:text-blue-400 transition-colors p-1"
                                title="Edit comment"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-400 hover:text-red-400 transition-colors p-1"
                                title="Delete comment"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Only show action buttons when not editing */}
                      {editingCommentId !== comment.id && (
                        <div className="flex items-center space-x-4">
                        <div className="scale-75 origin-left">
                          <ReactionButtons
                            reactions={{
                              care: comment.care_count,
                              hugs: comment.hugs_count,
                              helpful: comment.helpful_count,
                              strength: comment.strength_count,
                              relatable: comment.relatable_count,
                              thoughtful: comment.thoughtful_count,
                              growth: comment.growth_count,
                              grateful: comment.grateful_count
                            }}
                            userReaction={undefined} // TODO: Track user reactions for comments
                            onReaction={(reactionType) => handleCommentReaction(comment.id, reactionType)}
                          />
                        </div>
                        
                        <button 
                          onClick={() => handleReplyClick(comment.id)}
                          className={`text-xs transition-colors ${
                            replyingTo === comment.id 
                              ? 'text-blue-400' 
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                        </button>

                        <button 
                          onClick={() => handleShareComment(comment.id)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                          title="Share comment"
                        >
                          Share
                        </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Nested Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-9 mt-3 space-y-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="border-l-2 border-gray-700 pl-3 group">
                          <div className="flex items-start space-x-2">
                            <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                              {reply.user_id.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-xs font-medium text-gray-300">
                                  {reply.display_name || '❌ No Display Name'}
                                </span>
                                <span className="text-xs text-[var(--text-secondary)]">
                                  {formatTimeAgo(reply.created_at)}
                                </span>
                              </div>
                              
                              {/* Reply content - editable if editing */}
                              {editingCommentId === reply.id ? (
                                <div className="mb-2">
                                  <textarea
                                    value={editCommentContent}
                                    onChange={(e) => setEditCommentContent(e.target.value)}
                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs p-2 resize-none focus:outline-none focus:border-[var(--button-primary)]"
                                    rows={2}
                                  />
                                  <div className="flex justify-end space-x-2 mt-1">
                                    <button
                                      onClick={() => setEditingCommentId(null)}
                                      className="text-xs text-gray-400 hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSaveEditComment(reply.id)}
                                      className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mb-1">
                                  <div className="flex items-start justify-between">
                                    <p className="text-xs text-gray-200 flex-1 mr-2">{reply.content}</p>
                                    {/* Edit/Delete icons for reply author */}
                                    {currentUserId === reply.user_id && (
                                      <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleEditComment(reply.id, reply.content)}
                                          className="text-gray-400 hover:text-blue-400 transition-colors p-0.5"
                                          title="Edit reply"
                                        >
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteComment(reply.id)}
                                          className="text-gray-400 hover:text-red-400 transition-colors p-0.5"
                                          title="Delete reply"
                                        >
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Reply Form */}
                  {replyingTo === comment.id && (
                    <div className="mt-3 ml-9">
                      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Write your reply..."
                          className="w-full bg-transparent text-white placeholder-gray-400 text-sm resize-none focus:outline-none"
                          rows={2}
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReplySubmit(comment.id)}
                            disabled={!replyContent.trim() || submittingReply}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
                          >
                            {submittingReply ? 'Posting...' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Name Selection Modal */}
      <NameSelectionModal
        isOpen={showNameModal}
        onClose={handleModalClose}
        onNameSet={handleNameSet}
      />
    </div>
  );
}