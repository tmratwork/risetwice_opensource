// src/app/chatbotV11/components/FuturesPathwaysCards.tsx

"use client";

import React, { useState } from 'react';
import {
  MapPin,
  GraduationCap,
  Target,
  Users,
  BookOpen,
  CheckCircle,
  ArrowRight,
  Star
} from 'lucide-react';

interface FuturesPathwaysCardsProps {
  onFunctionCall: (functionName: string, parameters: Record<string, unknown>) => void;
}

interface FuturePathwayFunction {
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
}

const FuturesPathwaysCards: React.FC<FuturesPathwaysCardsProps> = ({ onFunctionCall }) => {
  const [selectedCard, setSelectedCard] = useState<FuturePathwayFunction | null>(null);

  const futuresPathwaysFunctions: FuturePathwayFunction[] = [
    {
      id: 'futures_assessment',
      title: 'Start Your Journey',
      subtitle: 'Discover Your Strengths & Interests',
      description: 'Take a personalized assessment to understand your current situation, interests, and goals. This is your starting point.',
      icon: Star,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      functionName: 'futures_assessment_function',
      benefits: ['Personalized recommendations', 'Identify your strengths', 'Clear next steps']
    },
    {
      id: 'pathway_exploration',
      title: 'Explore Your Options',
      subtitle: 'Career & Educational Paths',
      description: 'Discover career options and educational pathways that match your interests, skills, and current situation.',
      icon: MapPin,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      functionName: 'pathway_exploration_function',
      benefits: ['Match interests to careers', 'Explore education options', 'Consider your situation']
    },
    {
      id: 'educational_guidance',
      title: 'Education Planning',
      subtitle: 'College, Trade School & More',
      description: 'Get detailed information about educational pathways including financial aid, GED programs, and support options.',
      icon: GraduationCap,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      functionName: 'educational_guidance_function',
      benefits: ['Financial aid guidance', 'Compare programs', 'Timeline planning']
    },
    {
      id: 'skill_building',
      title: 'Build Your Skills',
      subtitle: 'Job Readiness & Life Skills',
      description: 'Access modules for resume writing, interview prep, budgeting, communication, and other essential skills.',
      icon: BookOpen,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      functionName: 'skill_building_function',
      benefits: ['Resume & interview help', 'Essential life skills', 'Practice opportunities']
    },
    {
      id: 'goal_planning',
      title: 'Plan Your Goals',
      subtitle: 'Break Down & Track Progress',
      description: 'Turn your big dreams into manageable steps with personalized action plans and progress tracking.',
      icon: Target,
      color: 'from-indigo-500 to-purple-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      textColor: 'text-indigo-700',
      functionName: 'goal_planning_function',
      benefits: ['Clear action steps', 'Progress tracking', 'Stay motivated']
    },
    {
      id: 'resource_connection',
      title: 'Connect & Network',
      subtitle: 'Find Opportunities & Mentors',
      description: 'Discover networking opportunities, volunteer work, internships, and ways to gain experience in your field.',
      icon: Users,
      color: 'from-teal-500 to-green-500',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      textColor: 'text-teal-700',
      functionName: 'resource_connection_function',
      benefits: ['Find mentors', 'Volunteer opportunities', 'Build connections']
    }
  ];

  const handleCardClick = (card: FuturePathwayFunction) => {
    setSelectedCard(card);
  };

  const handleStartFunction = (functionName: string) => {
    // Determine appropriate default parameters for each function
    let parameters: Record<string, unknown> = {};

    switch (functionName) {
      case 'futures_assessment_function':
        parameters = { assessment_area: 'full_assessment' };
        break;
      case 'pathway_exploration_function':
        parameters = { interests: [], education_level: 'in_high_school' };
        break;
      case 'educational_guidance_function':
        parameters = { pathway_type: 'all_options' };
        break;
      case 'skill_building_function':
        parameters = { skill_area: 'all_skills' };
        break;
      case 'goal_planning_function':
        parameters = { goal_description: '', goal_type: 'career_goal' };
        break;
      case 'resource_connection_function':
        parameters = { connection_type: 'all_types', field_of_interest: '' };
        break;
    }

    onFunctionCall(functionName, parameters);
    setSelectedCard(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-900 rounded-lg mb-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Futures Pathways</h1>
        <p className="text-gray-300 text-lg">Your journey to career and educational success starts here</p>
      </div>

      {/* All Options Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">
          Choose Your Path
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {futuresPathwaysFunctions.map((card) => (
            <FunctionCard
              key={card.id}
              card={card}
              onClick={() => handleCardClick(card)}
            />
          ))}
        </div>
      </div>

      {/* Modal for selected card */}
      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onStart={handleStartFunction}
        />
      )}
    </div>
  );
};

interface FunctionCardProps {
  card: FuturePathwayFunction;
  onClick: () => void;
}

const FunctionCard: React.FC<FunctionCardProps> = ({ card, onClick }) => {
  const IconComponent = card.icon;

  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer group transition-all duration-300 transform hover:scale-105 hover:shadow-xl
        bg-gray-800 rounded-2xl p-6 border-2 shadow-lg
        border-gray-600 hover:border-gray-500 hover:shadow-2xl
      `}
    >
      {/* Icon with gradient background */}
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${card.color} mb-4`}>
        <IconComponent className="w-6 h-6 text-white" />
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-gray-100">
            {card.title}
          </h3>
          <p className={`text-sm font-medium text-gray-300`}>
            {card.subtitle}
          </p>
        </div>

        <p className="text-gray-400 text-sm leading-relaxed">
          {card.description}
        </p>

        {/* Arrow indicator */}
        <div className="flex justify-end">
          <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 group-hover:translate-x-1 transition-all duration-200" />
        </div>
      </div>
    </div>
  );
};

interface CardModalProps {
  card: FuturePathwayFunction;
  onClose: () => void;
  onStart: (functionName: string) => void;
}

const CardModal: React.FC<CardModalProps> = ({ card, onClose, onStart }) => {
  const IconComponent = card.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${card.color} p-6 rounded-t-2xl text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <IconComponent className="w-8 h-8 mr-3" />
              <div>
                <h2 className="text-xl font-bold">{card.title}</h2>
                <p className="text-white opacity-90">{card.subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-gray-300 leading-relaxed">
            {card.description}
          </p>

          {/* Benefits */}
          <div>
            <h4 className="font-semibold text-white mb-3">What you&apos;ll get:</h4>
            <div className="space-y-2">
              {card.benefits.map((benefit, index) => (
                <div key={index} className="flex items-center text-sm text-gray-300">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => onStart(card.functionName)}
            className={`w-full bg-gradient-to-r ${card.color} text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
          >
            Start {card.title}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FuturesPathwaysCards;