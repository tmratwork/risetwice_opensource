# V15/V16 Function System Documentation

## Overview

The V15/V16 function system provides a comprehensive mental health support framework with 34 specialized functions organized across 8 major categories. 

**Key Architectural Difference:**
- **V15**: Functions are **hardcoded in the codebase** - loaded from hook files in `/src/hooksV15/functions/`
- **V16**: Functions are **loaded from Supabase database** - stored in `ai_prompts` table and loaded dynamically based on AI specialist type

This enables both immediate crisis intervention and long-term pathway planning for at-risk youth.

## Architecture Comparison

### V15 Function Architecture (Hardcoded)
- **Source**: Functions defined in hook files in `/src/hooksV15/functions/`
- **Loading**: Direct imports and hook-based registration
- **Function Registry**: `FunctionRegistryManager` maps function names to implementations
- **Key Files**:
  - `/src/hooksV15/functions/use-mental-health-functions-v15.ts` - 36 mental health functions
  - `/src/hooksV15/functions/use-book-functions-v15.ts` - Book-related functions
  - `/src/hooksV15/functions/use-sleep-functions-v15.ts` - Sleep-related functions
  - `/src/hooksV15/use-function-registration.ts` - Orchestrates function registration

### V16 Function Architecture (Database-Driven)
- **Source**: Function definitions stored in Supabase database
- **Loading**: Dynamic loading from `ai_prompts` table based on AI specialist type
- **Function Registry**: `executeFunctionImplementation()` routes to appropriate implementations
- **Key Files**:
  - `/src/hooksV16/use-supabase-functions.ts` - Main database function loader
  - `/src/hooksV16/use-mental-health-functions-v16.ts` - Function implementations
  - `/src/app/api/v16/load-functions/route.ts` - API endpoint for loading functions

## Database Architecture (V16 Only)

### Core Tables

#### `function_templates` Table
Stores all available function templates with complete OpenAI function definitions:

- `id` (UUID) - Primary key
- `name` (TEXT) - Function name (snake_case)
- `description` (TEXT) - Function description
- `category` (TEXT) - Function category
- `function_definition` (JSONB) - Complete OpenAI function definition
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

#### `ai_prompts` Table
Stores AI specialist prompts with assigned functions:

- `id` (UUID) - Primary key
- `prompt_type` (TEXT) - AI specialist type (triage, anxiety_specialist, etc.)
- `prompt_content` (TEXT) - AI instructions
- `functions` (JSONB) - Array of function definitions assigned to this AI
- `is_active` (BOOLEAN) - Whether this prompt is active
- `voice_settings` (JSONB) - Voice configuration
- `metadata` (JSONB) - Additional metadata

## Function Categories (34 Total Functions)

### 1. Content Access (1 function)
- `query_book_content` - Queries therapeutic books and resources

### 2. Crisis Support (3 functions)
- `crisis_mental_health_function` - Immediate mental health crisis resources
- `crisis_response_function` - Crisis response protocols
- `domestic_violence_support_function` - Domestic violence support

### 3. Cultural Support (1 function)
- `cultural_humility_function` - Culturally responsive approaches

### 4. Future Planning (6 functions)
- `educational_guidance_function` - Educational pathways
- `futures_assessment_function` - Initial assessment
- `goal_planning_function` - Goal setting and planning
- `pathway_exploration_function` - Career/education exploration
- `resource_connection_function` - Networking opportunities
- `skill_building_function` - Life skills development

### 5. Mental Health Core (6 functions)
- `grounding_function` - Grounding techniques
- `problem_solving_function` - Problem-solving techniques
- `psychoeducation_function` - Mental health education
- `screening_function` - Screening questions
- `thought_exploration_function` - CBT thought exploration
- `validation_function` - Validation techniques

### 6. Resource Locator (14 functions)
- `basic_needs_assistance_function` - Basic needs support
- `community_programs_function` - Community programs
- `display_map_function` - Map visualization
- `educational_support_function` - Educational resources
- `emergency_shelter_function` - Emergency housing
- `food_assistance_function` - Food resources
- `healthcare_access_function` - Healthcare services
- `job_search_assistance_function` - Employment support
- `legal_aid_function` - Legal assistance
- `lgbtq_support_function` - LGBTQ+ resources
- `resource_feedback_function` - Resource feedback
- `resource_search_function` - Web resource search
- `substance_abuse_support_function` - Addiction support
- `transportation_assistance_function` - Transportation help
- `young_parent_support_function` - Teen parent support

### 7. Session Management (3 functions)
- `end_session` - Session cleanup
- `getUserHistory_function` - User history tracking
- `logInteractionOutcome_function` - Outcome logging

### 8. System Management (2 functions)
- `report_technical_error` - Error reporting
- `trigger_specialist_handoff` - AI specialist handoffs

## Detailed Function Specifications

### 1. Mental Health Core Functions (6 functions)

#### `grounding_function`
- **Description**: Retrieves appropriate grounding techniques based on distress level
- **Parameters**: 
  - `distress_level` (required): "low", "medium", "high"
  - `technique_type` (optional): "5-4-3-2-1", "body_scan", "breathing", "physical", "mental", "present_moment"
- **Use Case**: Immediate stress relief and emotional regulation

#### `thought_exploration_function`
- **Description**: Provides cognitive behavioral techniques for exploring and challenging thought patterns
- **Parameters**: 
  - `thought_type` (required): "catastrophizing", "black_and_white", "mind_reading", "fortune_telling", "emotional_reasoning", "should_statements", "personalization", "filtering", "overgeneralization", "automatic"
  - `related_emotion` (optional): "anxiety", "depression", "anger", "shame", "guilt", "grief", "fear"
- **Use Case**: CBT-based cognitive restructuring

#### `problem_solving_function`
- **Description**: Provides structured problem-solving techniques for different types of issues
- **Parameters**: 
  - `problem_category` (required): "relationship", "academic", "work", "decision_making", "stress", "basic_needs", "social", "health", "financial", "time_management"
  - `complexity` (optional): "simple", "moderate", "complex"
- **Use Case**: Systematic approach to life challenges

#### `screening_function`
- **Description**: Retrieves appropriate screening questions and tools for mental health concerns
- **Parameters**: 
  - `concern_area` (required): "depression", "anxiety", "trauma", "substance_use", "eating_disorders", "sleep", "stress", "suicide_risk", "psychosis", "mood"
  - `assessment_purpose` (optional): "initial_screening", "progress_monitoring", "severity_assessment", "symptom_tracking"
- **Use Case**: Mental health assessment and monitoring

#### `psychoeducation_function`
- **Description**: Provides psychoeducational information about mental health topics
- **Parameters**: 
  - `topic` (required): "depression", "anxiety", "trauma", "substance_use", "eating_disorders", "sleep", "stress", "self_care", "medication", "therapy", "coping_skills", "emotional_regulation", "boundaries", "relationships", "communication"
  - `information_type` (optional): "symptoms", "causes", "treatment", "neuroscience", "course", "prevention", "impact"
- **Use Case**: Educational support and mental health literacy

#### `validation_function`
- **Description**: Provides validation techniques for different emotions and experiences
- **Parameters**: 
  - `emotion` (required): "anxiety", "depression", "anger", "shame", "guilt", "grief", "fear", "loneliness", "overwhelm", "worthlessness", "helplessness", "rejection"
  - `validation_type` (optional): "acknowledge", "normalize", "accept", "understand", "respect"
- **Use Case**: Emotional validation and support

#### `crisis_response_function`
- **Description**: Retrieves crisis response protocols for various types of mental health crises
- **Parameters**: 
  - `crisis_type` (required): "suicide", "self_harm", "panic_attack", "flashback", "dissociation", "aggression", "substance_overdose", "psychosis"
  - `urgency_level` (required): "immediate", "urgent", "concerning"
- **Use Case**: Emergency mental health intervention

#### `getUserHistory_function`
- **Description**: Retrieves information about the user's history and patterns
- **Parameters**: 
  - `history_type` (required): "function_effectiveness", "communication_preferences", "skill_progress", "recent_interactions"
- **Use Case**: Personalized care based on user history

#### `logInteractionOutcome_function`
- **Description**: Logs the outcome of different approaches or interventions
- **Parameters**: 
  - `approach_used` (required): String describing the approach
  - `effectiveness_rating` (required): "high", "medium", "low", "unclear"
  - `user_engagement` (optional): "actively_engaged", "somewhat_engaged", "minimal_engagement", "resistant"
- **Use Case**: Tracking intervention effectiveness

#### `cultural_humility_function`
- **Description**: Provides culturally responsive approaches for various identity areas
- **Parameters**: 
  - `identity_area` (required): "race", "ethnicity", "gender", "sexuality", "religion", "disability", "age", "socioeconomic", "language", "indigenous", "immigrant"
  - `resource_type` (optional): "education", "support_groups", "service_providers", "advocacy", "community"
- **Use Case**: Culturally sensitive mental health support

#### `resource_search_function`
- **Description**: Searches the web for mental health resources, services, and information
- **Parameters**: 
  - `query` (required): Search query string
  - `resource_type` (optional): "crisis_hotline", "therapy", "support_group", "substance_abuse", "community_service", "educational", "financial_assistance", "housing", "medical", "legal", "food", "clothing", "transportation", "other"
  - `location_specific` (optional): Boolean for location-based search
  - `location` (optional): Geographic location string
  - `mapView` (optional): Boolean for map visualization
- **Use Case**: Real-time resource discovery with web search

#### `resource_feedback_function`
- **Description**: Collects feedback about the resources provided to improve future recommendations
- **Parameters**: 
  - `searchId` (required): ID of the search to provide feedback on
  - `helpful` (required): Boolean rating
  - `resource_name` (optional): Specific resource name
  - `comment` (optional): Additional comments
- **Use Case**: Continuous improvement of resource recommendations

#### `display_map_function`
- **Description**: Displays the resources on a map for better visualization of locations
- **Parameters**: 
  - `searchId` (required): ID of the search to display on map
- **Use Case**: Geographic visualization of resources

#### `query_book_content`
- **Description**: Queries the content of therapeutic books and resources
- **Parameters**: 
  - `query` (required): Query string
  - `namespace` (required): Book namespace
  - `filter_metadata` (optional): Additional filtering parameters
  - `book` (optional): Specific book ID
- **Use Case**: Access to therapeutic content and evidence-based practices

### 2. Future Planning Functions (8 functions)

#### `pathway_exploration_function`
- **Description**: Helps users explore career options, educational paths, and vocational training
- **Parameters**: 
  - `interests` (required): Array of interests and hobbies
  - `skills` (optional): Array of current or desired skills
  - `education_level` (required): "in_high_school", "graduated_high_school", "ged_needed", "some_college", "college_graduate", "left_school"
  - `immediate_needs` (optional): "income_needed", "stable_housing", "family_support", "no_immediate_pressure", "other"
- **Use Case**: Career and educational pathway exploration

#### `educational_guidance_function`
- **Description**: Provides detailed information about educational pathways including college, trade schools, GED programs, and financial aid options
- **Parameters**: 
  - `pathway_type` (required): "college", "trade_school", "ged_program", "vocational_training", "apprenticeship", "all_options"
  - `financial_situation` (optional): "need_financial_aid", "can_pay_some", "need_work_while_studying", "unsure"
  - `timeline` (optional): "immediately", "within_6_months", "within_year", "flexible", "unsure"
- **Use Case**: Educational planning and support

#### `skill_building_function`
- **Description**: Connects users to life skills modules and job readiness support
- **Parameters**: 
  - `skill_area` (required): "resume_writing", "interview_prep", "budgeting", "communication", "digital_literacy", "job_search", "all_skills"
  - `current_level` (optional): "beginner", "some_experience", "need_refresher"
  - `immediate_application` (optional): Specific job or program string
- **Use Case**: Life skills development and job preparation

#### `goal_planning_function`
- **Description**: Helps users break down larger goals into manageable steps
- **Parameters**: 
  - `goal_description` (required): Specific goal string
  - `goal_type` (required): "career_goal", "education_goal", "skill_development", "job_search", "life_stability"
  - `timeline` (optional): "1_month", "3_months", "6_months", "1_year", "longer_term", "flexible"
  - `current_barriers` (optional): Array of obstacle strings
- **Use Case**: Goal setting and action planning

#### `resource_connection_function`
- **Description**: Helps users identify networking opportunities, volunteer work, internships
- **Parameters**: 
  - `connection_type` (required): "networking", "volunteer_opportunities", "internships", "job_shadowing", "mentorship", "all_types"
  - `field_of_interest` (required): Career area string
  - `comfort_level` (optional): "very_comfortable", "somewhat_comfortable", "nervous_but_willing", "need_support"
- **Use Case**: Professional networking and experience building

#### `futures_assessment_function`
- **Description**: Initial assessment for future planning needs
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Assessment of future planning readiness

### 3. Resource Locator Functions (14 functions)

#### `emergency_shelter_function`
- **Description**: Locates emergency housing resources
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Emergency housing assistance

#### `food_assistance_function`
- **Description**: Finds food resources and assistance programs
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Food security support

#### `crisis_mental_health_function`
- **Description**: Locates crisis mental health services
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Crisis mental health intervention

#### `healthcare_access_function`
- **Description**: Finds healthcare services and access points
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Healthcare navigation

#### `job_search_assistance_function`
- **Description**: Locates employment support services
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Employment assistance

#### `lgbtq_support_function`
- **Description**: Finds LGBTQ+ specific resources and support
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: LGBTQ+ community support

#### `legal_aid_function`
- **Description**: Locates legal assistance resources
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Legal support navigation

#### `educational_support_function`
- **Description**: Finds educational resources and support
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Educational assistance

#### `transportation_assistance_function`
- **Description**: Locates transportation help and resources
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Transportation support

#### `substance_abuse_support_function`
- **Description**: Finds addiction support and treatment resources
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Substance abuse treatment

#### `young_parent_support_function`
- **Description**: Locates resources for teen parents
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Teen parent support

#### `domestic_violence_support_function`
- **Description**: Finds domestic violence support resources
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Domestic violence assistance

#### `basic_needs_assistance_function`
- **Description**: Locates basic needs support (housing, food, clothing)
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Basic needs support

#### `community_programs_function`
- **Description**: Finds community programs and services
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: Community resource connection

### 4. System Management Functions (3 functions)

#### `end_session`
- **Description**: Ends the current session and triggers appropriate cleanup
- **Parameters**: None required
- **Use Case**: Session termination and cleanup

#### `report_technical_error`
- **Description**: Reports technical errors that occur during function execution
- **Parameters**: 
  - `error_type` (required): "api_error", "timeout", "missing_data", "access_denied", "format_error", "unknown"
  - `function_name` (required): Name of the function where error occurred
  - `error_message` (optional): Detailed error message
- **Use Case**: Error reporting and diagnostics

#### `trigger_specialist_handoff`
- **Description**: Enables transitions between AI specialists
- **Parameters**: (Function definition not fully specified in available data)
- **Use Case**: AI specialist handoffs in triage system

## Function Architecture

### V16 Implementation Pattern

#### Database-Driven Functions
- Functions loaded from `function_templates` table
- AI specialists receive specific function subsets via `ai_prompts` table
- Dynamic loading based on AI specialist type
- Universal functions merged with specialist-specific functions

#### Function Execution Flow
1. **Load**: `/api/v16/load-functions` loads functions for specific AI type
2. **Register**: Functions registered in `useSupabaseFunctions` hook
3. **Execute**: Functions routed through `executeFunctionImplementation`
4. **Implement**: Real implementations in `useMentalHealthFunctionsV16`

### Key API Endpoints

#### V16 Function Management
- `GET /api/v16/load-functions?aiType={type}` - Load functions for AI specialist
- `GET /api/v16/admin/function-templates` - Manage function templates
- `POST /api/v16/admin/function-templates` - Create new function templates
- `GET /api/v16/load-prompt?aiType={type}` - Load AI prompts with functions

#### V15 Legacy
- `POST /api/v15/query-book-content` - Book content queries
- Various V15 mental health endpoints for backward compatibility

## AI Specialist Function Assignments (V16 - Current Database State)

### Triage AI
- **Function Count**: 3 functions (minimal set for assessment and routing)
- **Purpose**: Initial assessment and routing to appropriate specialists
- **Special Functions**: `trigger_specialist_handoff` for routing

### Mental Health Specialists
- **Crisis Specialist**: 14 functions (crisis intervention focus)
- **Anxiety Specialist**: 15 functions (anxiety management)
- **Depression Specialist**: 17 functions (mood support)
- **Trauma Specialist**: 15 functions (trauma-informed care)
- **Substance Use Specialist**: 15 functions (addiction support)
- **CBT Specialist**: 14 functions (cognitive behavioral therapy)
- **DBT Specialist**: 15 functions (dialectical behavioral therapy)

### Support Specialists
- **Practical Support Specialist**: 25 functions (resource location focus)
- **Universal Functions**: 7 core functions (shared across all specialists)

## Function Implementation Details

### Core Implementation Files
- `/src/hooksV16/use-supabase-functions.ts` - Main function loader
- `/src/hooksV16/use-mental-health-functions-v16.ts` - Function implementations
- `/src/services/function-registry.ts` - V12 function registry (legacy)

### Database Migration Files
- `/supabase/migrations/function_templates_migration.sql` - Function template population
- `/docs/assign_functions_to_ai_specialists.sql` - AI specialist assignments

## Key Features

### 1. Dynamic Function Loading
Functions are loaded at runtime based on AI specialist type, allowing for flexible assignment and updates without code changes.

### 2. Universal Function Merging
Core functions (like `end_session`, `report_technical_error`) are automatically merged with specialist-specific functions.

### 3. Resource Search Integration
The `resource_search_function` provides real-time web search capabilities for finding current resources and services.

### 4. Memory Context Integration
Functions can access user profile data and conversation history for personalized responses.

### 5. Specialist Handoffs
The `trigger_specialist_handoff` function enables seamless transitions between AI specialists in the triage system.

### 6. Error Handling and Reporting
Comprehensive error reporting through `report_technical_error` function and detailed logging throughout the system.

### 7. Function Effectiveness Tracking
User interaction outcomes are logged through `logInteractionOutcome_function` for continuous improvement.

## Function Definition Format

Functions follow the OpenAI function calling format:

```json
{
  "type": "function",
  "name": "function_name",
  "description": "Function description",
  "parameters": {
    "type": "object",
    "properties": {
      "parameter_name": {
        "type": "string",
        "description": "Parameter description",
        "enum": ["option1", "option2", "option3"]
      }
    },
    "required": ["parameter_name"]
  }
}
```

## Development Guidelines

### Adding New Functions
1. Create function definition in `function_templates` table
2. Implement function logic in `useMentalHealthFunctionsV16`
3. Assign to appropriate AI specialists in `ai_prompts` table
4. Test function execution and error handling

### Modifying Functions
1. Update function definition in `function_templates` table
2. Update implementation in hook if needed
3. Test with all assigned AI specialists
4. Update documentation

### Function Categories
- **Mental Health Core**: Direct therapeutic interventions
- **Future Planning**: Career and educational pathway support
- **Resource Locator**: External resource finding and connection
- **System Management**: Technical and session management

## Security and Safety

### Medical Boundaries
- Functions identify when professional medical evaluation is needed
- Clear boundaries between app guidance and medical diagnosis
- References to qualified professionals for serious disorders

### Data Privacy
- Functions handle sensitive mental health information
- Logging follows privacy guidelines
- User consent for data collection and storage

### Error Handling
- Functions fail gracefully with meaningful error messages
- Critical errors are logged and reported
- No silent failures that could compromise user safety

## Future Enhancements

### Planned Features
- Additional sleep-related functions based on Dr. Neil Stanley's research
- Enhanced resource feedback and recommendation systems
- Expanded cultural humility and identity-specific support
- Advanced goal tracking and progress monitoring

### Technical Improvements
- Function performance optimization
- Enhanced error recovery mechanisms
- Advanced analytics and effectiveness tracking
- Integration with external service providers

This function system provides a comprehensive, scalable framework for mental health support that can adapt to user needs while maintaining safety and effectiveness standards.