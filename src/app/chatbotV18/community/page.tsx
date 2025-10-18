'use client';

import { useState, useEffect } from 'react';
import { MobileFooterNavV15 } from '../components/MobileFooterNavV15';
import { CreatePostForm } from './components/CreatePostForm';
import { PostList } from './components/PostList';
import { CommunityPost, CreatePostRequest, PostSortBy, Circle } from './types/community';
import { NameSelectionModal } from '../components/NameSelectionModal';
import { EditPostModal } from './components/EditPostModal';
import { useAuth } from '@/contexts/auth-context';
// Mock data import removed - now using Supabase

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<PostSortBy>('hot');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [hasDisplayName, setHasDisplayName] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [currentCircleId, setCurrentCircleId] = useState<string | null>(null);
  const [circleIdInitialized, setCircleIdInitialized] = useState(false);
  const [circleName, setCircleName] = useState<string | null>(null);
  const [userCircles, setUserCircles] = useState<Circle[]>([]);
  const { user } = useAuth();

  // Logging helper following project standards
  const logCircleFiltering = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_FILTERING_LOGS === 'true') {
      console.log(`[circle_filtering] ${message}`, ...args);
    }
  };

  // Check URL parameters for circle_id
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const circleId = urlParams.get('circle_id');
    logCircleFiltering('URL parsing - circleId from URL:', circleId);
    if (circleId) {
      logCircleFiltering('Setting currentCircleId to:', circleId);
      setCurrentCircleId(circleId);
      // Fetch circle name
      fetchCircleName(circleId);
    } else {
      logCircleFiltering('No circle_id in URL, setting to null');
      setCurrentCircleId(null);
      setCircleName(null);
    }
    setCircleIdInitialized(true);
  }, []);

  const fetchCircleName = async (circleId: string) => {
    try {
      const response = await fetch(`/api/v16/community/circles/${circleId}`);
      if (response.ok) {
        const circle = await response.json();
        setCircleName(circle.display_name);
      }
    } catch (error) {
      console.error('Failed to fetch circle name:', error);
    }
  };

  // Logging helper following project standards
  const logCircleSelector = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_SELECTOR_LOGS === 'true') {
      console.log(`[circle_selector] ${message}`, ...args);
    }
  };

  const fetchUserCircles = async () => {
    logCircleSelector('fetchUserCircles called', { hasUser: !!user, userId: user?.uid });
    
    if (!user) {
      logCircleSelector('❌ No user found, skipping circle fetch');
      return;
    }
    
    try {
      const apiUrl = `/api/v16/community/memberships?user_id=${user.uid}`;
      logCircleSelector('Making API request to:', apiUrl);
      
      const response = await fetch(apiUrl);
      logCircleSelector('API response status:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        logCircleSelector('Raw API response data:', data);
        
        // Extract circles from memberships and sort alphabetically by display_name
        const circles = data.memberships
          .map((membership: { circles: Circle }) => membership.circles)
          .filter((circle: Circle) => circle) // Filter out any null circles
          .sort((a: Circle, b: Circle) => a.display_name.localeCompare(b.display_name));
        
        logCircleSelector('Processed circles:', {
          totalMemberships: data.memberships?.length || 0,
          circlesAfterProcessing: circles.length,
          circles: circles.map((c: Circle) => ({ id: c.id, name: c.name, display_name: c.display_name }))
        });
        
        setUserCircles(circles);
        logCircleSelector('✅ User circles set successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        logCircleSelector('❌ API request failed:', { status: response.status, errorData });
      }
    } catch (error) {
      logCircleSelector('❌ Exception during fetchUserCircles:', error);
      console.error('Failed to fetch user circles:', error);
    }
  };


  useEffect(() => {
    // Only load posts after circle ID has been initialized from URL
    if (!circleIdInitialized) {
      logCircleFiltering('Skipping loadPosts - circle ID not initialized yet');
      return;
    }
    logCircleFiltering('loadPosts triggered by:', { activeTab, selectedTags, currentCircleId });
    loadPosts();
  }, [activeTab, selectedTags, currentCircleId, circleIdInitialized]);

  // Check if user has display name when they're authenticated
  useEffect(() => {
    if (user) {
      checkUserDisplayName();
    }
  }, [user]);

  // Fetch user circles when on general feed (currentCircleId is null)
  useEffect(() => {
    logCircleSelector('Circle fetch useEffect triggered', {
      hasUser: !!user,
      userId: user?.uid,
      currentCircleId,
      circleIdInitialized,
      shouldFetch: user && currentCircleId === null && circleIdInitialized
    });
    
    if (user && currentCircleId === null && circleIdInitialized) {
      logCircleSelector('Conditions met - calling fetchUserCircles');
      fetchUserCircles();
    } else {
      logCircleSelector('Conditions not met - skipping circle fetch');
    }
  }, [user, currentCircleId, circleIdInitialized]);

  const checkUserDisplayName = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/v16/user/profile?user_id=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        // Use the boolean flag for validation, consistent with reply flow
        setHasDisplayName(data.has_display_name);
      } else {
        throw new Error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error checking display name:', error);
      // Show error, don't hide it
      alert('Error checking user profile. Please refresh the page.');
    } finally {
    }
  };

  const requireDisplayName = () => {
    if (!user) {
      alert('You must be signed in to participate in community discussions');
      return false;
    }

    if (!hasDisplayName) {
      setShowNameModal(true);
      return false;
    }

    return true;
  };

  const handleEditPost = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setEditingPost(post);
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = async (postId: string, title: string, content: string, tags: string[]) => {
    if (!user) return;

    setEditLoading(true);
    try {
      const response = await fetch(`/api/v16/community/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.uid,
          title,
          content,
          tags
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update post');
      }

      const updatedPost = await response.json();

      // Update the post in the local state
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId ? { ...post, ...updatedPost } : post
        )
      );

      setShowEditModal(false);
      setEditingPost(null);
      alert('Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingPost(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v16/community/posts/${postId}?user_id=${user.uid}&reason=User%20deleted`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      // Remove the post from the local state
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  const loadPosts = async (loadMore = false) => {
    setLoading(true);
    try {
      const currentPage = loadMore ? page + 1 : 1;
      const params = new URLSearchParams({
        sort_by: activeTab,
        page: currentPage.toString(),
        limit: '3'
      });

      // Add circle filter if viewing specific circle
      logCircleFiltering('loadPosts params logic - currentCircleId:', currentCircleId, 'user:', !!user);
      if (currentCircleId) {
        logCircleFiltering('Adding circle_id filter:', currentCircleId);
        params.append('circle_id', currentCircleId);
      } else if (user) {
        logCircleFiltering('Adding requesting_user_id for home feed:', user.uid);
        // Add user ID to get personalized feed with circle content (only for home feed)
        params.append('requesting_user_id', user.uid);
      }

      // Add tags filter if any are selected
      if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
      }

      const response = await fetch(`/api/v16/community/posts?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (loadMore) {
        setPosts(prev => [...prev, ...data.posts]);
        setPage(currentPage);
      } else {
        setPosts(data.posts);
        setPage(1);
      }

      setHasMore(data.has_next_page);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (postData: CreatePostRequest) => {
    if (!requireDisplayName()) return;

    const requestData = { ...postData, user_id: user!.uid };

    // Debug logging to understand what's being sent
    console.log('handleCreatePost - postData received:', JSON.stringify(postData, null, 2));
    console.log('handleCreatePost - requestData to send:', JSON.stringify(requestData, null, 2));
    console.log('handleCreatePost - postData.tags:', postData.tags);
    console.log('handleCreatePost - postData.tags type:', typeof postData.tags);
    console.log('handleCreatePost - postData.tags is Array:', Array.isArray(postData.tags));

    try {
      const response = await fetch('/api/v16/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Post created successfully');

      // Reload posts to show the new one
      loadPosts();
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Failed to create post. Please try again.');
    }
  };

  const handleTabChange = (tab: PostSortBy) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleTagSelect = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
      setPage(1);
    }
  };

  const handleTagRemove = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
    setPage(1);
  };

  const clearAllTags = () => {
    setSelectedTags([]);
    setPage(1);
  };

  // Logging helper following project standards
  const logCreatePostDebug = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CREATE_POST_DEBUG_LOGS === 'true') {
      console.log(`[create_post_debug] ${message}`, ...args);
    }
  };

  const handleCreatePostClick = () => {
    logCreatePostDebug('Create First Post button clicked');
    const createPostElement = document.getElementById('create-post-form');
    logCreatePostDebug('Found create-post-form element:', !!createPostElement);
    
    if (createPostElement) {
      logCreatePostDebug('Scrolling to create post form');
      createPostElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // First, click the form's expand button if it exists (form is collapsed)
      const expandButton = createPostElement.querySelector('button') as HTMLButtonElement;
      logCreatePostDebug('Found expand button:', !!expandButton);
      
      if (expandButton) {
        logCreatePostDebug('Clicking expand button to open form');
        expandButton.click();
      }
      
      // Focus the first input in the create post form after expanding and scrolling
      setTimeout(() => {
        const firstInput = createPostElement.querySelector('input, textarea') as HTMLElement;
        logCreatePostDebug('Found first input after expand:', !!firstInput);
        if (firstInput) {
          firstInput.focus();
          logCreatePostDebug('Focused first input');
        }
      }, 600); // Slightly longer delay to account for form expansion
    } else {
      logCreatePostDebug('❌ create-post-form element not found');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-24">

        {/* Navigation Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            {currentCircleId ? (
              <div className="flex items-center space-x-3">
                <a
                  href="/chatbotV16/community"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ← Back to Community
                </a>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                    {circleName || 'Circle'}
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)]">Circle Posts</p>
                </div>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Community</h1>
            )}
          </div>
          <a
            href="/chatbotV16/community/circles"
            className="bg-[#c1d7ca] hover:bg-[#9dbbac] text-[#3b503c] px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 14v6m11-7h-6m-14 0h6"></path>
            </svg>
            <span>Browse Circles</span>
          </a>
        </div>

        {/* Create Post Form */}
        <div id="create-post-form">
          <CreatePostForm
            onSubmit={handleCreatePost}
            loading={loading}
            defaultCircleId={currentCircleId || undefined}
            availableCircles={(() => {
              const circles = currentCircleId === null ? userCircles : [];
              logCircleSelector('Passing circles to CreatePostForm:', {
                currentCircleId,
                isGeneralFeed: currentCircleId === null,
                userCirclesCount: userCircles.length,
                circlesPassed: circles.length,
                circles: circles.map((c: Circle) => ({ id: c.id, name: c.name, display_name: c.display_name }))
              });
              return circles;
            })()}
          />
        </div>

        {/* Building in Public Notice */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🚧</div>
            <div>
              <div className="text-blue-800 font-semibold">Building in Public</div>
              <div className="text-blue-700 text-sm">
                This community feed is currently in development. All data here is test data as we build this feature in public.
                Your posts, interactions and feedback help us improve the experience!
              </div>
            </div>
          </div>
        </div>

        {/* Feed Tabs */}
        <div className="flex space-x-1 mb-6 bg-[var(--bg-secondary)] rounded-lg p-1">
          {[
            { id: 'hot' as PostSortBy, label: 'Hot', icon: '🔥' },
            { id: 'new' as PostSortBy, label: 'New', icon: '🆕' },
            { id: 'top' as PostSortBy, label: 'Top', icon: '⭐' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                ? 'bg-[var(--button-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]'
                }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Tag Filters */}
        {selectedTags.length > 0 && (
          <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                Active Filters ({selectedTags.length})
              </h3>
              <button
                onClick={clearAllTags}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center bg-[var(--button-primary)] text-white text-xs px-3 py-1 rounded-full"
                >
                  <span>#{tag}</span>
                  <button
                    onClick={() => handleTagRemove(tag)}
                    className="ml-2 hover:text-red-200 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts Feed */}
        <PostList
          posts={posts}
          loading={loading}
          onLoadMore={() => loadPosts(true)}
          hasMore={hasMore}
          onEdit={handleEditPost}
          onDelete={handleDeletePost}
          onRefresh={() => loadPosts()}
          onTagSelect={handleTagSelect}
          onCreatePost={handleCreatePostClick}
          showCircle={!currentCircleId} // Only show circle labels on home feed
        />
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0">
        <MobileFooterNavV15 />
      </div>

      {/* Name Selection Modal */}
      <NameSelectionModal
        isOpen={showNameModal}
        onClose={() => setShowNameModal(false)}
        onNameSet={() => {
          setHasDisplayName(true);
          setShowNameModal(false);
        }}
      />

      {/* Edit Post Modal */}
      <EditPostModal
        isOpen={showEditModal}
        post={editingPost}
        onClose={handleCloseEditModal}
        onSave={handleSaveEdit}
        loading={editLoading}
      />
    </div>
  );
}