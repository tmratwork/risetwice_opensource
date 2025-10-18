'use client';

import React, { useState, useEffect } from 'react';
import { Circle, CircleMembership, CreateCircleRequest } from '../types/community';
import CircleCard from '../components/CircleCard';
import CreateCircleForm from '../components/CreateCircleForm';
import CircleJoinRequest from '../components/CircleJoinRequest';
import { Search, Plus, Users, TrendingUp, Clock, X } from 'lucide-react';
import { useAuth } from '../../../../contexts/auth-context';

type SortOption = 'member_count' | 'post_count' | 'created_at' | 'name';


export default function CirclesPage() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [userMemberships, setUserMemberships] = useState<CircleMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('member_count');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [joiningCircles, setJoiningCircles] = useState<Set<string>>(new Set());
  const [showJoinRequestModal, setShowJoinRequestModal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  // Logging helper following project standards
  const logCircleMembership = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MEMBERSHIP_LOGS === 'true') {
      console.log(`[circle_membership] ${message}`, ...args);
    }
  };

  // Fetch circles
  const fetchCircles = async () => {
    try {
      const params = new URLSearchParams({
        sort_by: sortBy,
        limit: '50',
      });

      if (searchTerm) {
        params.set('search', searchTerm);
      }

      // Send authenticated user ID for proper membership context
      if (user?.uid) {
        params.set('requesting_user_id', user.uid);
      }

      const response = await fetch(`/api/v16/community/circles?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch circles');
      }

      const data = await response.json();

      // Debug logging for API response
      if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_JOIN_REQUEST_LOGS === 'true') {
        console.log('[circle_join_request] API response received:', {
          circleCount: data.circles?.length || 0,
          sampleCircle: data.circles?.[0],
          hasRequiresApprovalField: data.circles?.[0]?.hasOwnProperty('requires_approval'),
          firstCircleRequiresApproval: data.circles?.[0]?.requires_approval
        });
      }

      setCircles(data.circles || []);
    } catch (error) {
      console.error('Error fetching circles:', error);
      setError('Failed to load circles');
    }
  };

  // Fetch user memberships
  const fetchUserMemberships = async () => {
    if (!user?.uid) {
      logCircleMembership('❌ No user ID available for membership fetch');
      return;
    }

    logCircleMembership('🔍 Fetching memberships for user:', user.uid);

    try {
      const response = await fetch(`/api/v16/community/memberships?user_id=${user.uid}`);

      if (response.ok) {
        const data = await response.json();
        logCircleMembership('✅ Memberships fetched successfully:', {
          count: data.memberships?.length || 0,
          memberships: data.memberships
        });
        setUserMemberships(data.memberships || []);
      } else {
        logCircleMembership('❌ Failed to fetch memberships:', response.status);
        setUserMemberships([]);
      }
    } catch (error) {
      logCircleMembership('❌ Error fetching memberships:', error);
      setUserMemberships([]);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchCircles(),
        fetchUserMemberships(),
      ]);
      setLoading(false);
    };

    loadData();
  }, [sortBy, user?.uid]);

  // Search debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== undefined) {
        fetchCircles();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Handle join circle
  const handleJoinCircle = async (circleId: string) => {
    if (!user?.uid) return;

    const circle = circles.find(c => c.id === circleId);

    // Debug logging for join request system
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_JOIN_REQUEST_LOGS === 'true') {
      console.log('[circle_join_request] Join button clicked:', {
        circleId,
        circleName: circle?.display_name || 'Unknown',
        requiresApproval: circle?.requires_approval,
        requiresApprovalType: typeof circle?.requires_approval,
        fullCircleObject: circle
      });
    }

    // If circle requires approval, show join request modal
    if (circle?.requires_approval) {
      if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_JOIN_REQUEST_LOGS === 'true') {
        console.log('[circle_join_request] ✅ Showing join request modal for approval-required circle');
      }
      setShowJoinRequestModal(circleId);
      return;
    } else {
      if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_JOIN_REQUEST_LOGS === 'true') {
        console.log('[circle_join_request] ➡️ Proceeding with direct join (no approval required)');
      }
    }

    setJoiningCircles(prev => new Set(prev).add(circleId));

    try {
      const response = await fetch(`/api/v16/community/circles/${circleId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to join circle');
        return;
      }

      // Update local state
      setUserMemberships(prev => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          circle_id: circleId,
          user_id: user.uid,
          role: 'member',
          joined_at: new Date().toISOString(),
        }
      ]);

      // Update circle member count
      setCircles(prev => prev.map(circle =>
        circle.id === circleId
          ? { ...circle, member_count: circle.member_count + 1 }
          : circle
      ));
    } catch (error) {
      console.error('Error joining circle:', error);
      setError(error instanceof Error ? error.message : 'Failed to join circle');
    } finally {
      setJoiningCircles(prev => {
        const newSet = new Set(prev);
        newSet.delete(circleId);
        return newSet;
      });
    }
  };

  // Handle leave circle
  const handleLeaveCircle = async (circleId: string) => {
    if (!user?.uid) return;

    setJoiningCircles(prev => new Set(prev).add(circleId));

    try {
      const response = await fetch(`/api/v16/community/circles/${circleId}/join?user_id=${encodeURIComponent(user.uid)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to leave circle');
        return;
      }

      // Update local state
      setUserMemberships(prev => prev.filter(m => m.circle_id !== circleId));

      // Update circle member count
      setCircles(prev => prev.map(circle =>
        circle.id === circleId
          ? { ...circle, member_count: Math.max(0, circle.member_count - 1) }
          : circle
      ));
    } catch (error) {
      console.error('Error leaving circle:', error);
      setError(error instanceof Error ? error.message : 'Failed to leave circle');
    } finally {
      setJoiningCircles(prev => {
        const newSet = new Set(prev);
        newSet.delete(circleId);
        return newSet;
      });
    }
  };

  // Handle join request submission
  const handleJoinRequestSubmit = async (data: {
    message?: string;
    notificationEmail?: string;
    notificationPhone?: string;
  }) => {
    if (!user?.uid || !showJoinRequestModal) return;

    try {
      const response = await fetch(`/api/v16/community/circles/${showJoinRequestModal}/join-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          ...data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit join request');
      }

      // Close modal and show success
      setShowJoinRequestModal(null);
      alert('Join request submitted successfully!');

    } catch (error) {
      console.error('Error submitting join request:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit join request');
    }
  };

  // Handle create circle
  const handleCreateCircle = async (circleData: CreateCircleRequest) => {
    if (!user?.uid) return;

    setCreatingCircle(true);

    try {
      const response = await fetch('/api/v16/community/circles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...circleData,
          user_id: user.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create circle');
      }

      const newCircle = await response.json();

      // Add to circles list
      setCircles(prev => [newCircle, ...prev]);

      // Add user as admin member
      setUserMemberships(prev => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          circle_id: newCircle.id,
          user_id: user.uid,
          role: 'admin',
          joined_at: new Date().toISOString(),
        }
      ]);

      setShowCreateForm(false);
      
      // Show success message with approval notice
      alert('Circle created successfully! Your circle has been submitted for review and will be visible to others once approved by an admin.');
    } catch (error) {
      console.error('Error creating circle:', error);
      setError(error instanceof Error ? error.message : 'Failed to create circle');
    } finally {
      setCreatingCircle(false);
    }
  };

  const handleCircleClick = (circleId: string) => {
    // Navigate to circle page - this would be implemented with router
    console.log('Navigate to circle:', circleId);
  };

  const sortOptions = [
    { value: 'member_count', label: 'Most Members', icon: Users },
    { value: 'post_count', label: 'Most Active', icon: TrendingUp },
    { value: 'created_at', label: 'Newest', icon: Clock },
    { value: 'name', label: 'Alphabetical', icon: Search },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-4 pt-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                Community Circles
              </h1>
            </div>

            {user && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-[#9dbbac] hover:bg-[#3b503c] text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Circle</span>
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search circles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        )}

        {/* Create Circle Form */}
        {showCreateForm && (
          <div className="mb-8 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Create New Circle
              </h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                ×
              </button>
            </div>
            <CreateCircleForm
              onSubmit={handleCreateCircle}
              loading={creatingCircle}
            />
          </div>
        )}

        {/* Circles Grid */}
        {circles.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {circles.map((circle) => {
              const userMembership = userMemberships.find(m => m.circle_id === circle.id);
              const isJoining = joiningCircles.has(circle.id);

              // Log circle membership check
              logCircleMembership('🔍 Circle membership check:', {
                circleId: circle.id,
                circleName: circle.display_name,
                createdBy: circle.created_by,
                currentUserId: user?.uid,
                isCreator: circle.created_by === user?.uid,
                userMembership: userMembership,
                isMember: !!userMembership
              });

              return (
                <CircleCard
                  key={circle.id}
                  circle={circle}
                  currentUserId={user?.uid}
                  userMembership={userMembership}
                  onJoin={isJoining ? undefined : handleJoinCircle}
                  onLeave={isJoining ? undefined : handleLeaveCircle}
                  onClick={handleCircleClick}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-[var(--text-primary)] mb-2">
              {searchTerm ? 'No circles found' : 'No circles yet'}
            </h3>
            <p className="text-[var(--text-secondary)] mb-4">
              {searchTerm
                ? `No circles match "${searchTerm}". Try a different search term.`
                : 'Be the first to create a circle and start building community!'
              }
            </p>
            {!searchTerm && user && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-[#9dbbac] hover:bg-[#3b503c] text-white px-6 py-2 rounded-lg transition-colors"
              >
                Create the First Circle
              </button>
            )}
          </div>
        )}

        {/* Join Request Modal */}
        {showJoinRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Request to Join Circle</h2>
                  <button
                    onClick={() => setShowJoinRequestModal(null)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {(() => {
                  const circle = circles.find(c => c.id === showJoinRequestModal);
                  return circle ? (
                    <CircleJoinRequest
                      circle={circle}
                      onSubmit={handleJoinRequestSubmit}
                      onCancel={() => setShowJoinRequestModal(null)}
                    />
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}