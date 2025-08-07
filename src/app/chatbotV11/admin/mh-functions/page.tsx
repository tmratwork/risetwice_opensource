'use client';

import React, { useState } from 'react';
import { generateMentalHealthFunctions } from '@/app/chatbotV11/prompts/function-descriptions-mh';
import './styles.css';

interface FunctionParameter {
  type: string;
  description: string;
  options?: string[];
  isRequired: boolean;
}

interface FunctionCard {
  name: string;
  description: string;
  parameters: Record<string, FunctionParameter>;
}

export default function MHFunctionsPage() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  // Transform the technical function definitions into a more readable format
  const functionCards: FunctionCard[] = generateMentalHealthFunctions().map(func => {
    if (func.type !== 'function') return null;
    
    // Extract parameter information
    const parameters: Record<string, FunctionParameter> = {};
    
    if (func.parameters?.properties) {
      Object.entries(func.parameters.properties).forEach(([paramName, paramInfo]: [string, { type?: string; description?: string }]) => {
        // Extract options from the description if available
        let options: string[] = [];
        if (paramInfo.description && paramInfo.description.includes('Options:')) {
          const optionsText = paramInfo.description.split('Options:')[1].trim();
          options = optionsText
            .replace(/"/g, '')
            .split(',')
            .map((opt: string) => {
              // Clean up option text by removing parentheses content
              return opt.replace(/\([^)]*\)/g, '').trim();
            });
        }
        
        parameters[paramName] = {
          type: paramInfo.type || 'text',
          description: paramInfo.description || '',
          options: options.length > 0 ? options : undefined,
          isRequired: Array.isArray(func.parameters?.required) ? func.parameters.required.includes(paramName) : false
        };
      });
    }
    
    return {
      name: func.name,
      description: func.description || '',
      parameters
    };
  }).filter(Boolean) as FunctionCard[];
  
  const toggleCard = (name: string) => {
    if (expandedCard === name) {
      setExpandedCard(null);
    } else {
      setExpandedCard(name);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Mental Health Function Descriptions</h1>
        <p className="text-gray-800 dark:text-gray-200 mb-2 font-medium text-base">
          This page provides a non-technical overview of the functions available to the AI when operating in Mental Health mode.
        </p>
        <p className="text-gray-800 dark:text-gray-200 font-medium text-base">
          Click on each function to see its parameters and details.
        </p>
      </div>
      
      <div className="space-y-4">
        {functionCards.map((func) => (
          <div 
            key={func.name}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
          >
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center"
              onClick={() => toggleCard(func.name)}
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {func.name.replace(/_/g, ' ')}
              </h2>
              <span className="text-gray-900 dark:text-white">
                {expandedCard === func.name ? '▼' : '▶'}
              </span>
            </div>
            
            <div className={`px-4 pb-4 ${expandedCard === func.name ? 'block' : 'hidden'}`}>
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Description</h3>
                <p className="text-gray-800 dark:text-gray-200 font-medium">{func.description}</p>
              </div>
              
              {Object.keys(func.parameters).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Parameters</h3>
                  <div className="space-y-3">
                    {Object.entries(func.parameters).map(([paramName, param]) => (
                      <div key={paramName} className="bg-[var(--bg-color)] p-3 rounded-md">
                        <h4 className="font-bold text-[var(--text-color)] mb-1 text-base">
                          {paramName.replace(/_/g, ' ')}
                          {param.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </h4>
                        <div className="text-[var(--description-color)] text-base mb-2 font-semibold">
                          {param.description}
                        </div>
                        
                        {param.options && param.options.length > 0 && (
                          <div className="mt-2">
                            <h5 className="text-sm font-bold text-[var(--text-color)] mb-1">Options</h5>
                            <div className="flex flex-wrap gap-1">
                              {param.options.map((option, idx) => (
                                <span 
                                  key={idx}
                                  className="inline-block px-2 py-1 text-xs bg-[var(--option-bg)] text-[var(--option-text)] rounded-full font-medium"
                                >
                                  {option}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-base text-[var(--description-color)] font-semibold">
                  <span className="font-bold">When to use:</span> {
                    func.name === 'crisis_response_function' ? 
                      "For ANY mention of suicide, self-harm, or immediate safety concerns." :
                    func.name === 'grounding_function' ? 
                      "When user expresses feeling overwhelmed, panicked, triggered, or disconnected from reality." :
                    func.name === 'thought_exploration_function' ? 
                      "When users express negative beliefs, catastrophizing, or other cognitive distortions." :
                    func.name === 'problem_solving_function' ? 
                      "When users need help breaking down a problem into manageable steps." :
                    func.name === 'screening_function' ? 
                      "After building rapport when symptoms suggest potential benefit." :
                    func.name === 'getUserHistory_function' ? 
                      "To provide more personalized support based on past interactions." :
                    func.name === 'logInteractionOutcome_function' ? 
                      "To track which approaches work best for this user over time." :
                    func.name === 'cultural_humility_function' ? 
                      "When users mention cultural, racial, or identity-specific experiences." :
                    func.name === 'psychoeducation_function' ? 
                      "To offer educational content that helps normalize experiences." :
                    func.name === 'validation_function' ? 
                      "To validate experiences, particularly after vulnerable disclosures." :
                    func.name === 'query_book_content' ? 
                      "When the AI needs specific information from the mental health companion guide." :
                    func.name === 'end_session' ? 
                      "ONLY when the user explicitly indicates they want to end the conversation." :
                    func.name === 'report_technical_error' ? 
                      "ONLY when a previous function call has failed due to a technical issue." :
                    "As needed based on user interaction."
                  }
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}