/**
 * Type definitions for Futures Pathways functions
 * These types define the parameter interfaces for the 6 new Futures Pathways functions
 */

// Futures Pathways function parameter types
export interface PathwayExplorationParams {
  interests: string[];
  skills?: string[];
  education_level: 'in_high_school' | 'graduated_high_school' | 'ged_needed' | 'some_college' | 'college_graduate' | 'left_school';
  immediate_needs?: 'income_needed' | 'stable_housing' | 'family_support' | 'no_immediate_pressure' | 'other';
}

export interface EducationalGuidanceParams {
  pathway_type: 'college' | 'trade_school' | 'ged_program' | 'vocational_training' | 'apprenticeship' | 'all_options';
  financial_situation?: 'need_financial_aid' | 'can_pay_some' | 'need_work_while_studying' | 'unsure';
  timeline?: 'immediately' | 'within_6_months' | 'within_year' | 'flexible' | 'unsure';
}

export interface SkillBuildingParams {
  skill_area: 'resume_writing' | 'interview_prep' | 'budgeting' | 'communication' | 'digital_literacy' | 'job_search' | 'all_skills';
  current_level?: 'beginner' | 'some_experience' | 'need_refresher';
  immediate_application?: string;
}

export interface GoalPlanningParams {
  goal_description: string;
  goal_type: 'career_goal' | 'education_goal' | 'skill_development' | 'job_search' | 'life_stability';
  timeline?: '1_month' | '3_months' | '6_months' | '1_year' | 'longer_term' | 'flexible';
  current_barriers?: string[];
}

export interface ResourceConnectionParams {
  connection_type: 'networking' | 'volunteer_opportunities' | 'internships' | 'job_shadowing' | 'mentorship' | 'all_types';
  field_of_interest: string;
  comfort_level?: 'very_comfortable' | 'somewhat_comfortable' | 'nervous_but_willing' | 'need_support';
}

export interface FuturesAssessmentParams {
  assessment_area: 'full_assessment' | 'interests_only' | 'skills_only' | 'education_status' | 'work_experience' | 'immediate_needs';
  user_comfort_level?: 'comfortable_sharing' | 'prefer_minimal' | 'very_private';
}

// Function result types
export interface FuturesPathwaysResult {
  success: boolean;
  content?: string;
  message?: string;
  error?: boolean;
  [key: string]: unknown;
}

// Extended hook interface for mental health functions that now includes futures pathways
export interface UseMentalHealthFunctionsReturn {
  // Existing mental health functions
  mentalHealthFunctions: unknown[];
  registerMentalHealthFunctions: (registerFunction: (name: string, fn: unknown) => void) => void;
  lastFunctionResult: unknown;
  functionError: string | null;
  
  // New Futures Pathways functions (these would be added to the hook return if exposed directly)
  pathwayExplorationFunction?: (params: PathwayExplorationParams) => Promise<FuturesPathwaysResult>;
  educationalGuidanceFunction?: (params: EducationalGuidanceParams) => Promise<FuturesPathwaysResult>;
  skillBuildingFunction?: (params: SkillBuildingParams) => Promise<FuturesPathwaysResult>;
  goalPlanningFunction?: (params: GoalPlanningParams) => Promise<FuturesPathwaysResult>;
  resourceConnectionFunction?: (params: ResourceConnectionParams) => Promise<FuturesPathwaysResult>;
  futuresAssessmentFunction?: (params: FuturesAssessmentParams) => Promise<FuturesPathwaysResult>;
}

// Pinecone metadata filters for Futures Pathways content
export interface FuturesPathwaysMetadata {
  feature: ['futures_pathways_skill_builder'];
  section_type: string[];
  target_population: ['at_risk_youth'];
  trauma_informed_principles?: string[];
  user_journey_stage?: string[];
}

// Example test queries for validation
export interface FuturesPathwaysTestQueries {
  pathway_exploration: PathwayExplorationParams;
  educational_guidance: EducationalGuidanceParams;
  skill_building: SkillBuildingParams;
  goal_planning: GoalPlanningParams;
  resource_connection: ResourceConnectionParams;
  futures_assessment: FuturesAssessmentParams;
}