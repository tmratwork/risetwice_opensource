"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import FuturesPathwaysCards from '../../chatbotV11/components/FuturesPathwaysCards';

export default function FuturePathwaysV15Page() {
  const router = useRouter();

  const handlePathwaySelection = (functionName: string, parameters: Record<string, unknown>) => {
    console.log('[FuturePathwaysV15] handlePathwaySelection called with:', { functionName, parameters });
    // Find the specific pathway card data
    const pathwayCards = [
      {
        id: 'futures_assessment',
        title: 'Start Your Journey',
        subtitle: 'Discover Your Strengths & Interests',
        description: 'Take a personalized assessment to understand your current situation, interests, and goals. This is your starting point.',
        functionName: 'futures_assessment_function',
        category: 'assessment'
      },
      {
        id: 'pathway_exploration',
        title: 'Explore Your Options',
        subtitle: 'Career & Educational Paths',
        description: 'Discover career options and educational pathways that match your interests, skills, and current situation.',
        functionName: 'pathway_exploration_function',
        category: 'exploration'
      },
      {
        id: 'educational_guidance',
        title: 'Education Planning',
        subtitle: 'College, Trade School & More',
        description: 'Get detailed information about educational pathways including financial aid, GED programs, and support options.',
        functionName: 'educational_guidance_function',
        category: 'education'
      },
      {
        id: 'skill_building',
        title: 'Build Your Skills',
        subtitle: 'Job Readiness & Life Skills',
        description: 'Access modules for resume writing, interview prep, budgeting, communication, and other essential skills.',
        functionName: 'skill_building_function',
        category: 'skills'
      },
      {
        id: 'goal_planning',
        title: 'Plan Your Goals',
        subtitle: 'Break Down & Track Progress',
        description: 'Turn your big dreams into manageable steps with personalized action plans and progress tracking.',
        functionName: 'goal_planning_function',
        category: 'planning'
      },
      {
        id: 'resource_connection',
        title: 'Connect & Network',
        subtitle: 'Find Opportunities & Mentors',
        description: 'Discover networking opportunities, volunteer work, internships, and ways to gain experience in your field.',
        functionName: 'resource_connection_function',
        category: 'networking'
      }
    ];

    // Find the selected pathway card
    const selectedCard = pathwayCards.find(card => card.functionName === functionName);
    console.log('[FuturePathwaysV15] Found selected card:', selectedCard);

    if (selectedCard) {
      console.log('[FuturePathwaysV15] Creating pathway context for selected card');
      // Store future pathways context in sessionStorage
      const pathwayContext = {
        source: 'future_pathways',
        timestamp: Date.now(),
        mode: 'future_pathways',
        selectedPathway: {
          id: selectedCard.id,
          title: selectedCard.title,
          subtitle: selectedCard.subtitle,
          description: selectedCard.description,
          functionName: selectedCard.functionName,
          category: selectedCard.category,
          parameters: parameters
        }
      };

      sessionStorage.setItem('futurePathwaysContext', JSON.stringify(pathwayContext));
      console.log('[FuturePathwaysV15] Stored pathway context in sessionStorage:', pathwayContext);
      
      // Navigate to V15 chat page instead of V11
      console.log('[FuturePathwaysV15] Navigating to V15 chat page');
      router.push('/chatbotV15');
    } else {
      console.error('[FuturePathwaysV15] No matching card found for functionName:', functionName);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-16 pb-20">
      <div className="container mx-auto px-4">
        <FuturesPathwaysCards onFunctionCall={handlePathwaySelection} />
      </div>
    </div>
  );
}