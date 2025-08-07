file: docs/comprehensive_function_templates_v16_new.md

# Comprehensive Function Templates for New V16 Triage AI System

  Function Execution Architecture

  Functions are executed through this flow:

  1. AI calls function → 2. WebRTC receives call → 3. webrtc-store.ts routes it → 4. use-mental-health-functions-v16.ts executes it

  Key Files:

  - use-mental-health-functions-v16.ts - The actual function registry with 29 executable functions
  - webrtc-store.ts - Handles WebRTC events and routes function calls
  - FunctionRegistryManager - Manages function lookup and execution
  - Supabase ai_prompts table - Defines what functions AI can see (17 for triage)

  The Confusion Explained:

  - 17 functions: What triage AI can call (Supabase config)
  - 29 functions: What can actually execute (code registry)
  - 45 functions: Total database templates (many unused)
  - 20 functions: Likely a filtered subset from somewhere

  Bottom Line:

  Functions are NOT executed directly from WebRTC, database, or hooks alone. They go through the WebRTC event system to reach the
  use-mental-health-functions-v16.ts registry which contains the actual executable code.
  
## Overview

This document combines the new therapeutic content functions suggested by Claude.ai with the existing V16 non-Pinecone functions that should be retained. The new triage AI will have access to this complete function set without requiring handoffs to specialized AIs.

 ✅ All 29 functions are present!

  Here's the final breakdown:

  ✅ Therapeutic Content Functions (10):
  - get_safety_triage_protocol
  - get_conversation_stance_guidance
  - get_assessment_protocol
  - get_continuity_framework
  - get_cbt_intervention
  - get_dbt_skills
  - get_trauma_informed_approach
  - get_substance_use_support
  - get_practical_support_guidance
  - get_acute_distress_protocol

  ✅ Resource Locator Functions (16):
  - basic_needs_assistance_function
  - community_programs_function
  - display_map_function
  - educational_support_function
  - emergency_shelter_function
  - food_assistance_function
  - healthcare_access_function
  - job_search_assistance_function
  - legal_aid_function
  - lgbtq_support_function
  - resource_feedback_function
  - resource_search_function
  - search_resources_unified
  - substance_abuse_support_function
  - transportation_assistance_function
  - young_parent_support_function

  ✅ Session Management Functions (3):
  - end_session
  - getUserHistory_function
  - logInteractionOutcome_function

  ✅ System Management Functions (1):
  - report_technical_error

  ✅ Supabase Update Complete!

  Total: 30/30 functions - Perfect match with the comprehensive function templates document!

  The new triage AI now has access to the complete therapeutic toolkit without requiring specialist handoffs. Ready for the next phase:
  code implementation!

## Function Categories

### 1. Therapeutic Content Functions (10 functions)
*New functions for retrieving therapeutic content from Pinecone*

### 2. Resource Locator Functions (16 functions)
*Retained from current V16 - these are separate from Pinecone*

### 3. Session Management Functions (3 functions)
*Retained from current V16*

### 4. System Management Functions (1 function)
*Retained from current V16, excluding specialist handoff*

## 1. Therapeutic Content Functions

These functions retrieve evidence-based therapeutic content from the new Pinecone knowledge base.

### `get_safety_triage_protocol`
```json
{
  "type": "function",
  "name": "get_safety_triage_protocol",
  "description": "Module 1: Retrieve safety assessment procedures, crisis escalation protocols, and emergency response scripts for immediate risk situations",
  "parameters": {
    "type": "object",
    "properties": {
      "risk_type": {
        "type": "string",
        "enum": ["suicide_ideation", "self_harm", "harm_to_others", "psychosis", "unsafe_environment", "illegal_behaviors"],
        "description": "Type of safety concern detected in user communication"
      },
      "risk_level": {
        "type": "string",
        "enum": ["passive_monitoring", "active_assessment", "imminent_danger", "high_distress"],
        "description": "Level of risk assessment needed based on user indicators"
      },
      "session_context": {
        "type": "string",
        "description": "Current conversation context for continuity-aware responses"
      }
    },
    "required": ["risk_type", "risk_level"]
  }
}
```

### `get_conversation_stance_guidance`
```json
{
  "type": "function",
  "name": "get_conversation_stance_guidance",
  "description": "Module 2: Retrieve persona guidelines, empathy matching strategies, and conversational design elements for appropriate therapeutic communication",
  "parameters": {
    "type": "object",
    "properties": {
      "interaction_type": {
        "type": "string",
        "enum": ["empathy_matching", "interpersonal_conflict", "effort_praise", "validation_level", "brief_responses", "one_question_rule"],
        "description": "Type of conversational guidance needed for current interaction"
      },
      "user_emotional_intensity": {
        "type": "string",
        "enum": ["low", "moderate", "high", "crisis"],
        "description": "User's emotional intensity for appropriate empathy matching"
      },
      "previous_interactions": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Previously used communication approaches to avoid repetition"
      }
    },
    "required": ["interaction_type"]
  }
}
```

### `get_assessment_protocol`
```json
{
  "type": "function",
  "name": "get_assessment_protocol", 
  "description": "Module 3: Retrieve 4-stage assessment framework with specific prompts, transition scripts, and collaborative inquiry techniques",
  "parameters": {
    "type": "object",
    "properties": {
      "assessment_stage": {
        "type": "string",
        "enum": ["opening", "deepening_understanding", "exploring_context", "assessing_coping", "clarifying_intent"],
        "description": "Current stage of the 4-stage assessment process"
      },
      "presenting_issue": {
        "type": "string",
        "description": "User's mentioned concern or topic for contextualized assessment prompts"
      },
      "repeat_topic": {
        "type": "boolean",
        "description": "Whether this topic has been discussed before with this user"
      }
    },
    "required": ["assessment_stage"]
  }
}
```

### `get_continuity_framework`
```json
{
  "type": "function",
  "name": "get_continuity_framework",
  "description": "Module 4: Retrieve therapeutic continuity guidelines and memory management protocols for ongoing therapeutic relationships",
  "parameters": {
    "type": "object",
    "properties": {
      "continuity_type": {
        "type": "string", 
        "enum": ["topic_recognition", "strategy_followup", "contextual_awareness", "user_initiated_recall", "session_continuity"],
        "description": "Type of continuity support needed for therapeutic relationship"
      },
      "conversation_history_summary": {
        "type": "string",
        "description": "Brief summary of recent conversation themes for context"
      }
    },
    "required": ["continuity_type"]
  }
}
```

### `get_cbt_intervention`
```json
{
  "type": "function",
  "name": "get_cbt_intervention",
  "description": "Module 5: Retrieve CBT interventions including Thought Detective cognitive restructuring, Upward Spiral behavioral activation, and Bravery Ladder exposure therapy",
  "parameters": {
    "type": "object",
    "properties": {
      "intervention_submodule": {
        "type": "string",
        "enum": ["cognitive_restructuring", "behavioral_activation", "exposure_therapy", "thought_detective", "upward_spiral", "bravery_ladder"],
        "description": "Specific CBT intervention technique needed"
      },
      "conversation_step": {
        "type": "string",
        "enum": ["introduce_concept", "guide_process", "practice_skill", "follow_up", "catch_it", "check_it", "change_it"],
        "description": "Current step in the CBT intervention process"
      },
      "user_situation": {
        "type": "string",
        "description": "User's specific situation or thought pattern for contextualized examples"
      },
      "distortion_type": {
        "type": "string",
        "enum": ["black_and_white", "catastrophizing", "mind_reading", "personalization", "overgeneralization", "labeling"],
        "description": "Type of cognitive distortion identified"
      }
    },
    "required": ["intervention_submodule", "conversation_step"]
  }
}
```

### `get_dbt_skills`
```json
{
  "type": "function",
  "name": "get_dbt_skills",
  "description": "Module 6: Retrieve DBT skills including Window of Tolerance emotion regulation, Crisis Survival Kit distress tolerance, and DEAR MAN interpersonal effectiveness",
  "parameters": {
    "type": "object",
    "properties": {
      "skill_submodule": {
        "type": "string",
        "enum": ["emotion_regulation", "distress_tolerance", "interpersonal_effectiveness", "window_of_tolerance", "crisis_survival_kit", "dear_man"],
        "description": "Specific DBT skill module needed"
      },
      "skill_application": {
        "type": "string",
        "enum": ["teach_concept", "guide_practice", "crisis_application", "follow_up", "script_building", "role_play"],
        "description": "How the DBT skill is being applied in current context"
      },
      "user_distress_level": {
        "type": "string",
        "enum": ["low", "moderate", "high", "crisis", "hyper_aroused", "hypo_aroused"],
        "description": "User's current distress level for appropriate skill selection"
      },
      "interpersonal_situation": {
        "type": "string", 
        "description": "Specific interpersonal situation for DEAR MAN script building"
      }
    },
    "required": ["skill_submodule", "skill_application"]
  }
}
```

### `get_trauma_informed_approach`
```json
{
  "type": "function",
  "name": "get_trauma_informed_approach",
  "description": "Module 7: Retrieve trauma-informed protocols following Regulate/Relate/Reason sequence, IFS Parts Work, and Virtual Calming Room techniques",
  "parameters": {
    "type": "object",
    "properties": {
      "trauma_submodule": {
        "type": "string",
        "enum": ["regulate_relate_reason", "parts_work", "virtual_calming_room", "inner_team", "trauma_principles"],
        "description": "Specific trauma-informed intervention approach"
      },
      "trauma_response_detected": {
        "type": "boolean",
        "description": "Whether trauma indicators were detected in user communication"
      },
      "user_choice": {
        "type": "string",
        "enum": ["talk_based", "regulation_help", "user_decides", "collaborative_choice"],
        "description": "User's stated preference for talk-based vs regulation approach"
      },
      "parts_identified": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Internal parts or protective mechanisms the user has mentioned"
      }
    },
    "required": ["trauma_submodule"]
  }
}
```

### `get_substance_use_support`
```json
{
  "type": "function",
  "name": "get_substance_use_support",
  "description": "Module 8: Retrieve MI-informed substance use interventions including Decisional Balance exploration and Change Talk elicitation techniques",
  "parameters": {
    "type": "object",
    "properties": {
      "mi_submodule": {
        "type": "string",
        "enum": ["exploring_ambivalence", "eliciting_change_talk", "decisional_balance", "darn_cat_model", "permission_asking"],
        "description": "Specific Motivational Interviewing intervention approach"
      },
      "substance_mentioned": {
        "type": "string",
        "description": "Specific substance user mentioned for contextualized, non-judgmental responses"
      },
      "change_readiness": {
        "type": "string",
        "enum": ["precontemplation", "contemplation", "preparation", "action", "maintenance", "unknown"],
        "description": "User's apparent stage of change for appropriate intervention"
      },
      "ambivalence_area": {
        "type": "string",
        "enum": ["pros_cons", "desire", "ability", "reason", "need", "commitment", "activation", "taking_steps"],
        "description": "Specific area of ambivalence to explore"
      }
    },
    "required": ["mi_submodule"]
  }
}
```

### `get_practical_support_guidance`
```json
{
  "type": "function",
  "name": "get_practical_support_guidance",
  "description": "Module 9: Retrieve practical support protocols and resource navigation guidance for addressing basic needs and life skills",
  "parameters": {
    "type": "object",
    "properties": {
      "support_type": {
        "type": "string",
        "enum": ["resource_navigation", "benefits_guidance", "life_skills_coaching", "emergency_needs", "basic_needs_validation"],
        "description": "Type of practical support guidance needed"
      },
      "resource_category": {
        "type": "string",
        "enum": ["housing", "food", "employment", "education", "healthcare", "transportation", "general_stability"],
        "description": "Category of resource need to address"
      },
      "urgency_context": {
        "type": "string",
        "enum": ["immediate", "urgent", "planning", "ongoing"],
        "description": "Urgency level of the practical need"
      }
    },
    "required": ["support_type"]
  }
}
```

### `get_acute_distress_protocol`
```json
{
  "type": "function",
  "name": "get_acute_distress_protocol",
  "description": "Module 10: Retrieve immediate grounding exercises and co-regulation techniques for users in acute, present-moment distress (STRICT ENTRY CRITERIA REQUIRED)",
  "parameters": {
    "type": "object",
    "properties": {
      "distress_type": {
        "type": "string",
        "enum": ["panic_attack", "overwhelming_emotion", "dissociation", "trauma_activation", "acute_anxiety"],
        "description": "Type of acute distress currently experienced"
      },
      "grounding_technique": {
        "type": "string",
        "enum": ["five_senses_grounding", "slow_breathing", "both_options", "user_choice"],
        "description": "Specific grounding technique requested or most appropriate"
      },
      "entry_criteria_met": {
        "type": "boolean",
        "description": "REQUIRED: Whether BOTH conditions are met - (1) acute present-moment distress AND (2) direct request for help to calm down"
      }
    },
    "required": ["distress_type", "entry_criteria_met"]
  }
}
```

## 2. Resource Locator Functions
*Retained from current V16 - these are separate services, not Pinecone-based*

### `basic_needs_assistance_function`
```json
{
  "type": "function",
  "name": "basic_needs_assistance_function",
  "description": "Locates resources for basic needs including hygiene products, clothing, and essential items",
  "parameters": {
    "type": "object",
    "properties": {
      "need_type": {
        "type": "string",
        "enum": ["hygiene_products", "clothing", "blankets_bedding", "school_supplies", "baby_items", "household_items"],
        "description": "Type of basic need requiring assistance"
      },
      "location": {
        "type": "string",
        "description": "Location where assistance is needed"
      },
      "urgency": {
        "type": "string",
        "enum": ["immediate", "this_week", "ongoing_need"],
        "description": "Urgency level of the need"
      },
      "age_group": {
        "type": "string",
        "enum": ["child", "teen", "young_adult", "adult"],
        "description": "Age group needing assistance"
      }
    },
    "required": ["need_type", "location"]
  }
}
```

### `community_programs_function`
```json
{
  "type": "function",
  "name": "community_programs_function", 
  "description": "Finds recreational activities, community programs, and positive youth development opportunities",
  "parameters": {
    "type": "object",
    "properties": {
      "program_type": {
        "type": "string",
        "enum": ["after_school", "sports_leagues", "arts_programs", "volunteer_opportunities", "mentorship", "life_skills", "social_activities"],
        "description": "Type of community program sought"
      },
      "location": {
        "type": "string", 
        "description": "Location where programs are sought"
      },
      "interests": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["sports", "arts", "music", "technology", "community_service", "leadership", "academic"]
        },
        "description": "User's interests for program matching"
      },
      "schedule_preference": {
        "type": "string",
        "enum": ["after_school", "weekends", "evenings", "flexible"],
        "description": "Preferred schedule for participation"
      }
    },
    "required": ["program_type", "location"]
  }
}
```

### `display_map_function`
```json
{
  "type": "function",
  "name": "display_map_function",
  "description": "Displays the resources on a map for better visualization of locations",
  "parameters": {
    "type": "object", 
    "properties": {
      "searchId": {
        "type": "string",
        "description": "ID of the search to display on map"
      }
    },
    "required": ["searchId"]
  }
}
```

### `educational_support_function`
```json
{
  "type": "function",
  "name": "educational_support_function",
  "description": "Locates educational resources including GED programs, tutoring, alternative schools, and academic support",
  "parameters": {
    "type": "object",
    "properties": {
      "education_need": {
        "type": "string",
        "enum": ["ged_program", "high_school_completion", "tutoring", "alternative_school", "college_prep", "vocational_training"],
        "description": "Type of educational support needed"
      },
      "location": {
        "type": "string",
        "description": "Location where support is needed"
      },
      "current_status": {
        "type": "string", 
        "enum": ["dropped_out", "behind_in_school", "struggling_academically", "looking_for_alternatives"],
        "description": "Current educational status"
      },
      "schedule_needs": {
        "type": "string",
        "enum": ["flexible_hours", "evening_classes", "online_options", "standard_schedule"],
        "description": "Schedule requirements for education"
      }
    },
    "required": ["education_need", "location"]
  }
}
```

### `emergency_shelter_function`
```json
{
  "type": "function",
  "name": "emergency_shelter_function",
  "description": "Locates emergency shelters and overnight accommodations for homeless youth", 
  "parameters": {
    "type": "object",
    "properties": {
      "urgency_level": {
        "type": "string",
        "enum": ["tonight", "within_week", "planning_ahead"],
        "description": "Urgency of shelter need"
      },
      "location": {
        "type": "string",
        "description": "Location where shelter is needed"
      },
      "age_group": {
        "type": "string",
        "enum": ["under_18", "18_24", "over_24", "family_with_children"],
        "description": "Age group requiring shelter"
      },
      "special_needs": {
        "type": "array",
        "items": {
          "type": "string", 
          "enum": ["lgbtq_friendly", "disability_accessible", "pet_friendly", "substance_free", "mental_health_support"]
        },
        "description": "Special accommodations needed"
      }
    },
    "required": ["urgency_level", "location"]
  }
}
```

### `food_assistance_function`
```json
{
  "type": "function",
  "name": "food_assistance_function",
  "description": "Finds food banks, pantries, meal programs, and free food resources",
  "parameters": {
    "type": "object",
    "properties": {
      "food_type": {
        "type": "string",
        "enum": ["food_pantry", "hot_meals", "grocery_boxes", "school_meals", "any_food_help"],
        "description": "Type of food assistance needed"
      },
      "location": {
        "type": "string",
        "description": "Location where assistance is needed"
      },
      "urgency": {
        "type": "string",
        "enum": ["today", "this_week", "ongoing_need"],
        "description": "Urgency of food need"
      },
      "transportation": {
        "type": "boolean",
        "description": "Whether user has transportation to access resources"
      }
    },
    "required": ["food_type", "location"]
  }
}
```

### `healthcare_access_function`
```json
{
  "type": "function",
  "name": "healthcare_access_function",
  "description": "Locates free and low-cost healthcare services, clinics, and medical resources",
  "parameters": {
    "type": "object",
    "properties": {
      "healthcare_need": {
        "type": "string",
        "enum": ["general_checkup", "mental_health", "dental", "vision", "reproductive_health", "urgent_care", "prescription_help"],
        "description": "Type of healthcare service needed"
      },
      "location": {
        "type": "string",
        "description": "Location where healthcare is needed"
      },
      "age": {
        "type": "string",
        "enum": ["under_18", "18_24", "over_24"],
        "description": "Age of person needing healthcare"
      },
      "insurance_status": {
        "type": "string",
        "enum": ["no_insurance", "medicaid", "parent_insurance", "unsure"],
        "description": "Current insurance status"
      }
    },
    "required": ["healthcare_need", "location"]
  }
}
```

### `job_search_assistance_function`
```json
{
  "type": "function", 
  "name": "job_search_assistance_function",
  "description": "Finds job search resources, career counseling, and employment opportunities",
  "parameters": {
    "type": "object",
    "properties": {
      "experience_level": {
        "type": "string",
        "enum": ["no_experience", "some_part_time", "volunteer_only", "internship_experience"],
        "description": "User's current work experience level"
      },
      "location": {
        "type": "string",
        "description": "Location where work is sought"
      },
      "job_type": {
        "type": "string",
        "enum": ["part_time", "full_time", "temp_work", "internship", "any_work"],
        "description": "Type of employment sought"
      },
      "interests": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["retail", "food_service", "office", "outdoors", "helping_people", "technology", "creative"]
        },
        "description": "User's work interests"
      },
      "support_needed": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["resume_help", "interview_prep", "job_training", "career_counseling", "transportation"]
        },
        "description": "Types of job search support needed"
      }
    },
    "required": ["experience_level", "location"]
  }
}
```

### `legal_aid_function`
```json
{
  "type": "function",
  "name": "legal_aid_function",
  "description": "Finds free legal assistance and advocacy services for youth",
  "parameters": {
    "type": "object",
    "properties": {
      "legal_issue": {
        "type": "string",
        "enum": ["emancipation", "housing_rights", "school_issues", "employment_rights", "immigration", "family_court", "criminal_defense", "general_legal_help"],
        "description": "Type of legal issue requiring assistance"
      },
      "location": {
        "type": "string",
        "description": "Location where legal help is needed"
      },
      "age": {
        "type": "string",
        "enum": ["under_18", "18_24", "over_24"],
        "description": "Age of person needing legal assistance"
      },
      "urgency": {
        "type": "string",
        "enum": ["immediate", "within_week", "within_month", "planning_ahead"],
        "description": "Urgency of legal need"
      }
    },
    "required": ["legal_issue", "location"]
  }
}
```

### `lgbtq_support_function`
```json
{
  "type": "function",
  "name": "lgbtq_support_function",
  "description": "Locates LGBTQ+ affirming resources, support groups, and community services",
  "parameters": {
    "type": "object",
    "properties": {
      "support_type": {
        "type": "string",
        "enum": ["support_groups", "counseling", "community_center", "crisis_support", "coming_out_help", "transition_support"],
        "description": "Type of LGBTQ+ support sought"
      },
      "location": {
        "type": "string",
        "description": "Location where support is needed"
      },
      "identity": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["lesbian", "gay", "bisexual", "transgender", "queer", "questioning", "non_binary", "general_lgbtq"]
        },
        "description": "Specific identity considerations"
      },
      "meeting_preference": {
        "type": "string",
        "enum": ["in_person", "online", "phone", "text", "any_format"],
        "description": "Preferred format for support"
      }
    },
    "required": ["support_type", "location"]
  }
}
```

### `resource_feedback_function`
```json
{
  "type": "function",
  "name": "resource_feedback_function",
  "description": "Collects feedback about the resources provided to improve future recommendations",
  "parameters": {
    "type": "object",
    "properties": {
      "searchId": {
        "type": "string", 
        "description": "ID of the search to provide feedback on"
      },
      "helpful": {
        "type": "boolean",
        "description": "Whether resources were helpful"
      },
      "resource_name": {
        "type": "string",
        "description": "Specific resource name for feedback"
      },
      "comment": {
        "type": "string",
        "description": "Additional comments about resource quality"
      }
    },
    "required": ["searchId", "helpful"]
  }
}
```

### `resource_search_function`
```json
{
  "type": "function",
  "name": "resource_search_function",
  "description": "Searches the web for mental health resources, services, and information",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for resources"
      },
      "resource_type": {
        "type": "string",
        "enum": ["crisis_hotline", "therapy", "support_group", "substance_abuse", "community_service", "educational", "financial_assistance", "housing", "medical", "legal", "food", "clothing", "transportation", "other"],
        "description": "Type of resource being searched for"
      },
      "location_specific": {
        "type": "boolean",
        "description": "Whether search should be location-specific"
      },
      "location": {
        "type": "string",
        "description": "Geographic location for search"
      },
      "mapView": {
        "type": "boolean",
        "description": "Whether to prepare results for map visualization"
      }
    },
    "required": ["query"]
  }
}
```

### `search_resources_unified`
```json
{
  "type": "function",
  "name": "search_resources_unified",
  "description": "Unified function for searching all types of resources including shelter, food, healthcare, jobs, legal aid, and community support",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query for resources"
      },
      "resource_category": {
        "type": "string",
        "enum": ["crisis_hotline", "therapy", "support_group", "substance_abuse", "community_service", "educational", "financial_assistance", "housing", "medical", "legal", "food", "clothing", "transportation", "other"],
        "description": "Category of resource being searched for"
      },
      "location": {
        "type": "string",
        "description": "Geographic location for search"
      },
      "urgency": {
        "type": "string",
        "enum": ["immediate", "urgent", "planning", "ongoing"],
        "description": "Urgency level of the resource need"
      },
      "age_group": {
        "type": "string",
        "enum": ["child", "teen", "young_adult", "adult"],
        "description": "Age group needing assistance"
      },
      "special_needs": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["lgbtq_friendly", "disability_accessible", "pet_friendly", "substance_free", "mental_health_support"]
        },
        "description": "Special accommodations needed"
      }
    },
    "required": ["query", "resource_category", "location"]
  }
}
```

### `substance_abuse_support_function`
```json
{
  "type": "function",
  "name": "substance_abuse_support_function",
  "description": "Locates substance abuse treatment, counseling, and recovery support services",
  "parameters": {
    "type": "object",
    "properties": {
      "support_type": {
        "type": "string",
        "enum": ["detox_services", "outpatient_treatment", "counseling", "support_groups", "harm_reduction", "recovery_housing"],
        "description": "Type of substance abuse support needed"
      },
      "location": {
        "type": "string",
        "description": "Location where treatment is needed"
      },
      "substance_type": {
        "type": "string",
        "enum": ["alcohol", "marijuana", "prescription_drugs", "street_drugs", "multiple_substances", "prefer_not_to_say"],
        "description": "Type of substance involved"
      },
      "insurance_status": {
        "type": "string",
        "enum": ["no_insurance", "medicaid", "private_insurance", "need_free_treatment"],
        "description": "Insurance coverage status"
      },
      "treatment_preference": {
        "type": "string",
        "enum": ["medical_treatment", "counseling_only", "peer_support", "faith_based", "any_approach"],
        "description": "Preferred treatment approach"
      }
    },
    "required": ["support_type", "location"]
  }
}
```

### `transportation_assistance_function`
```json
{
  "type": "function",
  "name": "transportation_assistance_function",
  "description": "Finds transportation resources including bus passes, ride programs, and transportation vouchers",
  "parameters": {
    "type": "object",
    "properties": {
      "transportation_need": {
        "type": "string",
        "enum": ["work_commute", "school_transport", "medical_appointments", "job_interviews", "general_mobility"],
        "description": "Purpose of transportation need"
      },
      "location": {
        "type": "string",
        "description": "Location where transportation is needed"
      },
      "assistance_type": {
        "type": "string",
        "enum": ["bus_passes", "rideshare_vouchers", "gas_assistance", "bike_programs", "any_help"],
        "description": "Type of transportation assistance needed"
      },
      "duration": {
        "type": "string",
        "enum": ["one_time", "short_term", "ongoing"],
        "description": "Duration of transportation need"
      }
    },
    "required": ["transportation_need", "location"]
  }
}
```

### `young_parent_support_function`
```json
{
  "type": "function",
  "name": "young_parent_support_function",
  "description": "Finds resources and support services specifically for teen parents and young parents",
  "parameters": {
    "type": "object",
    "properties": {
      "parent_type": {
        "type": "string",
        "enum": ["teen_mom", "teen_dad", "young_parent", "expecting_parent", "single_parent"],
        "description": "Type of parenting situation"
      },
      "support_needed": {
        "type": "string",
        "enum": ["childcare", "parenting_classes", "baby_supplies", "housing_help", "education_support", "financial_assistance"],
        "description": "Type of support needed"
      },
      "location": {
        "type": "string",
        "description": "Location where support is needed"
      },
      "child_age": {
        "type": "string",
        "enum": ["pregnant", "newborn", "infant", "toddler", "preschool", "school_age"],
        "description": "Age of child or pregnancy status"
      }
    },
    "required": ["parent_type", "support_needed", "location"]
  }
}
```

## 3. Session Management Functions
*Retained from current V16*

### `end_session`
```json
{
  "type": "function",
  "name": "end_session",
  "description": "Ends the current session and triggers appropriate cleanup and memory processing",
  "parameters": {
    "type": "object",
    "properties": {
      "session_summary": {
        "type": "string",
        "description": "Brief summary of session content for memory processing"
      },
      "user_outcome": {
        "type": "string",
        "enum": ["helpful", "somewhat_helpful", "not_helpful", "neutral"],
        "description": "User's assessment of session helpfulness"
      }
    }
  }
}
```

### `getUserHistory_function`
```json
{
  "type": "function",
  "name": "getUserHistory_function",
  "description": "Retrieves information about the user's history and patterns for personalized care",
  "parameters": {
    "type": "object",
    "properties": {
      "history_type": {
        "type": "string",
        "enum": ["function_effectiveness", "communication_preferences", "skill_progress", "recent_interactions", "therapeutic_continuity"],
        "description": "Type of historical information needed for personalization"
      }
    },
    "required": ["history_type"]
  }
}
```

### `logInteractionOutcome_function`
```json
{
  "type": "function",
  "name": "logInteractionOutcome_function",
  "description": "Logs the outcome of different approaches or interventions for continuous improvement",
  "parameters": {
    "type": "object",
    "properties": {
      "approach_used": {
        "type": "string",
        "description": "The therapeutic approach or technique used"
      },
      "effectiveness_rating": {
        "type": "string",
        "enum": ["high", "medium", "low", "unclear"],
        "description": "Rated effectiveness of the intervention"
      },
      "user_engagement": {
        "type": "string",
        "enum": ["actively_engaged", "somewhat_engaged", "minimal_engagement", "resistant"],
        "description": "Level of user engagement with intervention"
      },
      "therapeutic_module": {
        "type": "string",
        "description": "Which therapeutic module/function was used"
      }
    },
    "required": ["approach_used", "effectiveness_rating"]
  }
}
```

## 4. System Management Functions
*Modified from current V16 - excludes specialist handoff*

### `report_technical_error`
```json
{
  "type": "function",
  "name": "report_technical_error",
  "description": "Reports technical errors that occur during function execution",
  "parameters": {
    "type": "object",
    "properties": {
      "error_type": {
        "type": "string",
        "enum": ["api_error", "timeout", "missing_data", "access_denied", "format_error", "pinecone_error", "unknown"],
        "description": "Type of technical error encountered"
      },
      "function_name": {
        "type": "string",
        "description": "Name of the function where error occurred"
      },
      "error_message": {
        "type": "string",
        "description": "Detailed error message for debugging"
      },
      "user_impact": {
        "type": "string",
        "enum": ["high", "medium", "low"],
        "description": "Level of impact on user experience"
      }
    },
    "required": ["error_type", "function_name"]
  }
}
```

## Function Assignment Strategy

### New Triage AI Function Set (30 Total Functions)
The new triage AI will have access to ALL functions without requiring handoffs:

**Therapeutic Content Functions**: 10 functions
- Complete therapeutic toolkit through Pinecone retrieval
- Evidence-based interventions for all mental health needs
- Crisis response and safety protocols

**Resource Locator Functions**: 16 functions  
- Practical support and basic needs
- Community connection and services
- External resource discovery

**Session Management Functions**: 3 functions
- User history and personalization
- Session continuity and cleanup
- Outcome tracking

**System Management Functions**: 1 function
- Error reporting and technical diagnostics

## Key Implementation Notes

### 1. No Specialist Handoffs
- `trigger_specialist_handoff` function is **removed**
- New triage AI handles all therapeutic interventions directly
- Maintains V16 conversation flow and memory systems

### 2. Enhanced Continuity
- Added `session_context` and `previous_interactions` parameters
- Functions support therapeutic relationship building
- Memory integration with existing V16 systems

### 3. Pinecone Integration
- Therapeutic content functions query new Pinecone namespace
- Resource locator functions remain separate (external services)
- Clear separation between therapeutic content and practical resources

### 4. Safety-First Design
- Enhanced safety protocols in `get_safety_triage_protocol`
- Strict entry criteria for acute distress interventions
- Crisis escalation pathways maintained

### 5. Evidence-Based Approach
- All therapeutic functions based on established clinical frameworks
- Youth-appropriate language and interventions
- Comprehensive coverage of mental health needs

This comprehensive function set enables the new triage AI to provide complete therapeutic support without requiring handoffs while maintaining the practical resource location capabilities that users need.

## Function Implementation Notes

### Dual Resource Search Functions

The documentation now includes both `resource_search_function` and `search_resources_unified` to address the technical issue discovered where:

- **Supabase Configuration**: Uses `search_resources_unified` function name
- **Code Implementation**: Originally only handled `resource_search_function` 
- **Fix Applied**: Added parameter mapping in `use-supabase-functions.ts` to handle both function names

**`search_resources_unified` Parameters:**
- `query` (required): Search query for resources
- `resource_category` (required): Category of resource (maps to `resource_type`)
- `location` (required): Geographic location for search
- `urgency` (optional): Urgency level of need
- `age_group` (optional): Age group needing assistance
- `special_needs` (optional): Array of special accommodations

**Parameter Mapping:**
```typescript
// search_resources_unified → resource_search_function
{
  query: unifiedParams.query,
  resource_type: unifiedParams.resource_category, // mapped
  location: unifiedParams.location,
  location_specific: true, // derived from required location
  mapView: false // default value
}
```

This ensures that when the AI calls `search_resources_unified` (as configured in Supabase), it properly routes to the existing `resourceSearchFunction` implementation with correct parameter mapping.

## Implementation Status 🚨 ARCHITECTURE MESS DISCOVERED

### 🚨 CRITICAL: NO SINGLE SOURCE OF TRUTH FOR V16 FUNCTIONS

**Investigation Date**: January 21, 2025  
**Finding**: V16 function architecture has **multiple conflicting sources** with no clear authority on what functions are actually available.

### Code Implementation Completed
**Date**: January 2025  
**File**: `/src/hooksV16/use-mental-health-functions-v16.ts`  
**Status**: ⚠️ **DISCREPANCY DISCOVERED**: 45 functions implemented in code, but only ~20 functions actually used by V16 WebRTC

### ✅ Implementation Summary

1. **10 NEW Therapeutic Content Functions Implemented**:
   - All functions query Pinecone namespace `therapeutic_youth_v3`
   - Each function includes proper metadata filtering for precise content retrieval
   - Error handling includes pinecone_error support
   - Functions follow established patterns from existing V16 codebase

2. **Deleted Functions Removed**:
   - ✅ `query_book_content` - Removed from implementation and registry
   - ✅ `trigger_specialist_handoff` - Confirmed not present (was already removed)

3. **Pinecone Integration Updated**:
   - ✅ Helper function renamed from `queryBookContent` to `queryTherapeuticContent`
   - ✅ Default namespace updated from `trauma_informed_youth_mental_health_companion_v250420` to `therapeutic_youth_v3`
   - ✅ All existing therapeutic functions updated to use new namespace

4. **Function Registry Updated**:
   - ✅ All 29 functions properly registered and accessible
   - ✅ Clean separation between therapeutic content (Pinecone) and resource locator (external services) functions

### Technical Implementation Details

- **Namespace**: `therapeutic_youth_v3` (Pinecone)
- **API Endpoint**: `/api/v11/book-content` (reused existing endpoint)
- **Error Handling**: Includes support for `pinecone_error` type
- **Function Naming**: New therapeutic functions follow `get_*` pattern
- **Metadata Filtering**: Each function uses module-specific filters (`module: 'safety_triage'`, etc.)
- **Entry Criteria**: `get_acute_distress_protocol` includes strict validation requiring both acute distress AND direct help request

### 🚨 FUNCTION COUNT CHAOS: MULTIPLE CONFLICTING SOURCES

#### **Conflicting Function Counts Discovered**
| Source | Count | Functions |
|--------|-------|-----------|
| **This Document** | 29 | "Complete set" claimed |
| **Mental Health Hook** | 45 | Created in `use-mental-health-functions-v16.ts` |
| **WebRTC Registration** | 20 | Actually registered to AI system |
| **Supabase Functions** | ? | Unknown - separate system |
| **AI Function Definitions** | ? | What AI actually sees |

#### **Architecture Breakdown**
```
Documentation (29) ≠ Code Implementation (45) ≠ WebRTC Registration (20) ≠ AI Reality (?)
```

#### **Evidence from Function Execution Logging**
```bash
# Mental Health Hook Creates 45 Functions:
[function_execution] Function registry created with 45 functions
[function_execution] Available functions: grounding_function, thought_exploration_function...

# But WebRTC Only Registers 20 Functions:
[function_execution] ✅ Functions registered to FunctionRegistryManager: 20 functions
[function_execution] First 10 functions: get_safety_triage_protocol, get_conversation_stance_guidance...
```

#### **ROOT PROBLEM: NO ARCHITECTURAL AUTHORITY**
There is **NO single source of truth** for:
- Which functions exist
- Which functions are available to V16 AI
- Which functions actually work
- How many functions there should be

#### **Function Flow Breakdown**
1. **`docs/comprehensive_function_templates_v16_new.md`** → Claims 29 functions
2. **`use-mental-health-functions-v16.ts`** → Creates 45 functions  
3. **`webrtc-store.ts`** → Registers only 20 functions
4. **Supabase** → Has separate function definitions (unknown count)
5. **AI System** → Sees unknown subset of above

#### **Why This is Dangerous**
- **Unpredictable behavior**: Functions may or may not work
- **Debugging nightmare**: No way to know what should exist
- **User expectations**: Documentation promises features that don't exist
- **Development chaos**: Developers can't know what's actually implemented

#### **IMMEDIATE ACTIONS REQUIRED**
1. **🚨 STOP claiming any specific function count until verified**
2. **🔍 Audit ALL function sources to get ground truth**
3. **🎯 Establish SINGLE source of truth for V16 functions**
4. **🧹 Clean up conflicting implementations**
5. **📝 Update documentation to match reality**

---

## 🔥 URGENT: PROMPT FOR NEW SESSION TO FIX FUNCTION ARCHITECTURE

**Copy this prompt to start a new session focused on resolving the V16 function chaos:**

```
I need help understanding and fixing the V16 function architecture mess. Our triage AI has conflicting function counts across multiple systems:

DISCOVERED ISSUES:
- Documentation claims: 29 functions total
- Mental health hook creates: 45 functions  
- WebRTC registers only: 20 functions to AI
- Supabase has unknown separate function definitions
- No single source of truth exists

CURRENT PROBLEMS:
1. Functions may or may not work unpredictably
2. Documentation promises features that don't exist
3. Developers can't know what's actually implemented
4. Users get inconsistent experiences

INVESTIGATION NEEDED:
1. Audit ALL V16 function sources:
   - /src/hooksV16/use-mental-health-functions-v16.ts (creates 45)
   - /src/stores/webrtc-store.ts (registers 20) 
   - /src/hooksV16/use-supabase-functions.ts (unknown count)
   - Supabase database function definitions
   - AI system function visibility

2. Find the BOTTLENECK causing function count reduction:
   - Why does mental health hook create 45 but WebRTC only register 20?
   - Where is the filtering/limitation happening?
   - What determines which functions the AI actually sees?

3. Establish SINGLE SOURCE OF TRUTH for V16 functions

GOAL: Create a clean, authoritative list of exactly which functions V16 triage AI should have, ensure they all work, and update all systems to match this single source of truth.

Please start by auditing the function flow from creation to AI availability.
```

**This session should focus ONLY on:**
- Function architecture investigation
- Finding the source of truth
- Fixing the count discrepancies  
- NOT adding new features or capabilities

## Architecture Deep Dive: Namespace and Book Selection ⚙️

### Updated Implementation Details (January 2025)

After implementation and testing, we discovered important architectural considerations about namespace management and function coupling that required design decisions.

#### **Book Selection Architecture**

**Books_v2 Table Structure:**
- Each book in the `books_v2` database table has its own dedicated Pinecone namespace
- Examples:
  - **"Sleep Wise"** → `SleepWiseHowtoFeelBetterDanielBlum` namespace
  - **"Dopamine Nation"** → `dopamine_nation` namespace  
  - **"Mental Health Companion"** (old) → `trauma_informed_youth_mental_health_companion_v250420` namespace
  - **"Interaction Design Complete R2 AI v.3"** (new) → `therapeutic_youth_v3` namespace

#### **V16 Default Book Updated**
- **Previous Default**: `f95206aa-165e-4c49-b43a-69d91bef8ed4` ("Mental Health Companion" with `trauma_informed_youth_mental_health_companion_v250420`)
- **New Default**: `3f8df7a9-5d1f-47b4-ab0b-70aa31740e2e` ("Interaction Design Complete R2 AI v.3" with `therapeutic_youth_v3`)
- **Location**: `/src/app/chatbotV16/page.tsx:248`

### **Function-Namespace Coupling Strategy** 🔗

#### **Decision: Hard-Coded Namespaces**

After analysis, we implemented **hard-coded namespace coupling** for V16 functions rather than dynamic book-based selection. Here's why:

**Problem with Dynamic Namespaces:**
- Pinecone functions are tightly coupled to specific namespace content
- Each namespace contains specialized content optimized for particular function types
- User book selection could break function functionality if content doesn't match function expectations

**Implemented Solution:**
```typescript
// Triage AI Functions (10) - New Therapeutic Content
const result = await queryTherapeuticContent({
  query: queryText,
  namespace: 'therapeutic_youth_v3', // Hard-coded
  filter_metadata: { module: 'safety_triage' }
});

// Legacy Mental Health Functions (14) - Proven Content  
const result = await queryTherapeuticContent({
  query: queryText,
  namespace: 'trauma_informed_youth_mental_health_companion_v250420', // Hard-coded
  filter_metadata: { techniques: ['grounding'] }
});

// Resource Locator Functions (15) - External APIs (No Pinecone)
// These use web search APIs, not Pinecone namespaces
```

#### **Function Categories and Namespace Assignment**

**✅ Triage AI Functions** → `therapeutic_youth_v3`:
- `get_safety_triage_protocol`
- `get_conversation_stance_guidance`
- `get_assessment_protocol`
- `get_continuity_framework`
- `get_cbt_intervention`
- `get_dbt_skills`
- `get_trauma_informed_approach`
- `get_substance_use_support`
- `get_practical_support_guidance`
- `get_acute_distress_protocol`

**✅ Legacy Mental Health Functions** → `trauma_informed_youth_mental_health_companion_v250420`:
- `problem_solving_function`
- `screening_function`
- `cultural_humility_function`
- `grounding_function`
- `thought_exploration_function`
- `crisis_response_function`
- `psychoeducation_function`
- `validation_function`
- `pathway_exploration_function`
- `educational_guidance_function`
- `skill_building_function`
- `goal_planning_function`
- `futures_assessment_function`
- `resource_connection_function`

**✅ Resource Locator Functions** → No Namespace (External APIs):
- All 15 resource locator functions use external web APIs
- No Pinecone dependency

#### **Architectural Trade-offs**

**✅ Benefits of Hard-Coded Approach:**
- **Reliability**: Functions always get content they're designed to work with
- **Performance**: No dynamic namespace lookup overhead
- **Predictability**: Function behavior is consistent regardless of user choices
- **Content Integrity**: Specialized content stays with specialized functions

**⚠️ Limitations of Hard-Coded Approach:**
- **Flexibility**: Users can't easily switch content domains for functions
- **Multi-Domain Support**: Each function type locked to one content area  
- **Future Expansion**: Adding new domains requires code changes
- **Book Selection Impact**: User book selection only affects UI, not function content

#### **Alternative Architectures Considered**

**Option 1: Dynamic Book-Based** (Rejected)
```typescript
// Would break if user selects sleep book for mental health functions
const bookData = await getBookFromDatabase(selectedBookId);
const namespace = bookData?.pinecone_namespace; // Unreliable
```

**Option 2: Specialist-Based Configuration** (Future Consideration)
```typescript
// Could be implemented later
const specialistToNamespaceMap = {
  'mental_health_triage': 'therapeutic_youth_v3',
  'sleep_wellness': 'SleepWiseHowtoFeelBetterDanielBlum',
  'addiction_support': 'dopamine_nation'
};
```

**Option 3: Hybrid Configuration** (Future Consideration)  
```typescript
// Allow override while maintaining function-specific defaults
const getNamespace = (functionType, userBookId) => {
  const functionDefaults = {
    'triage': 'therapeutic_youth_v3',
    'legacy': 'trauma_informed_youth_mental_health_companion_v250420'
  };
  return bookOverrideMap[userBookId] || functionDefaults[functionType];
};
```

### **Future Considerations** 🔮

**This hard-coded approach may be ideal for the current V16 use case, or this may be something we revisit someday.**

**Scenarios that might warrant revisiting:**

1. **Multi-Domain Expansion**: If V16 needs to support sleep, addiction, and mental health simultaneously
2. **Tenant-Specific Content**: If different organizations need different content sets  
3. **A/B Testing**: If we need to test different content versions for the same functions
4. **User Customization**: If advanced users need to choose specialized content domains
5. **International Deployment**: If different regions need culturally-specific content

**For now, the hard-coded approach provides:**
- **Immediate Functionality**: V16 works reliably with appropriate content
- **Clear Separation**: Each function type has its dedicated, tested content
- **Simplified Architecture**: No complex namespace resolution logic needed
- **Consistent Experience**: All users get the same high-quality therapeutic content

**The implementation successfully balances functional requirements with architectural simplicity while maintaining the option to add configurability in future versions if needed.**