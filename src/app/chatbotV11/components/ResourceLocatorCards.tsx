// src/app/chatbotV11/components/ResourceLocatorCards.tsx

"use client";

import React, { useState } from 'react';
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
    Activity,
    CheckCircle,
    ArrowRight,
    Phone
} from 'lucide-react';

interface ResourceLocatorCardsProps {
    onFunctionCall: (functionName: string, parameters: Record<string, unknown>) => void;
}

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

const ResourceLocatorCards: React.FC<ResourceLocatorCardsProps> = ({ onFunctionCall }) => {
    const [selectedCard, setSelectedCard] = useState<ResourceFunction | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

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
            functionName: 'emergency_shelter_function',
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
            functionName: 'food_assistance_function',
            benefits: ['Free food pantries', 'Hot meal programs', 'Grocery assistance'],
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
            functionName: 'healthcare_access_function',
            benefits: ['Free clinics', 'Mental health care', 'Prescription assistance'],
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
            functionName: 'basic_needs_assistance_function',
            benefits: ['Hygiene products', 'Free clothing', 'Essential supplies'],
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
            functionName: 'lgbtq_support_function',
            benefits: ['Affirming counseling', 'Support groups', 'Safe community spaces'],
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
            functionName: 'substance_abuse_support_function',
            benefits: ['Treatment programs', 'Support groups', 'Recovery housing'],
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
            functionName: 'young_parent_support_function',
            benefits: ['Parenting classes', 'Childcare assistance', 'Baby supplies'],
            category: 'support'
        },

        // Life Development
        {
            id: 'job_search',
            title: 'Job Search Help',
            subtitle: 'Employment & Career Support',
            description: 'Find job search resources, career counseling, and employment opportunities for youth.',
            icon: Briefcase,
            color: 'from-blue-500 to-indigo-500',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            textColor: 'text-blue-700',
            functionName: 'job_search_assistance_function',
            benefits: ['Resume help', 'Interview prep', 'Job placement'],
            category: 'development'
        },
        {
            id: 'educational_support',
            title: 'Education Resources',
            subtitle: 'GED, Tutoring & School Support',
            description: 'Access educational resources including GED programs, tutoring, and academic support.',
            icon: GraduationCap,
            color: 'from-green-500 to-teal-500',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            textColor: 'text-green-700',
            functionName: 'educational_support_function',
            benefits: ['GED programs', 'Free tutoring', 'Alternative schools'],
            category: 'development'
        },
        {
            id: 'legal_aid',
            title: 'Legal Help',
            subtitle: 'Free Legal Assistance',
            description: 'Find free legal assistance and advocacy services for youth dealing with legal issues.',
            icon: Scale,
            color: 'from-gray-500 to-slate-500',
            bgColor: 'bg-gray-50',
            borderColor: 'border-gray-200',
            textColor: 'text-gray-700',
            functionName: 'legal_aid_function',
            benefits: ['Free legal advice', 'Court advocacy', 'Rights education'],
            category: 'development'
        },

        // Community & Transportation
        {
            id: 'transportation',
            title: 'Transportation',
            subtitle: 'Bus Passes & Ride Programs',
            description: 'Find transportation resources including bus passes and ride programs for essential needs.',
            icon: Car,
            color: 'from-violet-500 to-purple-500',
            bgColor: 'bg-violet-50',
            borderColor: 'border-violet-200',
            textColor: 'text-violet-700',
            functionName: 'transportation_assistance_function',
            benefits: ['Bus passes', 'Ride vouchers', 'Gas assistance'],
            category: 'community'
        },
        {
            id: 'community_programs',
            title: 'Community Programs',
            subtitle: 'Activities & Social Support',
            description: 'Discover recreational activities, community programs, and positive youth development opportunities.',
            icon: Users,
            color: 'from-emerald-500 to-teal-500',
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200',
            textColor: 'text-emerald-700',
            functionName: 'community_programs_function',
            benefits: ['After-school programs', 'Sports leagues', 'Social activities'],
            category: 'community'
        }
    ];

    const categories = [
        { id: 'all', name: 'All Resources', icon: Activity },
        { id: 'emergency', name: 'Emergency & Crisis', icon: Phone },
        { id: 'basic_needs', name: 'Basic Needs', icon: Utensils },
        { id: 'support', name: 'Support Services', icon: Heart },
        { id: 'development', name: 'Life Development', icon: GraduationCap },
        { id: 'community', name: 'Community & Transport', icon: Users }
    ];

    const filteredFunctions = selectedCategory === 'all'
        ? resourceFunctions
        : resourceFunctions.filter(func => func.category === selectedCategory);

    const handleCardClick = (card: ResourceFunction) => {
        console.log('[ResourceLocator] Card clicked:', card.title, card.functionName);
        setSelectedCard(card);
    };

    const handleStartFunction = (functionName: string) => {
        console.log('[ResourceLocator] handleStartFunction called with:', functionName);
        // Determine appropriate default parameters for each function
        let parameters: Record<string, unknown> = {};

        switch (functionName) {
            case 'emergency_shelter_function':
                parameters = { urgency_level: 'tonight', location: '' };
                break;
            case 'food_assistance_function':
                parameters = { food_type: 'any_food_help', location: '' };
                break;
            case 'crisis_mental_health_function':
                parameters = { crisis_severity: 'moderate_concern', crisis_type: 'general_distress' };
                break;
            case 'healthcare_access_function':
                parameters = { healthcare_need: 'general_checkup', location: '' };
                break;
            case 'job_search_assistance_function':
                parameters = { experience_level: 'no_experience', location: '' };
                break;
            case 'lgbtq_support_function':
                parameters = { support_type: 'support_groups', location: '' };
                break;
            case 'legal_aid_function':
                parameters = { legal_issue: 'general_legal_help', location: '' };
                break;
            case 'educational_support_function':
                parameters = { education_need: 'ged_program', location: '' };
                break;
            case 'transportation_assistance_function':
                parameters = { transportation_need: 'general_mobility', location: '' };
                break;
            case 'substance_abuse_support_function':
                parameters = { support_type: 'counseling', location: '' };
                break;
            case 'young_parent_support_function':
                parameters = { parent_type: 'young_parent', support_needed: 'parenting_classes', location: '' };
                break;
            case 'domestic_violence_support_function':
                parameters = { situation_type: 'unsafe_home', safety_level: 'safety_planning', resource_type: 'safety_planning' };
                break;
            case 'basic_needs_assistance_function':
                parameters = { need_type: 'hygiene_products', location: '' };
                break;
            case 'community_programs_function':
                parameters = { program_type: 'after_school', location: '' };
                break;
        }

        console.log('[ResourceLocator] Calling onFunctionCall with:', { functionName, parameters });
        onFunctionCall(functionName, parameters);
        setSelectedCard(null);
        console.log('[ResourceLocator] Modal closed, card selection completed');
    };

    return (
        <div className="max-w-6xl mx-auto p-6 bg-gray-900 rounded-lg mb-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Resource Locator</h1>
                <p className="text-gray-300 text-lg">Find the support and resources you need right now</p>
            </div>

            {/* Category Filters */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">Browse by Category</h2>
                <div className="flex flex-wrap gap-3">
                    {categories.map((category) => {
                        const IconComponent = category.icon;
                        return (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`
                  flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${selectedCategory === category.id
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }
                `}
                            >
                                <IconComponent className="w-4 h-4 mr-2" />
                                {category.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Resource Cards Section */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-4">
                    {selectedCategory === 'all' ? 'All Resources' : categories.find(c => c.id === selectedCategory)?.name}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredFunctions.map((card) => (
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
    card: ResourceFunction;
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
    card: ResourceFunction;
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
                        Find {card.title}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResourceLocatorCards;