-- SQL statements to assign function templates to appropriate AI specialists
-- Based on the 37 function templates and 9 AI specialist types

-- 1. TRIAGE AI - Gets all functions since it needs to assess and route users
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates
)
WHERE prompt_type = 'triage';

-- 2. CRISIS SPECIALIST - Crisis, emergency, and immediate safety functions
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'crisis_response_function',
    'crisis_mental_health_function',
    'domestic_violence_support_function',
    'emergency_shelter_function',
    'grounding_function',
    'validation_function',
    'screening_function',
    'resource_search_function',
    'healthcare_access_function',
    'legal_aid_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'trigger_specialist_handoff'
  )
)
WHERE prompt_type = 'crisis_specialist';

-- 3. ANXIETY SPECIALIST - Anxiety, panic, grounding, and CBT functions
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'grounding_function',
    'thought_exploration_function',
    'problem_solving_function',
    'screening_function',
    'psychoeducation_function',
    'validation_function',
    'crisis_response_function',
    'crisis_mental_health_function',
    'resource_search_function',
    'healthcare_access_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function'
  )
)
WHERE prompt_type = 'anxiety_specialist';

-- 4. DEPRESSION SPECIALIST - Depression, mood, validation, and support functions
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'grounding_function',
    'thought_exploration_function',
    'problem_solving_function',
    'screening_function',
    'psychoeducation_function',
    'validation_function',
    'crisis_response_function',
    'crisis_mental_health_function',
    'resource_search_function',
    'healthcare_access_function',
    'goal_planning_function',
    'pathway_exploration_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function'
  )
)
WHERE prompt_type = 'depression_specialist';

-- 5. TRAUMA SPECIALIST - Trauma, grounding, safety, and specialized support
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'grounding_function',
    'thought_exploration_function',
    'screening_function',
    'psychoeducation_function',
    'validation_function',
    'crisis_response_function',
    'crisis_mental_health_function',
    'domestic_violence_support_function',
    'resource_search_function',
    'healthcare_access_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function'
  )
)
WHERE prompt_type = 'trauma_specialist';

-- 6. SUBSTANCE USE SPECIALIST - Addiction, recovery, and harm reduction functions
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'screening_function',
    'psychoeducation_function',
    'validation_function',
    'problem_solving_function',
    'crisis_response_function',
    'crisis_mental_health_function',
    'substance_abuse_support_function',
    'resource_search_function',
    'healthcare_access_function',
    'goal_planning_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function'
  )
)
WHERE prompt_type = 'substance_use_specialist';

-- 7. PRACTICAL SUPPORT SPECIALIST - Resources, housing, jobs, education, basic needs
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'resource_search_function',
    'resource_feedback_function',
    'display_map_function',
    'emergency_shelter_function',
    'food_assistance_function',
    'healthcare_access_function',
    'job_search_assistance_function',
    'educational_support_function',
    'transportation_assistance_function',
    'basic_needs_assistance_function',
    'legal_aid_function',
    'young_parent_support_function',
    'lgbtq_support_function',
    'community_programs_function',
    'pathway_exploration_function',
    'educational_guidance_function',
    'skill_building_function',
    'goal_planning_function',
    'resource_connection_function',
    'futures_assessment_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function'
  )
)
WHERE prompt_type = 'practical_support_specialist';

-- 8. CBT SPECIALIST - Cognitive behavioral therapy focused functions
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'thought_exploration_function',
    'grounding_function',
    'problem_solving_function',
    'screening_function',
    'psychoeducation_function',
    'validation_function',
    'goal_planning_function',
    'skill_building_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function',
    'resource_search_function'
  )
)
WHERE prompt_type = 'cbt_specialist';

-- 9. DBT SPECIALIST - Dialectical behavioral therapy focused functions
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'grounding_function',
    'validation_function',
    'thought_exploration_function',
    'problem_solving_function',
    'screening_function',
    'psychoeducation_function',
    'crisis_response_function',
    'skill_building_function',
    'goal_planning_function',
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function',
    'resource_search_function'
  )
)
WHERE prompt_type = 'dbt_specialist';

-- 10. UNIVERSAL FUNCTIONS - Core functions that all specialists might need
UPDATE ai_prompts 
SET functions = (
  SELECT jsonb_agg(function_definition)
  FROM function_templates 
  WHERE name IN (
    'getUserHistory_function',
    'logInteractionOutcome_function',
    'end_session',
    'report_technical_error',
    'cultural_humility_function',
    'resource_search_function'
  )
)
WHERE prompt_type = 'universal_functions';

-- 11. UNIVERSAL - Keep empty as it's for universal prompts/protocols
-- (No functions assigned to universal prompt type)

-- Verification queries to check the assignments
SELECT 
  prompt_type,
  jsonb_array_length(functions) as function_count
FROM ai_prompts 
WHERE prompt_type != 'universal'
ORDER BY prompt_type;

-- Detailed check for anxiety specialist
SELECT 
  prompt_type,
  jsonb_array_length(functions) as function_count,
  (SELECT string_agg(name, ', ' ORDER BY name) 
   FROM function_templates ft 
   WHERE ft.function_definition = ANY(
     SELECT jsonb_array_elements(functions) 
     FROM ai_prompts ap2 
     WHERE ap2.prompt_type = ai_prompts.prompt_type
   )
  ) as assigned_function_names
FROM ai_prompts 
WHERE prompt_type = 'anxiety_specialist';

-- Summary of all assignments
SELECT 
  'Total AI specialists with functions assigned: ' || COUNT(*) as summary
FROM ai_prompts 
WHERE jsonb_array_length(functions) > 0;