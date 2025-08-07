// src/app/chatbotV11/prompts/function-descriptions-mh.ts

"use client";

import { GPTFunction } from '@/hooksV15/functions/use-book-functions-v15';

/**
 * Generates the mental health function descriptions for the WebRTC service
 */
export function generateMentalHealthFunctions(): GPTFunction[] {
  return [
    // =======================
    // MENTAL HEALTH FUNCTIONS
    // Grounding function for distress management
    {
      type: 'function',
      name: "grounding_function",
      description: "Retrieves appropriate grounding techniques based on distress level and technique type",
      parameters: {
        type: "object",
        properties: {
          distress_level: {
            type: "string",
            description: "The current distress level of the user (low, medium, high)",
            enum: ["low", "medium", "high"]
          },
          technique_type: {
            type: "string",
            description: "Optional: The specific type of grounding technique to retrieve",
            enum: ["5-4-3-2-1", "body_scan", "breathing", "physical", "mental", "present_moment"]
          }
        },
        required: ["distress_level"]
      }
    },

    // Thought exploration function for CBT
    {
      type: 'function',
      name: "thought_exploration_function",
      description: "Provides cognitive behavioral techniques for exploring and challenging thought patterns",
      parameters: {
        type: "object",
        properties: {
          thought_type: {
            type: "string",
            description: "The type of thoughts to explore",
            enum: ["catastrophizing", "black_and_white", "mind_reading", "fortune_telling",
              "emotional_reasoning", "should_statements", "personalization", "filtering",
              "overgeneralization", "automatic"]
          },
          related_emotion: {
            type: "string",
            description: "Optional: The emotion related to these thoughts",
            enum: ["anxiety", "depression", "anger", "shame", "guilt", "grief", "fear"]
          }
        },
        required: ["thought_type"]
      }
    },

    // Problem-solving function
    {
      type: 'function',
      name: "problem_solving_function",
      description: "Provides structured problem-solving techniques for different types of issues",
      parameters: {
        type: "object",
        properties: {
          problem_category: {
            type: "string",
            description: "The category of problem to address",
            enum: ["relationship", "academic", "work", "decision_making", "stress", "basic_needs",
              "social", "health", "financial", "time_management"]
          },
          complexity: {
            type: "string",
            description: "Optional: The complexity level of the problem",
            enum: ["simple", "moderate", "complex"]
          }
        },
        required: ["problem_category"]
      }
    },

    // Screening assessment function
    {
      type: 'function',
      name: "screening_function",
      description: "Retrieves appropriate screening questions and tools for mental health concerns",
      parameters: {
        type: "object",
        properties: {
          concern_area: {
            type: "string",
            description: "The area of concern to screen for",
            enum: ["depression", "anxiety", "trauma", "substance_use", "eating_disorders",
              "sleep", "stress", "suicide_risk", "psychosis", "mood"]
          },
          assessment_purpose: {
            type: "string",
            description: "Optional: The purpose of the assessment",
            enum: ["initial_screening", "progress_monitoring", "severity_assessment", "symptom_tracking"]
          }
        },
        required: ["concern_area"]
      }
    },

    // Crisis response function
    {
      type: 'function',
      name: "crisis_response_function",
      description: "Retrieves crisis response protocols for various types of mental health crises",
      parameters: {
        type: "object",
        properties: {
          crisis_type: {
            type: "string",
            description: "The type of crisis situation",
            enum: ["suicide", "self_harm", "panic_attack", "flashback", "dissociation",
              "aggression", "substance_overdose", "psychosis"]
          },
          urgency_level: {
            type: "string",
            description: "The urgency level of the crisis",
            enum: ["immediate", "urgent", "concerning"]
          }
        },
        required: ["crisis_type", "urgency_level"]
      }
    },

    // User history retrieval function
    {
      type: 'function',
      name: "getUserHistory_function",
      description: "Retrieves information about the user's history and patterns",
      parameters: {
        type: "object",
        properties: {
          history_type: {
            type: "string",
            description: "The type of history information to retrieve",
            enum: ["function_effectiveness", "communication_preferences", "skill_progress", "recent_interactions"]
          }
        },
        required: ["history_type"]
      }
    },

    // Interaction outcome logging function
    {
      type: 'function',
      name: "logInteractionOutcome_function",
      description: "Logs the outcome of different approaches or interventions",
      parameters: {
        type: "object",
        properties: {
          approach_used: {
            type: "string",
            description: "The approach or technique that was used"
          },
          effectiveness_rating: {
            type: "string",
            description: "The effectiveness of the approach",
            enum: ["high", "medium", "low", "unclear"]
          },
          user_engagement: {
            type: "string",
            description: "Optional: The user's level of engagement",
            enum: ["actively_engaged", "somewhat_engaged", "minimal_engagement", "resistant"]
          }
        },
        required: ["approach_used", "effectiveness_rating"]
      }
    },

    // Cultural humility function
    {
      type: 'function',
      name: "cultural_humility_function",
      description: "Provides culturally responsive approaches for various identity areas",
      parameters: {
        type: "object",
        properties: {
          identity_area: {
            type: "string",
            description: "The identity area to consider",
            enum: ["race", "ethnicity", "gender", "sexuality", "religion", "disability",
              "age", "socioeconomic", "language", "indigenous", "immigrant"]
          },
          resource_type: {
            type: "string",
            description: "Optional: The type of resources needed",
            enum: ["education", "support_groups", "service_providers", "advocacy", "community"]
          }
        },
        required: ["identity_area"]
      }
    },

    // Psychoeducation function
    {
      type: 'function',
      name: "psychoeducation_function",
      description: "Provides psychoeducational information about mental health topics",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "The mental health topic to explain",
            enum: ["depression", "anxiety", "trauma", "substance_use", "eating_disorders",
              "sleep", "stress", "self_care", "medication", "therapy", "coping_skills",
              "emotional_regulation", "boundaries", "relationships", "communication"]
          },
          information_type: {
            type: "string",
            description: "Optional: The type of information needed",
            enum: ["symptoms", "causes", "treatment", "neuroscience", "course", "prevention", "impact"]
          }
        },
        required: ["topic"]
      }
    },

    // Validation function
    {
      type: 'function',
      name: "validation_function",
      description: "Provides validation techniques for different emotions and experiences",
      parameters: {
        type: "object",
        properties: {
          emotion: {
            type: "string",
            description: "The emotion or experience to validate",
            enum: ["anxiety", "depression", "anger", "shame", "guilt", "grief", "fear",
              "loneliness", "overwhelm", "worthlessness", "helplessness", "rejection"]
          },
          validation_type: {
            type: "string",
            description: "Optional: The type of validation approach",
            enum: ["acknowledge", "normalize", "accept", "understand", "respect"]
          }
        },
        required: ["emotion"]
      }
    },

    // ========================
    // Resource search function
    {
      type: 'function',
      name: "resource_search_function",
      description: "Searches the web for mental health resources, services, and information. USE THIS FUNCTION WHENEVER a user asks to search, find, or look up resources or information. This is your PRIMARY CAPABILITY for retrieving up-to-date information from the web - you CAN search the web through this function. AUTOMATICALLY displays resources on a map when addresses are found - no need to call display_map_function separately.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query for the type of resource or information needed (REQUIRED). Extract this directly from user's request."
          },
          resource_type: {
            type: "string",
            description: "Specific category of resource. ALWAYS include this if user mentions a specific type of resource.",
            enum: ["crisis_hotline", "therapy", "support_group", "substance_abuse",
              "community_service", "educational", "financial_assistance", "housing",
              "medical", "legal", "food", "clothing", "transportation", "other"]
          },
          location_specific: {
            type: "boolean",
            description: "Set to true if user mentions a specific location or asks for 'nearby' resources. Default to true when location is provided."
          },
          location: {
            type: "string",
            description: "The location to search for resources (city, state, or region). ALWAYS include this if user mentions a location."
          },
          mapView: {
            type: "boolean",
            description: "Whether to prepare the results for map visualization. Set to true for physical resources like shelters or clinics."
          }
        },
        required: ["query"]
      }
    },

    // Resource feedback function
    {
      type: 'function',
      name: "resource_feedback_function",
      description: "Collects feedback about the resources provided to improve future recommendations",
      parameters: {
        type: "object",
        properties: {
          searchId: {
            type: "string",
            description: "The ID of the search to provide feedback on"
          },
          helpful: {
            type: "boolean",
            description: "Whether the resources were helpful"
          },
          resource_name: {
            type: "string",
            description: "Optional: Specific resource name if feedback is about a single resource"
          },
          comment: {
            type: "string",
            description: "Optional: Additional comments about the resources"
          }
        },
        required: ["searchId", "helpful"]
      }
    },

    // Display map function
    {
      type: 'function',
      name: "display_map_function",
      description: "Displays the resources on a map for better visualization of locations",
      parameters: {
        type: "object",
        properties: {
          searchId: {
            type: "string",
            description: "The ID of the search to display on the map"
          }
        },
        required: ["searchId"]
      }
    },

    // =====================================================
    // Query book content (generic, used by other functions)
    {
      type: 'function',
      name: "query_book_content",
      description: "Queries the content of therapeutic books and resources",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The query to search for in the book content"
          },
          namespace: {
            type: "string",
            description: "The namespace of the book content"
          },
          filter_metadata: {
            type: "object",
            description: "Optional: Additional filtering parameters for the search"
          },
          book: {
            type: "string",
            description: "Optional: Specific book ID to search"
          }
        },
        required: ["query", "namespace"]
      }
    },

    // End session function
    {
      type: 'function',
      name: "end_session",
      description: "Ends the current session and triggers appropriate cleanup",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    },

    // Report technical error
    {
      type: 'function',
      name: "report_technical_error",
      description: "Reports technical errors that occur during function execution",
      parameters: {
        type: "object",
        properties: {
          error_type: {
            type: "string",
            description: "The type of error that occurred",
            enum: ["api_error", "timeout", "missing_data", "access_denied", "format_error", "unknown"]
          },
          function_name: {
            type: "string",
            description: "The name of the function where the error occurred"
          },
          error_message: {
            type: "string",
            description: "Optional: Detailed error message"
          }
        },
        required: ["error_type", "function_name"]
      }
    },

    // ==========================
    // FUTURES PATHWAYS FUNCTIONS - Career and Educational Guidance

    // Pathway exploration function
    {
      type: 'function',
      name: "pathway_exploration_function",
      description: "Helps users explore career options, educational paths, and vocational training based on their interests, skills, and current situation. Provides personalized pathway suggestions.",
      parameters: {
        type: "object",
        properties: {
          interests: {
            type: "array",
            items: { type: "string" },
            description: "User's interests, hobbies, or areas they enjoy (e.g., ['music', 'helping_people', 'technology'])"
          },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Current skills or skills they want to develop (optional)"
          },
          education_level: {
            type: "string",
            enum: ["in_high_school", "graduated_high_school", "ged_needed", "some_college", "college_graduate", "left_school"],
            description: "Current educational status"
          },
          immediate_needs: {
            type: "string",
            enum: ["income_needed", "stable_housing", "family_support", "no_immediate_pressure", "other"],
            description: "Any immediate pressures or needs that might influence pathway choices (optional)"
          }
        },
        required: ["interests", "education_level"]
      }
    },

    // Educational guidance function
    {
      type: 'function',
      name: "educational_guidance_function",
      description: "Provides detailed information about educational pathways including college, trade schools, GED programs, and financial aid options. Includes support programs for at-risk youth.",
      parameters: {
        type: "object",
        properties: {
          pathway_type: {
            type: "string",
            enum: ["college", "trade_school", "ged_program", "vocational_training", "apprenticeship", "all_options"],
            description: "Type of educational pathway to explore"
          },
          financial_situation: {
            type: "string",
            enum: ["need_financial_aid", "can_pay_some", "need_work_while_studying", "unsure"],
            description: "Financial situation for education planning (optional)"
          },
          timeline: {
            type: "string",
            enum: ["immediately", "within_6_months", "within_year", "flexible", "unsure"],
            description: "When they want to start their educational path (optional)"
          }
        },
        required: ["pathway_type"]
      }
    },

    // Skill building function
    {
      type: 'function',
      name: "skill_building_function",
      description: "Connects users to life skills modules and job readiness support including resume writing, interview preparation, budgeting, and communication skills.",
      parameters: {
        type: "object",
        properties: {
          skill_area: {
            type: "string",
            enum: ["resume_writing", "interview_prep", "budgeting", "communication", "digital_literacy", "job_search", "all_skills"],
            description: "Specific skill area to focus on"
          },
          current_level: {
            type: "string",
            enum: ["beginner", "some_experience", "need_refresher"],
            description: "Current skill level (optional)"
          },
          immediate_application: {
            type: "string",
            description: "Specific job or program they're applying for (optional)"
          }
        },
        required: ["skill_area"]
      }
    },

    // Goal planning function
    {
      type: 'function',
      name: "goal_planning_function",
      description: "Helps users break down larger goals into manageable steps and create personalized action plans with progress tracking and motivation strategies.",
      parameters: {
        type: "object",
        properties: {
          goal_description: {
            type: "string",
            description: "The user's specific goal (e.g., 'become a medical assistant', 'get my GED')"
          },
          goal_type: {
            type: "string",
            enum: ["career_goal", "education_goal", "skill_development", "job_search", "life_stability"],
            description: "Category of the goal"
          },
          timeline: {
            type: "string",
            enum: ["1_month", "3_months", "6_months", "1_year", "longer_term", "flexible"],
            description: "Desired timeline for achieving the goal (optional)"
          },
          current_barriers: {
            type: "array",
            items: { type: "string" },
            description: "Obstacles or challenges they're currently facing (optional)"
          }
        },
        required: ["goal_description", "goal_type"]
      }
    },

    // Resource connection function
    {
      type: 'function',
      name: "resource_connection_function",
      description: "Helps users identify networking opportunities, volunteer work, internships, and creative ways to gain experience in their field of interest.",
      parameters: {
        type: "object",
        properties: {
          connection_type: {
            type: "string",
            enum: ["networking", "volunteer_opportunities", "internships", "job_shadowing", "mentorship", "all_types"],
            description: "Type of connection or experience they're looking for"
          },
          field_of_interest: {
            type: "string",
            description: "Their career area of interest"
          },
          comfort_level: {
            type: "string",
            enum: ["very_comfortable", "somewhat_comfortable", "nervous_but_willing", "need_support"],
            description: "How comfortable they are with networking/reaching out (optional)"
          }
        },
        required: ["connection_type", "field_of_interest"]
      }
    },

    // Futures assessment function
    {
      type: 'function',
      name: "futures_assessment_function",
      description: "Conducts the initial Futures Pathways assessment to understand user's current situation, interests, skills, and immediate needs using trauma-informed questioning.",
      parameters: {
        type: "object",
        properties: {
          assessment_area: {
            type: "string",
            enum: ["full_assessment", "interests_only", "skills_only", "education_status", "work_experience", "immediate_needs"],
            description: "Which area of assessment to focus on"
          },
          user_comfort_level: {
            type: "string",
            enum: ["comfortable_sharing", "prefer_minimal", "very_private"],
            description: "How much detail the user is comfortable sharing (optional)"
          }
        },
        required: ["assessment_area"]
      }
    },

    // ========================== 
    // RESOURCE LOCATOR FUNCTIONS - For finding support services and resources

    // Emergency shelter locator
    {
      type: 'function',
      name: "emergency_shelter_function",
      description: "Locates emergency shelters and overnight accommodations for homeless youth, including youth-specific shelters and emergency housing options",
      parameters: {
        type: "object",
        properties: {
          urgency_level: {
            type: "string",
            description: "How urgently shelter is needed",
            enum: ["tonight", "within_week", "planning_ahead"]
          },
          age_group: {
            type: "string",
            description: "Age category for appropriate shelter matching",
            enum: ["under_18", "18_24", "over_24", "family_with_children"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where shelter is needed"
          },
          special_needs: {
            type: "array",
            items: { type: "string" },
            description: "Any special accommodations needed (optional)",
            enum: ["lgbtq_friendly", "disability_accessible", "pet_friendly", "substance_free", "mental_health_support"]
          }
        },
        required: ["urgency_level", "location"]
      }
    },

    // Food assistance locator
    {
      type: 'function',
      name: "food_assistance_function",
      description: "Finds food banks, pantries, meal programs, and free food resources for youth experiencing food insecurity",
      parameters: {
        type: "object",
        properties: {
          food_type: {
            type: "string",
            description: "Type of food assistance needed",
            enum: ["food_pantry", "hot_meals", "grocery_boxes", "school_meals", "any_food_help"]
          },
          urgency: {
            type: "string",
            description: "How soon food is needed",
            enum: ["today", "this_week", "ongoing_need"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where food assistance is needed"
          },
          transportation: {
            type: "boolean",
            description: "Whether user has reliable transportation to pick up food"
          }
        },
        required: ["food_type", "location"]
      }
    },

    // Mental health crisis support
    {
      type: 'function',
      name: "crisis_mental_health_function",
      description: "Provides immediate mental health crisis resources including hotlines, crisis centers, and emergency mental health services",
      parameters: {
        type: "object",
        properties: {
          crisis_severity: {
            type: "string",
            description: "Severity level of the mental health crisis",
            enum: ["immediate_danger", "severe_distress", "moderate_concern", "preventive"]
          },
          crisis_type: {
            type: "string",
            description: "Type of mental health crisis",
            enum: ["suicidal_thoughts", "panic_attack", "severe_anxiety", "depression", "trauma_response", "general_distress"]
          },
          preferred_contact: {
            type: "string",
            description: "Preferred method of crisis support",
            enum: ["phone_call", "text_chat", "online_chat", "in_person", "any_method"]
          },
          identity_specific: {
            type: "array",
            items: { type: "string" },
            description: "Identity-specific crisis resources needed (optional)",
            enum: ["lgbtq", "poc", "immigrant", "veteran", "disabled"]
          }
        },
        required: ["crisis_severity", "crisis_type"]
      }
    },

    // Healthcare access function
    {
      type: 'function',
      name: "healthcare_access_function",
      description: "Locates free and low-cost healthcare services, clinics, and medical resources for uninsured or underinsured youth",
      parameters: {
        type: "object",
        properties: {
          healthcare_need: {
            type: "string",
            description: "Type of healthcare service needed",
            enum: ["general_checkup", "mental_health", "dental", "vision", "reproductive_health", "urgent_care", "prescription_help"]
          },
          insurance_status: {
            type: "string",
            description: "Current insurance situation",
            enum: ["no_insurance", "medicaid", "parent_insurance", "unsure"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where healthcare is needed"
          },
          age: {
            type: "string",
            description: "Age category for appropriate healthcare matching",
            enum: ["under_18", "18_24", "over_24"]
          }
        },
        required: ["healthcare_need", "location"]
      }
    },

    // Job search assistance function
    {
      type: 'function',
      name: "job_search_assistance_function",
      description: "Finds job search resources, career counseling, and employment opportunities specifically for youth with limited experience",
      parameters: {
        type: "object",
        properties: {
          experience_level: {
            type: "string",
            description: "Current work experience level",
            enum: ["no_experience", "some_part_time", "volunteer_only", "internship_experience"]
          },
          job_type: {
            type: "string",
            description: "Type of employment sought",
            enum: ["part_time", "full_time", "temp_work", "internship", "any_work"]
          },
          interests: {
            type: "array",
            items: { type: "string" },
            description: "Areas of interest or preferred work types (optional)",
            enum: ["retail", "food_service", "office", "outdoors", "helping_people", "technology", "creative"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where work is sought"
          },
          support_needed: {
            type: "array",
            items: { type: "string" },
            description: "Types of job search support needed (optional)",
            enum: ["resume_help", "interview_prep", "job_training", "career_counseling", "transportation"]
          }
        },
        required: ["experience_level", "location"]
      }
    },

    // LGBTQ+ support resources
    {
      type: 'function',
      name: "lgbtq_support_function",
      description: "Locates LGBTQ+ affirming resources, support groups, and community services for sexual and gender minority youth",
      parameters: {
        type: "object",
        properties: {
          support_type: {
            type: "string",
            description: "Type of LGBTQ+ support needed",
            enum: ["support_groups", "counseling", "community_center", "crisis_support", "coming_out_help", "transition_support"]
          },
          identity: {
            type: "array",
            items: { type: "string" },
            description: "Identity areas for specific support (optional)",
            enum: ["lesbian", "gay", "bisexual", "transgender", "queer", "questioning", "non_binary", "general_lgbtq"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where support is needed"
          },
          meeting_preference: {
            type: "string",
            description: "Preferred meeting format",
            enum: ["in_person", "online", "phone", "text", "any_format"]
          }
        },
        required: ["support_type", "location"]
      }
    },

    // Legal aid locator
    {
      type: 'function',
      name: "legal_aid_function",
      description: "Finds free legal assistance and advocacy services for youth dealing with legal issues or needing legal guidance",
      parameters: {
        type: "object",
        properties: {
          legal_issue: {
            type: "string",
            description: "Type of legal assistance needed",
            enum: ["emancipation", "housing_rights", "school_issues", "employment_rights", "immigration", "family_court", "criminal_defense", "general_legal_help"]
          },
          urgency: {
            type: "string",
            description: "How urgently legal help is needed",
            enum: ["immediate", "within_week", "within_month", "planning_ahead"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where legal help is needed"
          },
          age: {
            type: "string",
            description: "Age category for appropriate legal services",
            enum: ["under_18", "18_24", "over_24"]
          }
        },
        required: ["legal_issue", "location"]
      }
    },

    // Educational support resources
    {
      type: 'function',
      name: "educational_support_function",
      description: "Locates educational resources including GED programs, tutoring, alternative schools, and academic support for at-risk youth",
      parameters: {
        type: "object",
        properties: {
          education_need: {
            type: "string",
            description: "Type of educational support needed",
            enum: ["ged_program", "high_school_completion", "tutoring", "alternative_school", "college_prep", "vocational_training"]
          },
          current_status: {
            type: "string",
            description: "Current educational situation",
            enum: ["dropped_out", "behind_in_school", "struggling_academically", "looking_for_alternatives"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where educational support is needed"
          },
          schedule_needs: {
            type: "string",
            description: "Schedule requirements (optional)",
            enum: ["flexible_hours", "evening_classes", "online_options", "standard_schedule"]
          }
        },
        required: ["education_need", "location"]
      }
    },

    // Transportation assistance
    {
      type: 'function',
      name: "transportation_assistance_function",
      description: "Finds transportation resources including bus passes, ride programs, and transportation vouchers for essential needs",
      parameters: {
        type: "object",
        properties: {
          transportation_need: {
            type: "string",
            description: "Purpose of transportation assistance",
            enum: ["work_commute", "school_transport", "medical_appointments", "job_interviews", "general_mobility"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where transportation is needed"
          },
          assistance_type: {
            type: "string",
            description: "Type of transportation help needed",
            enum: ["bus_passes", "rideshare_vouchers", "gas_assistance", "bike_programs", "any_help"]
          },
          duration: {
            type: "string",
            description: "How long transportation assistance is needed (optional)",
            enum: ["one_time", "short_term", "ongoing"]
          }
        },
        required: ["transportation_need", "location"]
      }
    },

    // Substance abuse support
    {
      type: 'function',
      name: "substance_abuse_support_function",
      description: "Locates substance abuse treatment, counseling, and recovery support services for youth struggling with addiction",
      parameters: {
        type: "object",
        properties: {
          support_type: {
            type: "string",
            description: "Type of substance abuse support needed",
            enum: ["detox_services", "outpatient_treatment", "counseling", "support_groups", "harm_reduction", "recovery_housing"]
          },
          substance_type: {
            type: "string",
            description: "Primary substance of concern (optional)",
            enum: ["alcohol", "marijuana", "prescription_drugs", "street_drugs", "multiple_substances", "prefer_not_to_say"]
          },
          treatment_preference: {
            type: "string",
            description: "Preferred treatment approach (optional)",
            enum: ["medical_treatment", "counseling_only", "peer_support", "faith_based", "any_approach"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where treatment is needed"
          },
          insurance_status: {
            type: "string",
            description: "Insurance or payment situation (optional)",
            enum: ["no_insurance", "medicaid", "private_insurance", "need_free_treatment"]
          }
        },
        required: ["support_type", "location"]
      }
    },

    // Young parent resources
    {
      type: 'function',
      name: "young_parent_support_function",
      description: "Finds resources and support services specifically for teen parents and young parents, including childcare and parenting programs",
      parameters: {
        type: "object",
        properties: {
          parent_type: {
            type: "string",
            description: "Type of parent situation",
            enum: ["teen_mom", "teen_dad", "young_parent", "expecting_parent", "single_parent"]
          },
          support_needed: {
            type: "string",
            description: "Primary type of support needed",
            enum: ["childcare", "parenting_classes", "baby_supplies", "housing_help", "education_support", "financial_assistance"]
          },
          child_age: {
            type: "string",
            description: "Age of child or pregnancy status (optional)",
            enum: ["pregnant", "newborn", "infant", "toddler", "preschool", "school_age"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where support is needed"
          }
        },
        required: ["parent_type", "support_needed", "location"]
      }
    },

    // Domestic violence resources
    {
      type: 'function',
      name: "domestic_violence_support_function",
      description: "Provides resources for youth experiencing domestic violence, dating violence, or unsafe home situations including shelters and safety planning",
      parameters: {
        type: "object",
        properties: {
          situation_type: {
            type: "string",
            description: "Type of unsafe situation",
            enum: ["domestic_violence", "dating_violence", "family_abuse", "unsafe_home", "trafficking"]
          },
          safety_level: {
            type: "string",
            description: "Current safety assessment",
            enum: ["immediate_danger", "planning_to_leave", "recently_left", "safety_planning"]
          },
          resource_type: {
            type: "string",
            description: "Type of support needed",
            enum: ["emergency_shelter", "safety_planning", "counseling", "legal_advocacy", "hotline_support"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where support is needed (optional for safety)"
          },
          contact_method: {
            type: "string",
            description: "Preferred contact method for safety",
            enum: ["secure_phone", "secure_chat", "email", "in_person", "through_friend"]
          }
        },
        required: ["situation_type", "safety_level", "resource_type"]
      }
    },

    // Basic needs assistance
    {
      type: 'function',
      name: "basic_needs_assistance_function",
      description: "Locates resources for basic needs including hygiene products, clothing, and essential items for daily living",
      parameters: {
        type: "object",
        properties: {
          need_type: {
            type: "string",
            description: "Type of basic need assistance required",
            enum: ["hygiene_products", "clothing", "blankets_bedding", "school_supplies", "baby_items", "household_items"]
          },
          urgency: {
            type: "string",
            description: "How urgently items are needed",
            enum: ["immediate", "this_week", "ongoing_need"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where assistance is needed"
          },
          age_group: {
            type: "string",
            description: "Age group for appropriate sizing/items (optional)",
            enum: ["child", "teen", "young_adult", "adult"]
          }
        },
        required: ["need_type", "location"]
      }
    },

    // Community and recreational programs
    {
      type: 'function',
      name: "community_programs_function",
      description: "Finds recreational activities, community programs, and positive youth development opportunities",
      parameters: {
        type: "object",
        properties: {
          program_type: {
            type: "string",
            description: "Type of community program sought",
            enum: ["after_school", "sports_leagues", "arts_programs", "volunteer_opportunities", "mentorship", "life_skills", "social_activities"]
          },
          interests: {
            type: "array",
            items: { type: "string" },
            description: "Areas of interest (optional)",
            enum: ["sports", "arts", "music", "technology", "community_service", "leadership", "academic"]
          },
          location: {
            type: "string",
            description: "City, state, or ZIP code where programs are sought"
          },
          schedule_preference: {
            type: "string",
            description: "Preferred program schedule (optional)",
            enum: ["after_school", "weekends", "evenings", "flexible"]
          }
        },
        required: ["program_type", "location"]
      }
    }

  ];
}

export default generateMentalHealthFunctions;