"use client";

import React from 'react';
import UserProfileDisplay from '@/components/UserProfileDisplay';

// Sample user profile data
const sampleUserProfile = {
  profile: {
    goals: {
      work: "increase productivity and motivation",
      motivation: "find ways to get out of bed and start the day"
    },
    triggers: {
      intensity: {
        "AI errors": 3,
        "work challenges": 3,
        "brother's mental health": 4
      },
      identified: [
        "brother's mental health",
        "work challenges",
        "AI errors"
      ]
    },
    engagement: {
      topics: [
        "motivation",
        "mental health support",
        "work challenges"
      ],
      intensity: {
        motivation: 4,
        "work challenges": 4,
        "mental health support": 5
      }
    },
    preferences: {
      communication: {
        style: "direct and practical",
        support: "practical advice over theoretical"
      }
    },
    personal_details: {
      work: {
        details: "involves coding",
        location: "Michigan",
        challenges: "lack of motivation"
      },
      relationships: {
        brother: {
          location: "New York",
          mental_health: {
            treatment: [
              "therapist",
              "psychiatrist"
            ],
            conditions: [
              "depression",
              "anxiety"
            ]
          },
          employment_status: "unemployed"
        }
      },
      living_situation: {
        location: "Michigan"
      }
    },
    confidence_levels: {
      goals: "high",
      personal_details: "high",
      coping_strategies: "medium",
      health_information: "medium"
    },
    coping_strategies: {
      employed: [
        "taking walks",
        "listening to music",
        "establishing a routine"
      ],
      mentioned: [
        "breathing exercises",
        "grounding techniques",
        "breaking tasks into smaller steps",
        "setting small goals",
        "rewarding oneself"
      ]
    },
    emotional_patterns: {
      patterns: [
        "fluctuating motivation",
        "anxiety related to brother's condition",
        "frustration with AI errors"
      ],
      intensity: {
        anxiety: 4,
        motivation: 3,
        frustration: 3
      }
    },
    health_information: {
      symptoms: [
        "tiredness",
        "sore back",
        "acute anxiety",
        "panic attacks",
        "lack of motivation"
      ],
      conditions: [
        "depression",
        "anxiety"
      ],
      treatments: [
        "breathing exercises",
        "grounding techniques"
      ]
    },
    emotional_responses: {
      to_interventions: {
        "practical advice": "preferred",
        "breathing exercises": "calming",
        "grounding techniques": "helpful"
      }
    },
    conversation_dynamics: {
      openness: 4,
      engagement: 4,
      resistance: 3
    }
  },
  version: 39,
  lastUpdated: "2025-05-11T02:03:17.891617+00:00",
  lastAnalyzed: "2025-05-11T02:03:17.829+00:00"
};

export default function ProfileTestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">User Profile Display Test</h1>
      
      <UserProfileDisplay 
        profileData={sampleUserProfile.profile} 
        lastUpdated={sampleUserProfile.lastUpdated} 
      />
      
      <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">About This Component</h2>
        <p className="mb-4">
          This component dynamically renders any user profile data structure without making assumptions about fields.
          It handles nested objects and arrays, and applies appropriate styling and icons based on field names.
        </p>
        <h3 className="text-lg font-medium mb-2">Features:</h3>
        <ul className="list-disc ml-6 space-y-2">
          <li>Fully responsive layout - adapts to any screen size</li>
          <li>Supports dark/light mode</li>
          <li>Automatically formats timestamps</li>
          <li>Intelligently selects icons based on data categories</li>
          <li>Provides appropriate formatting for different data types</li>
          <li>Handles arbitrarily nested objects and arrays</li>
        </ul>
      </div>
    </div>
  );
}