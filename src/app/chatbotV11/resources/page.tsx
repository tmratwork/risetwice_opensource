"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import ResourceLocatorCards from '../components/ResourceLocatorCards';

export default function ResourcesPage() {
  const router = useRouter();

  const handleResourceSelection = (functionName: string, parameters: Record<string, unknown>) => {
    console.log('[ResourceLocator] handleResourceSelection called with:', { functionName, parameters });
    // Find the specific resource card data
    const resourceCards = [
      {
        id: 'emergency_shelter',
        title: 'Emergency Shelter',
        subtitle: 'Safe Places to Stay Tonight',
        description: 'Find emergency shelters and overnight accommodations specifically for youth experiencing homelessness.',
        functionName: 'emergency_shelter_function',
        category: 'emergency'
      },
      {
        id: 'crisis_mental_health',
        title: 'Crisis Support',
        subtitle: '24/7 Mental Health Help',
        description: 'Access immediate mental health crisis resources including hotlines and emergency counseling services.',
        functionName: 'crisis_mental_health_function',
        category: 'emergency'
      },
      {
        id: 'domestic_violence',
        title: 'Safety Resources',
        subtitle: 'Domestic Violence Support',
        description: 'Get help if you\'re experiencing domestic violence, dating violence, or unsafe home situations.',
        functionName: 'domestic_violence_support_function',
        category: 'emergency'
      },
      {
        id: 'food_assistance',
        title: 'Food Resources',
        subtitle: 'Food Banks & Meal Programs',
        description: 'Find food banks, pantries, meal programs, and free food resources when you\'re hungry.',
        functionName: 'food_assistance_function',
        category: 'basic_needs'
      },
      {
        id: 'healthcare_access',
        title: 'Healthcare',
        subtitle: 'Free & Low-Cost Medical Care',
        description: 'Locate free and low-cost healthcare services, clinics, and medical resources for uninsured youth.',
        functionName: 'healthcare_access_function',
        category: 'basic_needs'
      },
      {
        id: 'basic_needs',
        title: 'Essential Items',
        subtitle: 'Hygiene & Clothing Resources',
        description: 'Find resources for basic needs like hygiene products, clothing, and essential daily living items.',
        functionName: 'basic_needs_assistance_function',
        category: 'basic_needs'
      },
      {
        id: 'lgbtq_support',
        title: 'LGBTQ+ Support',
        subtitle: 'Safe Spaces & Community',
        description: 'Connect with LGBTQ+ affirming resources, support groups, and community services.',
        functionName: 'lgbtq_support_function',
        category: 'support'
      },
      {
        id: 'substance_abuse',
        title: 'Addiction Support',
        subtitle: 'Treatment & Recovery Resources',
        description: 'Find substance abuse treatment, counseling, and recovery support services.',
        functionName: 'substance_abuse_support_function',
        category: 'support'
      },
      {
        id: 'young_parent',
        title: 'Young Parent Support',
        subtitle: 'Resources for Teen Parents',
        description: 'Access resources and support services specifically for teen parents and young families.',
        functionName: 'young_parent_support_function',
        category: 'support'
      },
      {
        id: 'job_search',
        title: 'Job Search Help',
        subtitle: 'Employment & Career Support',
        description: 'Find job search resources, career counseling, and employment opportunities for youth.',
        functionName: 'job_search_assistance_function',
        category: 'development'
      },
      {
        id: 'educational_support',
        title: 'Education Resources',
        subtitle: 'GED, Tutoring & School Support',
        description: 'Access educational resources including GED programs, tutoring, and academic support.',
        functionName: 'educational_support_function',
        category: 'development'
      },
      {
        id: 'legal_aid',
        title: 'Legal Help',
        subtitle: 'Free Legal Assistance',
        description: 'Find free legal assistance and advocacy services for youth dealing with legal issues.',
        functionName: 'legal_aid_function',
        category: 'development'
      },
      {
        id: 'transportation',
        title: 'Transportation',
        subtitle: 'Bus Passes & Ride Programs',
        description: 'Find transportation resources including bus passes and ride programs for essential needs.',
        functionName: 'transportation_assistance_function',
        category: 'community'
      },
      {
        id: 'community_programs',
        title: 'Community Programs',
        subtitle: 'Activities & Social Support',
        description: 'Discover recreational activities, community programs, and positive youth development opportunities.',
        functionName: 'community_programs_function',
        category: 'community'
      }
    ];

    // Find the selected resource card
    const selectedCard = resourceCards.find(card => card.functionName === functionName);
    console.log('[ResourceLocator] Found selected card:', selectedCard);

    if (selectedCard) {
      console.log('[ResourceLocator] Creating resource context for selected card');
      // Store resource locator context in sessionStorage
      const resourceContext = {
        source: 'resource_locator',
        timestamp: Date.now(),
        mode: 'resource_locator',
        selectedResource: {
          id: selectedCard.id,
          title: selectedCard.title,
          subtitle: selectedCard.subtitle,
          description: selectedCard.description,
          functionName: selectedCard.functionName,
          category: selectedCard.category,
          parameters: parameters
        }
      };

      sessionStorage.setItem('resourceLocatorContext', JSON.stringify(resourceContext));
      console.log('[ResourceLocator] Stored resource context in sessionStorage:', resourceContext);
      
      // Navigate to chat page
      console.log('[ResourceLocator] Navigating to chat page');
      router.push('/chatbotV11');
    } else {
      console.error('[ResourceLocator] No matching card found for functionName:', functionName);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-16 pb-20">
      <div className="container mx-auto px-4">
        <ResourceLocatorCards onFunctionCall={handleResourceSelection} />
      </div>
    </div>
  );
}