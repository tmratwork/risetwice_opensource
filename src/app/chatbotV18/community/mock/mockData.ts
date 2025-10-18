// import { CommunityPost, PostComment, UserCommunityStats } from '../types/community';

// // Mock Posts Data
// export const mockPosts: CommunityPost[] = [
//   {
//     id: '1',
//     user_id: 'user1',
//     title: 'How do you handle anxiety before important events?',
//     content: 'I have a big presentation coming up and I\'m feeling really nervous. What strategies have worked for you to calm your nerves? I\'ve tried deep breathing but it only helps a little.',
//     post_type: 'question',
//     tags: ['anxiety', 'presentations', 'coping'],
//     upvotes: 12,
//     downvotes: 1,
//     comment_count: 5,
//     view_count: 45,
//     is_flagged: false,
//     is_deleted: false,
//     has_best_answer: false,
//     created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
//     updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
//   },
//   {
//     id: '2',
//     user_id: 'user2',
//     title: 'Celebrating a small win today! 🎉',
//     content: 'I managed to complete my morning routine for a whole week. It might seem small, but it\'s a big deal for me. Consistency has always been a challenge, especially with my ADHD. Here\'s what worked: setting out clothes the night before, keeping my phone in another room, and having a simple 3-step routine instead of trying to do everything at once.',
//     post_type: 'text',
//     tags: ['celebration', 'routine', 'progress', 'adhd'],
//     upvotes: 24,
//     downvotes: 0,
//     comment_count: 8,
//     view_count: 67,
//     is_flagged: false,
//     is_deleted: false,
//     has_best_answer: false,
//     created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
//     updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
//   },
//   {
//     id: '3',
//     user_id: 'user3',
//     title: 'Tips for better sleep hygiene',
//     content: 'I\'ve been struggling with insomnia lately and after working with my therapist, here are some things that have helped me. I\'d love to hear what works for others too! 1) No screens 1 hour before bed, 2) Cool room temperature (65-68°F), 3) Consistent bedtime even on weekends, 4) White noise or earplugs, 5) Journaling before bed to clear my mind.',
//     post_type: 'text',
//     tags: ['sleep', 'health', 'tips', 'insomnia'],
//     upvotes: 18,
//     downvotes: 2,
//     comment_count: 12,
//     view_count: 89,
//     is_flagged: false,
//     is_deleted: false,
//     has_best_answer: true,
//     created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
//     updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
//   },
//   {
//     id: '4',
//     user_id: 'user4',
//     title: 'Dealing with social anxiety at work',
//     content: 'I\'m new to my job and having trouble speaking up in meetings. My heart races and I forget what I wanted to say. Anyone else been through this?',
//     post_type: 'question',
//     tags: ['social-anxiety', 'work', 'meetings'],
//     upvotes: 8,
//     downvotes: 0,
//     comment_count: 15,
//     view_count: 123,
//     is_flagged: false,
//     is_deleted: false,
//     has_best_answer: true,
//     created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
//     updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
//   },
//   {
//     id: '5',
//     user_id: 'user5',
//     title: 'Mindfulness meditation for beginners',
//     content: 'Started meditation 30 days ago using the Headspace app. Sharing my experience and what I\'ve learned for anyone curious about starting.',
//     post_type: 'text',
//     tags: ['meditation', 'mindfulness', 'beginner-tips'],
//     upvotes: 31,
//     downvotes: 1,
//     comment_count: 7,
//     view_count: 156,
//     is_flagged: false,
//     is_deleted: false,
//     has_best_answer: false,
//     created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
//     updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
//   },
//   {
//     id: '6',
//     user_id: 'user6',
//     title: 'My therapy journey - 6 months in',
//     content: 'Wanted to share my experience with therapy for anyone considering it. It\'s been challenging but incredibly helpful. Happy to answer questions.',
//     post_type: 'text',
//     tags: ['therapy', 'mental-health', 'personal-journey'],
//     upvotes: 42,
//     downvotes: 3,
//     comment_count: 23,
//     view_count: 234,
//     is_flagged: false,
//     is_deleted: false,
//     has_best_answer: false,
//     created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
//     updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
//   }
// ];

// // Mock Comments Data
// export const mockComments: PostComment[] = [
//   {
//     id: 'comment1',
//     post_id: '1',
//     user_id: 'user7',
//     content: 'I use the 4-7-8 breathing technique before presentations. Breathe in for 4, hold for 7, out for 8. Really helps calm my nerves!',
//     upvotes: 5,
//     downvotes: 0,
//     is_best_answer: false,
//     is_flagged: false,
//     is_deleted: false,
//     created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
//     updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
//   },
//   {
//     id: 'comment2',
//     post_id: '1',
//     user_id: 'user8',
//     content: 'Practice your presentation out loud at least 3 times. I also write key points on small cards as backup. Preparation reduces anxiety!',
//     upvotes: 8,
//     downvotes: 0,
//     is_best_answer: true,
//     is_flagged: false,
//     is_deleted: false,
//     created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
//     updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
//   },
//   {
//     id: 'comment3',
//     post_id: '1',
//     parent_comment_id: 'comment2',
//     user_id: 'user1',
//     content: 'Thank you! I never thought about using cards as backup. That actually makes me feel less worried about forgetting what to say.',
//     upvotes: 2,
//     downvotes: 0,
//     is_best_answer: false,
//     is_flagged: false,
//     is_deleted: false,
//     created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
//     updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
//   },
//   {
//     id: 'comment4',
//     post_id: '2',
//     user_id: 'user9',
//     content: 'This is amazing! Consistency is so hard. What time do you wake up? I\'m trying to establish a routine too.',
//     upvotes: 3,
//     downvotes: 0,
//     is_best_answer: false,
//     is_flagged: false,
//     is_deleted: false,
//     created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), // 20 hours ago
//     updated_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
//   },
//   {
//     id: 'comment5',
//     post_id: '2',
//     user_id: 'user2',
//     content: 'I wake up at 6:30am! The key for me was starting with just ONE thing (making my bed) and building from there. Don\'t try to do everything at once.',
//     upvotes: 6,
//     downvotes: 0,
//     is_best_answer: false,
//     is_flagged: false,
//     is_deleted: false,
//     created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
//     updated_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
//   }
// ];

// // Mock User Stats Data
// export const mockUserStats: Record<string, UserCommunityStats> = {
//   user1: {
//     user_id: 'user1',
//     posts_count: 3,
//     comments_count: 12,
//     upvotes_received: 45,
//     downvotes_received: 2,
//     reputation_score: 125,
//     helpful_answers_count: 2,
//     best_answers_count: 0,
//     is_verified: false,
//     is_ai_assistant: false,
//     created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
//     updated_at: new Date().toISOString(),
//   },
//   user2: {
//     user_id: 'user2',
//     posts_count: 5,
//     comments_count: 28,
//     upvotes_received: 156,
//     downvotes_received: 3,
//     reputation_score: 385,
//     helpful_answers_count: 8,
//     best_answers_count: 2,
//     is_verified: true,
//     is_ai_assistant: false,
//     created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
//     updated_at: new Date().toISOString(),
//   },
//   user3: {
//     user_id: 'user3',
//     posts_count: 12,
//     comments_count: 67,
//     upvotes_received: 423,
//     downvotes_received: 8,
//     reputation_score: 1250,
//     helpful_answers_count: 15,
//     best_answers_count: 7,
//     is_verified: true,
//     is_ai_assistant: false,
//     created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
//     updated_at: new Date().toISOString(),
//   },
//   ai_assistant: {
//     user_id: 'ai_assistant',
//     posts_count: 0,
//     comments_count: 45,
//     upvotes_received: 234,
//     downvotes_received: 12,
//     reputation_score: 890,
//     helpful_answers_count: 23,
//     best_answers_count: 12,
//     is_verified: true,
//     is_ai_assistant: true,
//     created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
//     updated_at: new Date().toISOString(),
//   }
// };

// // Helper functions to get mock data
// export function getMockPostById(id: string): CommunityPost | undefined {
//   return mockPosts.find(post => post.id === id);
// }

// export function getMockCommentsByPostId(postId: string): PostComment[] {
//   return mockComments.filter(comment => comment.post_id === postId && !comment.parent_comment_id);
// }

// export function getMockRepliesByCommentId(commentId: string): PostComment[] {
//   return mockComments.filter(comment => comment.parent_comment_id === commentId);
// }

// export function getMockUserStats(userId: string): UserCommunityStats | undefined {
//   return mockUserStats[userId];
// }

// // Paginated posts function
// export function getMockPostsPaginated(page: number = 1, limit: number = 10, sortBy: string = 'hot') {
//   let sortedPosts = [...mockPosts];
  
//   switch (sortBy) {
//     case 'new':
//       sortedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
//       break;
//     case 'top':
//       sortedPosts.sort((a, b) => b.upvotes - a.upvotes);
//       break;
//     case 'controversial':
//       sortedPosts.sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes));
//       break;
//     case 'hot':
//     default:
//       // Hot algorithm: factor in upvotes, comments, and recency
//       sortedPosts.sort((a, b) => {
//         const aScore = a.upvotes + (a.comment_count * 0.5) + (1 / ((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60) + 1));
//         const bScore = b.upvotes + (b.comment_count * 0.5) + (1 / ((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60) + 1));
//         return bScore - aScore;
//       });
//       break;
//   }
  
//   const start = (page - 1) * limit;
//   const end = start + limit;
//   const paginatedPosts = sortedPosts.slice(start, end);
  
//   return {
//     posts: paginatedPosts,
//     total_count: sortedPosts.length,
//     page,
//     limit,
//     has_next_page: end < sortedPosts.length
//   };
// }