'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Head from 'next/head';
import { PostCard } from '../../components/PostCard';
import { useAuth } from '@/contexts/auth-context';
import { CommunityPost } from '../../types/community';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const postId = params.postId as string;

  useEffect(() => {
    if (!postId) return;

    const fetchPost = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v16/community/posts/${postId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('Post not found');
          } else {
            setError('Failed to load post');
          }
          return;
        }

        const data = await response.json();
        setPost(data);
      } catch (err) {
        console.error('Error fetching post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

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
      const refreshResponse = await fetch(`/api/v16/community/posts/${postId}`);
      if (refreshResponse.ok) {
        const refreshedPost = await refreshResponse.json();
        setPost(refreshedPost);
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to vote. Please try again.');
    }
  };

  const handleShare = async (postId: string) => {
    const shareData = {
      title: post?.title || 'Community Post',
      text: post?.content ? `${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}` : 'Check out this post from our community!',
      url: `${window.location.origin}/chatbotV16/community/post/${postId}`
    };

    try {
      await navigator.clipboard.writeText(shareData.url);

      // Show toast notification
      const notification = document.createElement('div');
      notification.textContent = 'Link copied to clipboard!';
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
      alert(`Share this post: ${shareData.url}`);
    }
  };

  const handleReport = (postId: string) => {
    console.log('Report post:', postId);
  };

  if (loading) {
    return (
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
            <div className="bg-[#1a1a1b] border border-gray-700 rounded-lg p-4 animate-pulse">
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
              The post you&apos;re looking for doesn&apos;t exist or has been removed.
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

  if (!post) {
    return null;
  }

  return (
    <>
      <Head>
        <title>{post.title || 'Community Post'} - Risetwice.com</title>
        <meta name="description" content={post.content ? post.content.substring(0, 160) : 'Check out this post from our community!'} />
        <meta property="og:title" content={post.title || 'Community Post'} />
        <meta property="og:description" content={post.content ? post.content.substring(0, 160) : 'Check out this post from our community!'} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`${window.location.origin}/chatbotV16/community/post/${postId}`} />
        <meta property="og:site_name" content="Risetwice.com Community" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={post.title || 'Community Post'} />
        <meta name="twitter:description" content={post.content ? post.content.substring(0, 160) : 'Check out this post from our community!'} />
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
              <span>Post</span>
            </nav>
          </div>

          {/* Post */}
          <PostCard
            post={post}
            currentUserId={user?.uid}
            onVote={handleVote}
            onShare={handleShare}
            onReport={handleReport}
            showCircle={true}
          />
        </div>
      </div>
    </>
  );
}