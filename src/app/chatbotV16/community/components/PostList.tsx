'use client';

import { PostListProps, VoteType } from '../types/community';
import { PostCard } from './PostCard';
import { useAuth } from '@/contexts/auth-context';

export function PostList({ 
  posts, 
  loading = false, 
  onLoadMore, 
  hasMore = false,
  onEdit,
  onDelete,
  onRefresh,
  onTagSelect,
  onCreatePost,
  showCircle = true
}: PostListProps) {
  const { user } = useAuth();
  const handleVote = async (postId: string, voteType: VoteType) => {
    if (!user) {
      alert('You must be signed in to vote');
      return;
    }

    try {
      const response = await fetch('/api/v16/community/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.uid,
          post_id: postId,
          vote_type: voteType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to vote');
      }

      await response.json();
      
      // Refresh the posts to show updated vote counts
      if (onRefresh) {
        onRefresh();
      }
      
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to vote. Please try again.');
    }
  };

  const handleComment = (postId: string) => {
    // TODO: Navigate to post detail or open comment modal
    console.log('Comment:', postId);
  };

  const handleReport = (postId: string) => {
    // TODO: Open report modal
    console.log('Report:', postId);
  };

  const showToastNotification = (message: string) => {
    // Show a temporary notification
    const notification = document.createElement('div');
    notification.textContent = message;
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
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 3000);
  };

  const handleShare = async (postId: string) => {
    // Find the post to get its details
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Create share data
    const shareData = {
      title: post.title || 'Community Post',
      text: post.content ? `${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}` : 'Check out this post from our community!',
      url: `${window.location.origin}/chatbotV16/community/post/${postId}`
    };

    // First, always copy to clipboard for immediate availability
    let clipboardSuccess = false;
    try {
      await navigator.clipboard.writeText(shareData.url);
      clipboardSuccess = true;
    } catch (clipboardError) {
      console.warn('Failed to copy to clipboard:', clipboardError);
    }

    try {
      // Check if Web Share API is available (iOS Safari, Android Chrome, etc.)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        // Show toast notification before opening share sheet (especially important for iOS)
        if (clipboardSuccess) {
          showToastNotification('Link copied to clipboard!');
        }
        
        // Small delay to ensure toast is visible before share sheet opens
        setTimeout(async () => {
          try {
            await navigator.share(shareData);
          } catch (shareError) {
            // If share was cancelled by user, don't show error
            if (shareError instanceof Error && shareError.name !== 'AbortError') {
              console.warn('Web Share API failed:', shareError);
            }
          }
        }, 100);
        
        return;
      }
    } catch (error) {
      console.warn('Web Share API failed:', error);
    }

    // Fallback: Show notification that URL was copied (for desktop browsers)
    if (clipboardSuccess) {
      try {
        showToastNotification('Link copied to clipboard!');
      } catch (notificationError) {
        console.error('Failed to show notification:', notificationError);
        // Final fallback: Alert with URL
        alert(`Share this post: ${shareData.url}`);
      }
    } else {
      // Final fallback: Alert with URL
      alert(`Share this post: ${shareData.url}`);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="bg-[#1a1a1b] border border-gray-700 rounded-lg p-4 animate-pulse">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
              <div className="space-y-1">
                <div className="h-4 bg-gray-600 rounded w-24"></div>
                <div className="h-3 bg-gray-600 rounded w-16"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-5 bg-gray-600 rounded w-3/4"></div>
              <div className="h-4 bg-gray-600 rounded w-full"></div>
              <div className="h-4 bg-gray-600 rounded w-2/3"></div>
            </div>
            <div className="flex items-center space-x-4 mt-4">
              <div className="h-8 bg-gray-600 rounded w-16"></div>
              <div className="h-8 bg-gray-600 rounded w-16"></div>
              <div className="h-8 bg-gray-600 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0 && !loading) {
    return (
      <div className="bg-[#1a1a1b] border border-gray-700 rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">📝</div>
        <h3 className="text-xl font-bold text-white mb-2">No posts yet</h3>
        <p className="text-gray-400 mb-4">
          Be the first to share something with the community!
        </p>
        <button 
          onClick={onCreatePost}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Create First Post
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={user?.uid}
          showCircle={showCircle}
          onVote={handleVote}
          onComment={handleComment}
          onReport={handleReport}
          onShare={handleShare}
          onEdit={onEdit}
          onDelete={onDelete}
          onTagSelect={onTagSelect}
        />
      ))}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="bg-[#1a1a1b] border border-gray-700 hover:border-gray-600 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading...</span>
              </div>
            ) : (
              'Load More Posts'
            )}
          </button>
        </div>
      )}

      {/* Loading indicator for infinite scroll */}
      {loading && posts.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}