// Community Feed TypeScript Types

export type PostType = 'text' | 'audio' | 'question';
export type VoteType = 'upvote' | 'downvote';
export type ReactionType = 'care' | 'hugs' | 'helpful' | 'strength' | 'relatable' | 'thoughtful' | 'growth' | 'grateful';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved';
export type ModerationDecision = 'approved' | 'flagged' | 'rejected';
export type CrisisSeverity = 'low' | 'medium' | 'high' | 'immediate';
export type ReviewPriority = 'immediate' | 'urgent' | 'standard';
export type ReviewStatus = 'pending' | 'in_review' | 'completed' | 'escalated';
export type RiskLevel = 'low' | 'medium' | 'high' | 'crisis';
export type ContentType = 'post' | 'comment';
export type CircleRole = 'member' | 'moderator' | 'admin';

// Main Entity Types
export interface Circle {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  rules: string[];
  icon_url?: string;
  banner_url?: string;
  member_count: number;
  post_count: number;
  is_private: boolean;
  requires_approval: boolean;
  is_approved: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  welcome_message?: string;
  join_questions?: string[];
  // Membership context for authenticated users
  user_membership_role?: string | null;
  user_has_pending_request?: boolean;
}

export interface CircleMembership {
  id: string;
  circle_id: string;
  user_id: string;
  role: CircleRole;
  joined_at: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  display_name?: string;
  title: string;
  content: string;
  post_type: PostType;
  audio_url?: string;
  audio_duration?: number;
  tags: string[];
  upvotes: number;
  downvotes: number;
  care_count: number;
  hugs_count: number;
  helpful_count: number;
  strength_count: number;
  relatable_count: number;
  thoughtful_count: number;
  growth_count: number;
  grateful_count: number;
  comment_count: number;
  view_count: number;
  is_flagged: boolean;
  is_deleted: boolean;
  deleted_reason?: string;
  has_best_answer: boolean;
  circle_id?: string;
  circles?: {
    id: string;
    name: string;
    display_name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  parent_comment_id?: string;
  user_id: string;
  display_name?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  care_count: number;
  hugs_count: number;
  helpful_count: number;
  strength_count: number;
  relatable_count: number;
  thoughtful_count: number;
  growth_count: number;
  grateful_count: number;
  is_best_answer: boolean;
  is_flagged: boolean;
  is_deleted: boolean;
  deleted_reason?: string;
  created_at: string;
  updated_at: string;
  replies?: PostComment[]; // For nested comments
}

export interface PostVote {
  id: string;
  post_id?: string;
  comment_id?: string;
  user_id: string;
  vote_type: VoteType;
  created_at: string;
}

export interface PostReaction {
  id: string;
  post_id?: string;
  comment_id?: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface UserCommunityStats {
  user_id: string;
  posts_count: number;
  comments_count: number;
  upvotes_received: number;
  downvotes_received: number;
  reputation_score: number;
  helpful_answers_count: number;
  best_answers_count: number;
  is_verified: boolean;
  is_ai_assistant: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReputationEvent {
  id: string;
  user_id: string;
  event_type: string;
  points: number;
  post_id?: string;
  comment_id?: string;
  created_at: string;
}

export interface PostReport {
  id: string;
  post_id?: string;
  comment_id?: string;
  reported_by: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

// Safety and Moderation Types
export interface ContentModeration {
  id: string;
  post_id?: string;
  comment_id?: string;
  ai_toxicity_score?: number;
  ai_mental_health_flags: string[];
  human_review_required: boolean;
  human_review_priority?: ReviewPriority;
  ai_decision?: ModerationDecision;
  created_at: string;
}

export interface CrisisDetection {
  id: string;
  user_id: string;
  post_id?: string;
  comment_id?: string;
  crisis_type: string;
  severity_level: CrisisSeverity;
  ai_confidence?: number;
  trigger_keywords: string[];
  human_reviewed: boolean;
  human_reviewer?: string;
  intervention_taken?: string;
  resolved_at?: string;
  created_at: string;
}

export interface ClinicalReviewQueue {
  id: string;
  content_id: string;
  content_type: ContentType;
  user_id: string;
  priority_level: ReviewPriority;
  review_reason: string[];
  assigned_clinician?: string;
  status: ReviewStatus;
  review_notes?: string;
  action_taken?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface UserSafetyTracking {
  id: string;
  user_id: string;
  risk_level: RiskLevel;
  last_crisis_event?: string;
  total_flags: number;
  monitoring_until?: string;
  assigned_clinician?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentExposureTracking {
  id: string;
  user_id: string;
  harmful_content_type: string;
  exposure_count: number;
  last_exposure: string;
  intervention_triggered: boolean;
  intervention_type?: string;
  created_at: string;
}

// API Request/Response Types
export interface CreateCircleRequest {
  name: string;
  display_name: string;
  description?: string;
  rules?: string[];
  is_private?: boolean;
  requires_approval?: boolean;
}

export interface UpdateCircleRequest {
  display_name?: string;
  description?: string;
  rules?: string[];
  is_private?: boolean;
  requires_approval?: boolean;
  icon_url?: string;
  banner_url?: string;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  post_type: PostType;
  audio_url?: string;
  audio_duration?: number;
  tags: string[];
  circle_id?: string;
}

export interface CreateCommentRequest {
  post_id: string;
  parent_comment_id?: string;
  content: string;
}

export interface VoteRequest {
  post_id?: string;
  comment_id?: string;
  vote_type: VoteType;
}

export interface ReactionRequest {
  post_id?: string;
  comment_id?: string;
  reaction_type: ReactionType;
}

export interface ReportRequest {
  post_id?: string;
  comment_id?: string;
  reason: string;
  description?: string;
}

export interface CirclesResponse {
  circles: Circle[];
  total_count: number;
  page: number;
  limit: number;
  has_next_page: boolean;
}

export interface PostsResponse {
  posts: CommunityPost[];
  total_count: number;
  page: number;
  limit: number;
  has_next_page: boolean;
}

export interface CommentsResponse {
  comments: PostComment[];
  total_count: number;
}

// UI Component Props Types
export interface CircleCardProps {
  circle: Circle;
  currentUserId?: string;
  userMembership?: CircleMembership;
  onJoin?: (circleId: string) => void;
  onLeave?: (circleId: string) => void;
  onClick?: (circleId: string) => void;
}

export interface PostCardProps {
  post: CommunityPost;
  currentUserId?: string;
  showCircle?: boolean;
  onVote?: (postId: string, voteType: VoteType) => void;
  onReaction?: (postId: string, reactionType: ReactionType) => void;
  onComment?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onTagSelect?: (tag: string) => void;
}

export interface PostListProps {
  posts: CommunityPost[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onRefresh?: () => void;
  onTagSelect?: (tag: string) => void;
  onCreatePost?: () => void;
  showCircle?: boolean;
}

export interface CreatePostFormProps {
  onSubmit: (post: CreatePostRequest) => void;
  loading?: boolean;
  defaultCircleId?: string;
  availableCircles?: Circle[];
}

export interface CreateCircleFormProps {
  onSubmit: (circle: CreateCircleRequest) => void;
  loading?: boolean;
}

export interface CommentThreadProps {
  comments: PostComment[];
  postId: string;
  currentUserId?: string;
  onVote?: (commentId: string, voteType: VoteType) => void;
  onReaction?: (commentId: string, reactionType: ReactionType) => void;
  onReply?: (commentId: string, content: string) => void;
  onReport?: (commentId: string) => void;
}

export interface VoteButtonsProps {
  upvotes: number;
  downvotes: number;
  userVote?: VoteType;
  onVote: (voteType: VoteType) => void;
  disabled?: boolean;
}

export interface ReactionCounts {
  care: number;
  hugs: number;
  helpful: number;
  strength: number;
  relatable: number;
  thoughtful: number;
  growth: number;
  grateful: number;
}

export interface ReactionButtonsProps {
  reactions: ReactionCounts;
  userReaction?: ReactionType;
  onReaction: (reactionType: ReactionType) => void;
  disabled?: boolean;
}

export interface ReputationBadgeProps {
  stats: UserCommunityStats;
  size?: 'sm' | 'md' | 'lg';
}

// Filter and Sort Types
export type PostSortBy = 'hot' | 'new' | 'top' | 'controversial';
export type PostFilter = 'all' | 'questions' | 'discussions' | 'audio';
export type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

export interface PostFilters {
  sort_by: PostSortBy;
  filter: PostFilter;
  time_range?: TimeRange;
  tags?: string[];
  circle_id?: string;
}

// Hook Return Types
export interface UseCirclesReturn {
  circles: Circle[];
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
  refresh: () => void;
  createCircle: (circle: CreateCircleRequest) => Promise<void>;
  joinCircle: (circleId: string) => Promise<void>;
  leaveCircle: (circleId: string) => Promise<void>;
}

export interface UseCommunityPostsReturn {
  posts: CommunityPost[];
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
  refresh: () => void;
}

export interface UsePostVotesReturn {
  vote: (postId: string, voteType: VoteType) => Promise<void>;
  unvote: (postId: string) => Promise<void>;
  getUserVote: (postId: string) => VoteType | undefined;
  loading: boolean;
  error: string | null;
}

export interface UsePostCommentsReturn {
  comments: PostComment[];
  loading: boolean;
  error: string | null;
  addComment: (comment: CreateCommentRequest) => Promise<void>;
  refresh: () => void;
}

export interface UseReputationReturn {
  stats: UserCommunityStats | null;
  events: ReputationEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface UseContentModerationReturn {
  analyzeContent: (content: string, contentType: ContentType) => Promise<ContentModeration>;
  reportContent: (report: ReportRequest) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Error Types
export interface CommunityError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Utility Types
export type PartialPost = Partial<CommunityPost> & Pick<CommunityPost, 'id'>;
export type PartialComment = Partial<PostComment> & Pick<PostComment, 'id'>;

// Constants
export const REPUTATION_POINTS = {
  POST_UPVOTE: 5,
  COMMENT_UPVOTE: 2,
  HELPFUL_ANSWER: 10,
  BEST_ANSWER: 15,
  POST_DOWNVOTE: -2,
  COMMENT_DOWNVOTE: -1,
  FLAGGED_CONTENT: -10,
} as const;

export const REPUTATION_LEVELS = {
  NEW_MEMBER: { min: 0, max: 49, badge: 'gray', name: 'New Member' },
  ACTIVE_MEMBER: { min: 50, max: 199, badge: 'bronze', name: 'Active Member' },
  TRUSTED_MEMBER: { min: 200, max: 499, badge: 'silver', name: 'Trusted Member' },
  VALUED_CONTRIBUTOR: { min: 500, max: 999, badge: 'gold', name: 'Valued Contributor' },
  COMMUNITY_LEADER: { min: 1000, max: Infinity, badge: 'platinum', name: 'Community Leader' },
} as const;

export const REPUTATION_PERMISSIONS = {
  UPVOTE: 50,
  DOWNVOTE: 100,
  FLAG_CONTENT: 200,
  EDIT_POSTS: 500,
  MODERATE_COMMENTS: 1000,
} as const;