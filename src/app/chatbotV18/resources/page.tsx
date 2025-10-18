"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  Utensils,
  Heart,
  Stethoscope,
  Briefcase,
  Rainbow,
  Scale,
  GraduationCap,
  Car,
  Shield,
  Users,
  Baby,
  ShoppingBag,
  CheckCircle,
  Phone
} from 'lucide-react';

interface ResourceFunction {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  functionName: string;
  benefits: string[];
  category: string;
}

export default function ResourcesV15Page() {
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<ResourceFunction | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Simple layout debugging functions
  const logMeasurements = (phase: string) => {
    // const timestamp = Date.now();
    const gridRoot = document.querySelector('.v11-layout-root');
    const mainContent = document.querySelector('.main-content-row');
    const footer = document.querySelector('.footer-row');

    // console.log(`[layout-measurements] ResourcesV15Page: phase=${phase}, timestamp=${timestamp}`);
    void phase;
    if (gridRoot) {
      // console.log(`[layout-measurements] v11-layout-root: height=${gridRoot.getBoundingClientRect().height}, scrollHeight=${(gridRoot as HTMLElement).scrollHeight}`);
    }
    if (mainContent) {
      // console.log(`[layout-measurements] main-content-row: height=${mainContent.getBoundingClientRect().height}, scrollHeight=${(mainContent as HTMLElement).scrollHeight}, scrollTop=${(mainContent as HTMLElement).scrollTop}`);
    }
    if (footer) {
      // const rect = footer.getBoundingClientRect();
      // console.log(`[layout-footer] ResourcesV15Page: top=${rect.top}, bottom=${rect.bottom}, viewportHeight=${window.innerHeight}, visible=${rect.bottom <= window.innerHeight}`);
    }
    // console.log(`[layout-measurements] window: innerHeight=${window.innerHeight}, documentScrollTop=${document.documentElement.scrollTop}`);
  };

  useEffect(() => {
    // console.log(`[layout-lifecycle] ResourcesV15Page: state=mounting, timestamp=${Date.now()}`);

    // Initial measurements
    setTimeout(() => logMeasurements('mount'), 100);

    // Scroll logging  
    const handleScroll = () => {
      // console.log(`[layout-scroll] ResourcesV15Page: documentScrollTop=${document.documentElement.scrollTop}, timestamp=${Date.now()}`);
    };

    const handleMainContentScroll = () => {
      const mainContent = document.querySelector('.main-content-row');
      if (mainContent) {
        // console.log(`[layout-scroll] ResourcesV15Page: main-content-row scrollTop=${(mainContent as HTMLElement).scrollTop}, timestamp=${Date.now()}`);
      }
    };

    document.addEventListener('scroll', handleScroll);
    const mainContent = document.querySelector('.main-content-row');
    if (mainContent) {
      mainContent.addEventListener('scroll', handleMainContentScroll);
    }

    // Log static content loaded immediately
    // console.log(`[layout-lifecycle] ResourcesV15Page: state=static-content-loaded, selectedCategory=${selectedCategory}, timestamp=${Date.now()}`);
    setTimeout(() => logMeasurements('static-content-loaded'), 100);

    return () => {
      document.removeEventListener('scroll', handleScroll);
      if (mainContent) {
        mainContent.removeEventListener('scroll', handleMainContentScroll);
      }
    };
  }, []);

  // Log when category changes (simulates dynamic content)
  useEffect(() => {
    // console.log(`[layout-lifecycle] ResourcesV15Page: state=category-changed, selectedCategory=${selectedCategory}, timestamp=${Date.now()}`);
    setTimeout(() => logMeasurements('category-changed'), 100);
  }, [selectedCategory]);

  const resourceFunctions: ResourceFunction[] = [
    // Emergency & Crisis
    {
      id: 'emergency_shelter',
      title: 'Emergency Shelter',
      subtitle: 'Safe Places to Stay Tonight',
      description: 'Find emergency shelters and overnight accommodations specifically for youth experiencing homelessness.',
      icon: Home,
      color: 'from-red-500 to-pink-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      functionName: 'search_resources_unified',
      benefits: ['24/7 safe shelter', 'Youth-specific options', 'Immediate availability check'],
      category: 'emergency'
    },
    {
      id: 'crisis_mental_health',
      title: 'Crisis Support',
      subtitle: '24/7 Mental Health Help',
      description: 'Access immediate mental health crisis resources including hotlines and emergency counseling services.',
      icon: Phone,
      color: 'from-purple-500 to-indigo-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      functionName: 'crisis_mental_health_function',
      benefits: ['24/7 crisis hotlines', 'Text and chat options', 'Immediate support'],
      category: 'emergency'
    },
    {
      id: 'domestic_violence',
      title: 'Safety Resources',
      subtitle: 'Domestic Violence Support',
      description: 'Get help if you\'re experiencing domestic violence, dating violence, or unsafe home situations.',
      icon: Shield,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      functionName: 'domestic_violence_support_function',
      benefits: ['Safety planning', 'Emergency shelter', 'Legal advocacy'],
      category: 'emergency'
    },

    // Basic Needs
    {
      id: 'food_assistance',
      title: 'Food Resources',
      subtitle: 'Food Banks & Meal Programs',
      description: 'Find food banks, pantries, meal programs, and free food resources when you\'re hungry.',
      icon: Utensils,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      functionName: 'search_resources_unified',
      benefits: ['Free meals and groceries', 'No eligibility requirements', 'Multiple locations'],
      category: 'basic_needs'
    },
    {
      id: 'healthcare_access',
      title: 'Healthcare',
      subtitle: 'Free & Low-Cost Medical Care',
      description: 'Locate free and low-cost healthcare services, clinics, and medical resources for uninsured youth.',
      icon: Stethoscope,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      functionName: 'search_resources_unified',
      benefits: ['Free clinics', 'Sliding scale fees', 'Mental health services'],
      category: 'basic_needs'
    },
    {
      id: 'basic_needs',
      title: 'Essential Items',
      subtitle: 'Hygiene & Clothing Resources',
      description: 'Find resources for basic needs like hygiene products, clothing, and essential daily living items.',
      icon: ShoppingBag,
      color: 'from-teal-500 to-green-500',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      textColor: 'text-teal-700',
      functionName: 'search_resources_unified',
      benefits: ['Free clothing', 'Hygiene supplies', 'Personal care items'],
      category: 'basic_needs'
    },

    // Support Services
    {
      id: 'lgbtq_support',
      title: 'LGBTQ+ Support',
      subtitle: 'Safe Spaces & Community',
      description: 'Connect with LGBTQ+ affirming resources, support groups, and community services.',
      icon: Rainbow,
      color: 'from-pink-500 to-purple-500',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200',
      textColor: 'text-pink-700',
      functionName: 'search_resources_unified',
      benefits: ['LGBTQ+ affirming services', 'Peer support groups', 'Safe spaces'],
      category: 'support'
    },
    {
      id: 'substance_abuse',
      title: 'Addiction Support',
      subtitle: 'Treatment & Recovery Resources',
      description: 'Find substance abuse treatment, counseling, and recovery support services.',
      icon: Heart,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      textColor: 'text-indigo-700',
      functionName: 'search_resources_unified',
      benefits: ['Treatment programs', 'Support groups', 'Recovery coaching'],
      category: 'support'
    },
    {
      id: 'young_parent',
      title: 'Young Parent Support',
      subtitle: 'Resources for Teen Parents',
      description: 'Access resources and support services specifically for teen parents and young families.',
      icon: Baby,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-700',
      functionName: 'search_resources_unified',
      benefits: ['Parenting classes', 'Childcare assistance', 'Family support'],
      category: 'support'
    },

    // Development
    {
      id: 'job_search',
      title: 'Job Search Help',
      subtitle: 'Employment & Career Support',
      description: 'Find job search resources, career counseling, and employment opportunities for youth.',
      icon: Briefcase,
      color: 'from-blue-600 to-indigo-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      functionName: 'search_resources_unified',
      benefits: ['Resume help', 'Interview prep', 'Job placement'],
      category: 'development'
    },
    {
      id: 'educational_support',
      title: 'Education Resources',
      subtitle: 'GED, Tutoring & School Support',
      description: 'Access educational resources including GED programs, tutoring, and academic support.',
      icon: GraduationCap,
      color: 'from-green-600 to-teal-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      functionName: 'search_resources_unified',
      benefits: ['GED preparation', 'Tutoring', 'School enrollment help'],
      category: 'development'
    },
    {
      id: 'legal_aid',
      title: 'Legal Help',
      subtitle: 'Free Legal Assistance',
      description: 'Find free legal assistance and advocacy services for youth dealing with legal issues.',
      icon: Scale,
      color: 'from-purple-600 to-indigo-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      functionName: 'search_resources_unified',
      benefits: ['Free legal advice', 'Court advocacy', 'Document help'],
      category: 'development'
    },

    // Community
    {
      id: 'transportation',
      title: 'Transportation',
      subtitle: 'Bus Passes & Ride Programs',
      description: 'Find transportation resources including bus passes and ride programs for essential needs.',
      icon: Car,
      color: 'from-gray-600 to-blue-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-700',
      functionName: 'search_resources_unified',
      benefits: ['Free bus passes', 'Emergency transportation', 'Gas vouchers'],
      category: 'community'
    },
    {
      id: 'community_programs',
      title: 'Community Programs',
      subtitle: 'Activities & Social Support',
      description: 'Discover recreational activities, community programs, and positive youth development opportunities.',
      icon: Users,
      color: 'from-teal-600 to-green-600',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      textColor: 'text-teal-700',
      functionName: 'search_resources_unified',
      benefits: ['Social activities', 'Skill building', 'Community connections'],
      category: 'community'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Resources' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'basic_needs', label: 'Basic Needs' },
    { id: 'support', label: 'Support' },
    { id: 'development', label: 'Development' },
    { id: 'community', label: 'Community' }
  ];

  const filteredResources = selectedCategory === 'all'
    ? resourceFunctions
    : resourceFunctions.filter(resource => resource.category === selectedCategory);

  // Helper function for resource greeting debugging - using single consistent prefix
  const logResourceGreeting = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
      console.log(`[resource_greeting] ${message}`, ...args);
    }
  };

  const handleResourceSelection = (resourceCard: ResourceFunction, parameters: Record<string, unknown>) => {
    logResourceGreeting('🎯 SELECTION: handleResourceSelection called', {
      resourceCardId: resourceCard.id,
      resourceCardTitle: resourceCard.title,
      functionName: resourceCard.functionName,
      parameters,
      timestamp: Date.now()
    });

    logResourceGreeting('🎯 SELECTION: ✅ BUG FIXED - Using direct resource card instead of lookup', {
      selectedResourceId: resourceCard.id,
      selectedResourceTitle: resourceCard.title,
      selectedFunctionName: resourceCard.functionName
    });

    logResourceGreeting('🎯 SELECTION: Creating resource context for selected card', {
      cardId: resourceCard.id,
      cardTitle: resourceCard.title,
      cardFunctionName: resourceCard.functionName
    });

    // Store resource locator context in sessionStorage
    const resourceContext = {
      source: 'resource_locator',
      timestamp: Date.now(),
      mode: 'resource_locator',
      selectedResource: {
        id: resourceCard.id,
        title: resourceCard.title,
        subtitle: resourceCard.subtitle,
        description: resourceCard.description,
        functionName: resourceCard.functionName,
        category: resourceCard.category,
        parameters: parameters
      }
    };

    logResourceGreeting('🎯 SELECTION: Storing resource context in sessionStorage', {
      resourceId: resourceContext.selectedResource.id,
      resourceTitle: resourceContext.selectedResource.title,
      contextStringified: JSON.stringify(resourceContext),
      contextLength: JSON.stringify(resourceContext).length
    });

    sessionStorage.setItem('resourceLocatorContext', JSON.stringify(resourceContext));

    logResourceGreeting('🎯 SELECTION: ✅ Resource context stored successfully');

    // Navigate to V16 chat page
    logResourceGreeting('🎯 SELECTION: Navigating to /chatbotV16');
    router.push('/chatbotV16');
  };

  const handleCardClick = (card: ResourceFunction) => {
    logResourceGreeting('🖱️ CLICK: handleCardClick called', {
      clickedCardId: card.id,
      clickedCardTitle: card.title,
      clickedCardFunctionName: card.functionName,
      timestamp: Date.now()
    });
    setSelectedCard(card);
  };

  const handleStart = () => {
    if (!selectedCard) {
      logResourceGreeting('🚀 START: ❌ No selectedCard available');
      return;
    }

    logResourceGreeting('🚀 START: handleStart called', {
      selectedCardId: selectedCard.id,
      selectedCardTitle: selectedCard.title,
      selectedCardFunctionName: selectedCard.functionName,
      timestamp: Date.now()
    });

    // Get default parameters for the function
    const defaultParameters: Record<string, Record<string, unknown>> = {
      emergency_shelter_function: { location: "user_location", urgency: "immediate" },
      crisis_mental_health_function: { crisis_type: "general", urgency: "immediate" },
      domestic_violence_support_function: { safety_level: "immediate", location: "user_location" },
      food_assistance_function: { assistance_type: "immediate", family_size: 1 },
      healthcare_access_function: { service_type: "general", insurance_status: "uninsured" },
      basic_needs_assistance_function: { need_type: "hygiene_clothing", urgency: "immediate" },
      lgbtq_support_function: { support_type: "general", age_group: "youth" },
      substance_abuse_support_function: { treatment_type: "general", stage: "seeking_help" },
      young_parent_support_function: { parent_age: "teen", child_age: "infant" },
      job_search_assistance_function: { experience_level: "entry", job_type: "any" },
      educational_support_function: { education_level: "ged", support_type: "general" },
      legal_aid_function: { legal_issue: "general", urgency: "non_emergency" },
      transportation_assistance_function: { transport_need: "general", urgency: "immediate" },
      community_programs_function: { program_type: "general", age_group: "youth" }
    };

    const parameters = defaultParameters[selectedCard.functionName] || {};

    logResourceGreeting('🚀 START: About to call handleResourceSelection with selectedCard', {
      selectedCardId: selectedCard.id,
      selectedCardTitle: selectedCard.title,
      functionName: selectedCard.functionName,
      parameters,
      defaultParametersFound: !!defaultParameters[selectedCard.functionName]
    });

    handleResourceSelection(selectedCard, parameters);
    setSelectedCard(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 pt-20 bg-[var(--bg-primary)] min-h-screen">
      <div className="pb-24">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Find Support Resources</h1>
          <p className="text-[var(--text-secondary)]">Connect with local resources and support services for youth</p>
        </div>

        {/* Building in Public Notice */}
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Building in Public</h3>
          <p className="text-blue-700 text-sm">
            We are working with local organizations to increase the awareness of vital resources. This page is an early beta to encourage feedback on what works, and what to improve.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === category.id
                ? 'bg-[var(--button-primary)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
                }`}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Resource Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource) => {
            const IconComponent = resource.icon;
            return (
              <div
                key={resource.id}
                onClick={() => handleCardClick(resource)}
                className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 hover:bg-[var(--bg-secondary)] transition-all duration-200 cursor-pointer transform hover:scale-105 hover:shadow-lg"
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-r ${resource.color}`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">{resource.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-2">{resource.subtitle}</p>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{resource.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal */}
        {selectedCard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--bg-secondary)] rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className={`p-6 bg-gradient-to-r ${selectedCard.color} rounded-t-xl`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <selectedCard.icon className="w-8 h-8 mr-3 text-white" />
                    <div>
                      <h2 className="text-xl font-bold text-white">{selectedCard.title}</h2>
                      <p className="text-white opacity-90">{selectedCard.subtitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCard(null)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {selectedCard.description}
                </p>

                {/* Benefits */}
                <div>
                  <h4 className="font-semibold text-[var(--text-primary)] mb-3">What you&apos;ll get:</h4>
                  <div className="space-y-2">
                    {selectedCard.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center text-sm text-[var(--text-secondary)]">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {benefit}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => handleStart()}
                  className={`w-full bg-gradient-to-r ${selectedCard.color} text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
                >
                  Find {selectedCard.title}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}