'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Head from 'next/head';
import { PostCard } from '../../../../components/PostCard';
import { useAuth } from '@/contexts/auth-context';
import { CommunityPost, PostComment } from '../../../../types/community';

export default function CommentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [highlightedComment, setHighlightedComment] = useState<PostComment | null>(null);
  const [allComments, setAllComments] = useState<PostComment[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const postId = params.postId as string;
  const commentId = params.commentId as string;

  useEffect(() => {
    if (!postId || !commentId) return;

    const fetchPostAndComment = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v16/community/posts/${postId}/comments/${commentId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Post or comment not found');
          } else {
            setError('Failed to load content');
          }
          return;
        }

        const data = await response.json();
        setPost(data.post);
        setHighlightedComment(data.comment);
        setAllComments(data.allComments || []);
      } catch (err) {
        console.error('Error fetching post and comment:', err);
        setError('Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    fetchPostAndComment();
  }, [postId, commentId]);

  const handleVote = async (postId: string, voteType: 'upvote' | 'downvote') => {
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

      // Refresh the post to show updated vote counts
      const refreshResponse = await fetch(`/api/v16/community/posts/${postId}/comments/${commentId}`);
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json();
        setPost(refreshedData.post);
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to vote. Please try again.');
    }
  };

  const handleShare = async (postId: string) => {
    const shareData = {
      title: post?.title || 'Community Post',
      text: highlightedComment?.content
        ? `"${highlightedComment.content.substring(0, 200)}${highlightedComment.content.length > 200 ? '...' : ''}"`
        : 'Check out this comment from our community!',
      url: `${window.location.origin}/chatbotV16/community/post/${postId}/comment/${commentId}`
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

      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);

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
      console.error('Failed to share:', error);
      alert(`Share this comment: ${shareData.url}`);
    }
  };

  const handleReport = (postId: string) => {
    console.log('Report post:', postId);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-4xl mx-auto p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-600 rounded w-24 mb-4"></div>
            <div className="bg-[#1a1a1b] border border-gray-700 rounded-lg p-4 mb-4">
              <div className="h-6 bg-gray-600 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-600 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-600 rounded w-2/3"></div>
            </div>
            <div className="bg-[#1a1a1b] border border-gray-700 rounded-lg p-4">
              <div className="h-4 bg-gray-600 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-600 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-16">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold mb-4">{error}</h1>
            <p className="text-[var(--text-secondary)] mb-6">
              The content you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <button
              onClick={() => router.push('/chatbotV16/community')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Go to Community
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!post || !highlightedComment) {
    return null;
  }

  return (
    <>
      <Head>
        <title>{post.title || 'Community Post'} - Comment - Risetwice.com</title>
        <meta name="description" content={highlightedComment.content ? `"${highlightedComment.content.substring(0, 160)}"` : 'Check out this comment from our community!'} />
        <meta property="og:title" content={`Comment on: ${post.title || 'Community Post'}`} />
        <meta property="og:description" content={highlightedComment.content ? `"${highlightedComment.content.substring(0, 160)}"` : 'Check out this comment from our community!'} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`${window.location.origin}/chatbotV16/community/post/${postId}/comment/${commentId}`} />
        <meta property="og:site_name" content="RiseTwice.com" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`Comment on: ${post.title || 'Community Post'}`} />
        <meta name="twitter:description" content={highlightedComment.content ? `"${highlightedComment.content.substring(0, 160)}"` : 'Check out this comment from our community!'} />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="max-w-4xl mx-auto p-4">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
            >
              ← Back
            </button>
            <nav className="text-sm text-[var(--text-secondary)] mb-4">
              <span
                onClick={() => router.push('/chatbotV16/community')}
                className="cursor-pointer hover:text-[var(--text-primary)]"
              >
                Community
              </span>
              <span className="mx-2">›</span>
              <span
                onClick={() => router.push(`/chatbotV16/community/post/${postId}`)}
                className="cursor-pointer hover:text-[var(--text-primary)]"
              >
                Post
              </span>
              <span className="mx-2">›</span>
              <span>Comment</span>
            </nav>
          </div>

          {/* Original Post */}
          <div className="mb-6">
            <PostCard
              post={post}
              currentUserId={user?.uid}
              onVote={handleVote}
              onShare={handleShare}
              onReport={handleReport}
              showCircle={true}
            />
          </div>

          {/* Highlighted Comment */}
          <div className="bg-[var(--comment-background)] border-2 border-blue-500 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {highlightedComment.user_id.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {highlightedComment.display_name || '❌ No Display Name'}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {formatTimeAgo(highlightedComment.created_at)}
                  </span>
                  <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                    Shared Comment
                  </span>
                </div>
                <p className="text-[var(--text-primary)] text-sm leading-relaxed">
                  {highlightedComment.content}
                </p>
              </div>
            </div>
          </div>

          {/* View All Comments Button */}
          {!showAllComments && allComments.length > 1 && (
            <div className="text-center mb-6">
              <button
                onClick={() => setShowAllComments(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                View all {allComments.length} comments
              </button>
            </div>
          )}

          {/* All Comments (when expanded) */}
          {showAllComments && (
            <div className="bg-[var(--comment-background)] border border-[var(--border-color)] rounded-lg">
              <div className="p-4 border-b border-[var(--border-color)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  All Comments ({allComments.length})
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-color)]">
                {allComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-4 ${comment.id === commentId ? 'bg-blue-900/20 border-l-4 border-blue-500' : ''}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {comment.user_id.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {comment.display_name || '❌ No Display Name'}
                          </span>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {formatTimeAgo(comment.created_at)}
                          </span>
                          {comment.id === commentId && (
                            <span className="bg-blue-900/50 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                              Shared Comment
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-primary)] text-sm leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}