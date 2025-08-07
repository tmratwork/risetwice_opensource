// src/hooksV15/functions/sleep/use-how-to-sleep-well-functions-v15.ts

"use client";

import { useState, useCallback, useMemo } from 'react';
import audioLogger from '../../audio/audio-logger';
import type { GPTFunction } from '../use-book-functions-v15';

/**
 * V15 Sleep Functions Hook - Dr. Neil Stanley's Evidence-Based Approach
 * Based on "How to Sleep Well: The Science of Sleeping Smarter, Living Better and Being Productive"
 * Implements Stanley's myth-busting, individual-focused sleep science
 */

export interface SleepFunctionResult {
  success: boolean;
  data?: {
    content?: string[];
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
  error?: string;
  [key: string]: unknown;
}

export function useHowToSleepWellFunctionsV15() {
  const [lastFunctionResult, setLastFunctionResult] = useState<SleepFunctionResult | null>(null);
  const [functionError, setFunctionError] = useState<string | null>(null);

  // Helper function to query book content
  const queryBookContent = useCallback(async (params: {
    query: string;
    namespace: string;
    filter_metadata?: Record<string, unknown>;
    book?: string;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] queryBookContent called with requestId: ${requestId}`);
    audioLogger.info('function', 'query_book_content_called', {
      requestId,
      query: params.query,
      namespace: params.namespace
    });

    try {
      setFunctionError(null);

      const userId = localStorage.getItem('userId');
      if (!userId) {
        throw new Error('No user ID available');
      }

      const finalNamespace = params.namespace || 'how_to_sleep_well_neil_stanley_v250420';
      const bookId = params.book || 'how_to_sleep_well_neil_stanley';

      const response = await fetch('/api/v11/book-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          book: bookId,
          query: params.query,
          namespace: finalNamespace,
          filter_metadata: params.filter_metadata
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      setLastFunctionResult(data);

      if (!data.content) {
        throw new Error('No content found for query');
      }

      console.log(`[function] queryBookContent success for requestId: ${requestId}`);
      audioLogger.info('function', 'query_book_content_success', { requestId });

      return {
        success: true,
        content: data.content,
        matches: data.matches || 0,
        message: data.content
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] queryBookContent error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'query_book_content_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error querying sleep content: ${errorMessage}`
      };
    }
  }, []);

  // === CORE SLEEP SCIENCE FUNCTIONS ===

  const individualSleepNeedAssessment = useCallback(async (params: {
    current_sleep_duration: string;
    daytime_alertness_level: string;
    sleep_satisfaction: string;
    sleep_duration_anxiety?: boolean;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] individual_sleep_need_assessment called with requestId: ${requestId}`);
    audioLogger.info('function', 'individual_sleep_need_assessment_called', {
      requestId,
      current_sleep_duration: params.current_sleep_duration,
      daytime_alertness_level: params.daytime_alertness_level
    });

    try {
      setFunctionError(null);

      const queryText = `individual sleep needs assessment ${params.current_sleep_duration.replace('_', ' ')} ${params.daytime_alertness_level.replace('_', ' ')} debunking 8 hour myth genetic sleep requirements`;

      const result = await queryBookContent({
        query: queryText,
        namespace: 'how_to_sleep_well_neil_stanley_v250420',
        filter_metadata: {
          techniques: ['sleep_assessment', 'individual_optimization'],
          function_mapping: ['individual_sleep_need_assessment'],
          principles: ['sleep_individuality', '8_hour_myth_debunking']
        }
      });

      // Enhance response with Stanley's individualized approach
      const enhancedMessage = result.message + 
        `\n\n**Your Individual Sleep Assessment:**\n` +
        `Based on Dr. Stanley's research, sleep needs are as individual as height - ranging from 3-11 hours per night. ` +
        `The "8-hour rule" is just an average, not a requirement. Your current ${params.current_sleep_duration.replace('_', ' ')} ` +
        `combined with ${params.daytime_alertness_level.replace('_', ' ')} suggests your individual sleep needs may be ` +
        (params.daytime_alertness_level === 'consistently_alert' ? 'well-matched to your current duration.' : 'different from your current pattern.') +
        `\n\nKey insight: Focus on how you feel during the day, not the clock. Quality and individual optimization matter more than arbitrary hour targets.` +
        (params.sleep_duration_anxiety ? `\n\n**Important:** Your worry about not getting 8 hours may be causing more sleep problems than your actual sleep duration. Let's work on finding YOUR optimal sleep amount.` : '');

      console.log(`[function] individual_sleep_need_assessment success for requestId: ${requestId}`);
      audioLogger.info('function', 'individual_sleep_need_assessment_success', { requestId });

      return {
        ...result,
        message: enhancedMessage,
        assessment_type: 'individual_sleep_needs',
        stanley_principle: 'sleep_individuality'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] individual_sleep_need_assessment error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'individual_sleep_need_assessment_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error assessing individual sleep needs: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  const bedroomEnvironmentOptimization = useCallback(async (params: {
    light_sources_present: string[];
    noise_level_estimate: string;
    room_temperature: string;
    bed_comfort_rating: string;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] bedroom_environment_optimization called with requestId: ${requestId}`);
    audioLogger.info('function', 'bedroom_environment_optimization_called', {
      requestId,
      light_sources: params.light_sources_present.length,
      noise_level: params.noise_level_estimate
    });

    try {
      setFunctionError(null);

      const queryText = `bedroom environment optimization darkness quiet cool comfortable ${params.noise_level_estimate.replace('_', ' ')} ${params.room_temperature.replace('_', ' ')} Stanley sleep environment criteria`;

      const result = await queryBookContent({
        query: queryText,
        namespace: 'how_to_sleep_well_neil_stanley_v250420',
        filter_metadata: {
          techniques: ['environment_optimization', 'sleep_hygiene'],
          function_mapping: ['bedroom_environment_optimization'],
          environment_factors: ['darkness', 'quiet', 'temperature', 'comfort']
        }
      });

      // Provide specific Stanley-based recommendations
      const lightRecommendations = params.light_sources_present.length > 0 ? 
        `\n\n**Light Source Issues to Address:**\n${params.light_sources_present.map(source => 
          `• ${source.replace('_', ' ')}: ${source === 'digital_clock' ? 'Turn display away or cover' : 
            source === 'phone_charger' ? 'Charge phone outside bedroom' : 
            source === 'street_lights' ? 'Install blackout curtains or eye mask' : 'Eliminate this light source'}`
        ).join('\n')}` : 
        '\n\n**Excellent:** Your bedroom appears to be properly dark, which is essential for quality sleep.';

      const noiseRecommendations = params.noise_level_estimate === 'noisy_environment' ? 
        '\n\n**Noise Management:** Stanley recommends ≤35 decibels for optimal sleep. Consider earplugs, white noise, or addressing noise sources.' : 
        params.noise_level_estimate === 'moderate_noise' ? 
        '\n\n**Noise Level:** Some improvement possible. Stanley emphasizes that even moderate noise can fragment sleep quality.' : 
        '\n\n**Good:** Your quiet environment supports Stanley\'s recommendation for minimal bedroom noise.';

      const enhancedMessage = result.message + lightRecommendations + noiseRecommendations +
        `\n\n**Stanley's Environmental Priorities:**\n` +
        `1. **Complete Darkness:** Remove ALL light sources - even small ones disrupt sleep\n` +
        `2. **Quiet Environment:** ≤35 decibels for optimal sleep quality\n` +
        `3. **Cool Temperature:** Slightly cool room supports natural temperature drop for sleep\n` +
        `4. **Comfortable Surface:** Investment in comfort pays dividends in sleep quality\n\n` +
        `Remember: Focus on what you can control. Small environmental changes often yield significant sleep improvements.`;

      console.log(`[function] bedroom_environment_optimization success for requestId: ${requestId}`);
      audioLogger.info('function', 'bedroom_environment_optimization_success', { requestId });

      return {
        ...result,
        message: enhancedMessage,
        optimization_areas: ['darkness', 'noise', 'temperature', 'comfort'],
        stanley_principle: 'environmental_optimization'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] bedroom_environment_optimization error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'bedroom_environment_optimization_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error optimizing bedroom environment: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  const chronotypeIdentification = useCallback(async (params: {
    natural_bedtime_preference: string;
    natural_wake_preference: string;
    energy_peak_times: string[];
    forced_schedule_impact?: string;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] chronotype_identification called with requestId: ${requestId}`);
    audioLogger.info('function', 'chronotype_identification_called', {
      requestId,
      bedtime_preference: params.natural_bedtime_preference,
      wake_preference: params.natural_wake_preference
    });

    try {
      setFunctionError(null);

      const queryText = `chronotype identification circadian rhythm ${params.natural_bedtime_preference.replace('_', ' ')} ${params.natural_wake_preference.replace('_', ' ')} night owl morning lark individual biology`;

      const result = await queryBookContent({
        query: queryText,
        namespace: 'how_to_sleep_well_neil_stanley_v250420',
        filter_metadata: {
          techniques: ['chronotype_assessment', 'circadian_rhythm'],
          function_mapping: ['chronotype_identification'],
          principles: ['individual_biology', 'circadian_respect']
        }
      });

      // Determine likely chronotype based on patterns
      const isNightOwl = params.natural_bedtime_preference === 'late_night' && 
                         params.natural_wake_preference === 'late_morning' &&
                         params.energy_peak_times.includes('evening');
      
      const isMorningLark = params.natural_bedtime_preference === 'early_evening' && 
                           params.natural_wake_preference === 'early_morning' &&
                           params.energy_peak_times.includes('early_morning');

      const chronotypeAssessment = isNightOwl ? 'night owl' : 
                                  isMorningLark ? 'morning lark' : 
                                  'intermediate chronotype';

      const enhancedMessage = result.message +
        `\n\n**Your Chronotype Assessment:**\n` +
        `Based on your natural preferences, you appear to be a **${chronotypeAssessment}**.\n\n` +
        `**Stanley's Key Insight:** Chronotypes are biologically determined, not lifestyle choices. ` +
        `Working against your natural rhythm creates sleep problems and daytime dysfunction.\n\n` +
        `**Your Natural Pattern:**\n` +
        `• Preferred bedtime: ${params.natural_bedtime_preference.replace('_', ' ')}\n` +
        `• Natural wake time: ${params.natural_wake_preference.replace('_', ' ')}\n` +
        `• Energy peaks: ${params.energy_peak_times.map(time => time.replace('_', ' ')).join(', ')}\n\n` +
        (params.forced_schedule_impact === 'significant_struggle' ? 
          `**Important:** Your struggle with forced schedules confirms you're working against your biology. ` +
          `Stanley emphasizes that respecting your chronotype improves both sleep quality and life satisfaction.` :
          params.forced_schedule_impact === 'mild_difficulty' ?
          `Your mild difficulty with forced schedules suggests room for chronotype optimization.` :
          `Your adaptability to different schedules is common with intermediate chronotypes.`) +
        `\n\n**Recommendation:** When possible, align your sleep schedule with your natural chronotype for optimal sleep quality and daytime functioning.`;

      console.log(`[function] chronotype_identification success for requestId: ${requestId}`);
      audioLogger.info('function', 'chronotype_identification_success', { requestId });

      return {
        ...result,
        message: enhancedMessage,
        identified_chronotype: chronotypeAssessment,
        stanley_principle: 'circadian_rhythm_respect'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] chronotype_identification error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'chronotype_identification_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error identifying chronotype: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  const sleepMythDebunkingEducation = useCallback(async (params: {
    current_sleep_beliefs: string[];
    sleep_anxiety_sources?: string[];
    information_sources?: string[];
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] sleep_myth_debunking_education called with requestId: ${requestId}`);
    audioLogger.info('function', 'sleep_myth_debunking_education_called', {
      requestId,
      beliefs_count: params.current_sleep_beliefs.length
    });

    try {
      setFunctionError(null);

      const beliefsList = params.current_sleep_beliefs.join(' ');
      const queryText = `sleep myths debunking evidence based science ${beliefsList.replace(/_/g, ' ')} Stanley myth busting humor scientific evidence`;

      const result = await queryBookContent({
        query: queryText,
        namespace: 'how_to_sleep_well_neil_stanley_v250420',
        filter_metadata: {
          techniques: ['myth_debunking', 'sleep_education'],
          function_mapping: ['sleep_myth_debunking_education'],
          principles: ['evidence_based', 'myth_busting']
        }
      });

      // Address specific myths with Stanley's approach
      const mythDebunking = params.current_sleep_beliefs.map(belief => {
        switch (belief) {
          case 'need_exactly_8_hours':
            return '• **8-Hour Myth:** Sleep needs are individual (3-11 hours). 8 hours is just an average, not a requirement.';
          case 'blue_light_dangerous':
            return '• **Blue Light Overblown:** Stanley questions excessive blue light concerns. Mental stimulation matters more than light wavelength.';
          case 'weekend_catchup_works':
            return '• **Weekend Catch-up Myth:** You can\'t "repay" sleep debt. Consistent schedule is more important.';
          case 'alcohol_helps_sleep':
            return '• **Alcohol Misconception:** While alcohol may help you fall asleep, it significantly disrupts sleep quality.';
          case 'older_need_less_sleep':
            return '• **Age Sleep Myth:** Sleep needs don\'t change with age - they\'re fixed by early twenties.';
          case 'counting_sheep_effective':
            return '• **Counting Sheep Ineffective:** This technique often increases mental arousal rather than promoting sleep.';
          default:
            return `• **${belief.replace(/_/g, ' ')}:** This belief may not be supported by current sleep science.`;
        }
      }).join('\n');

      const enhancedMessage = result.message +
        `\n\n**Stanley's Myth-Busting Analysis:**\n${mythDebunking}\n\n` +
        `**Stanley's Core Message:** Sleep science is often misrepresented by the sleep industry and popular media. ` +
        `Focus on evidence-based principles rather than trendy sleep "hacks" or anxiety-provoking rules.\n\n` +
        (params.sleep_anxiety_sources?.length ? 
          `**Addressing Your Sleep Anxiety Sources:**\n` +
          `${params.sleep_anxiety_sources.map(source => 
            source === 'not_enough_hours' ? '- Hour anxiety: Focus on how you feel, not the clock' :
            source === 'sleep_tracking_data' ? '- Tracking stress: Stanley is skeptical of sleep devices - trust your body' :
            source === 'sleep_debt' ? '- Sleep debt worry: Consistency matters more than "making up" sleep' :
            `- ${source.replace('_', ' ')}: Address with evidence-based understanding`
          ).join('\n')}\n\n` : '') +
        `**Remember:** Stanley combines rigorous science with humor. Sleep should improve your life, not become another source of stress.`;

      console.log(`[function] sleep_myth_debunking_education success for requestId: ${requestId}`);
      audioLogger.info('function', 'sleep_myth_debunking_education_success', { requestId });

      return {
        ...result,
        message: enhancedMessage,
        myths_addressed: params.current_sleep_beliefs.length,
        stanley_principle: 'evidence_based_myth_busting'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] sleep_myth_debunking_education error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'sleep_myth_debunking_education_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error providing myth-busting education: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // === SLEEP OPTIMIZATION FUNCTIONS ===

  const personalizedBedroomRoutineCreation = useCallback(async (params: {
    current_bedtime_activities: string[];
    routine_effectiveness: string;
    available_time_window: string;
    stimulating_activities_present: boolean;
  }): Promise<SleepFunctionResult> => {
    const requestId = Date.now().toString().slice(-6);

    console.log(`[function] personalized_bedtime_routine_creation called with requestId: ${requestId}`);
    audioLogger.info('function', 'personalized_bedtime_routine_creation_called', {
      requestId,
      current_effectiveness: params.routine_effectiveness,
      time_window: params.available_time_window
    });

    try {
      setFunctionError(null);

      const activitiesList = params.current_bedtime_activities.join(' ');
      const queryText = `bedtime routine personalized ${activitiesList.replace(/_/g, ' ')} ${params.available_time_window.replace('_', ' ')} avoiding cognitive arousal individual optimization`;

      const result = await queryBookContent({
        query: queryText,
        namespace: 'how_to_sleep_well_neil_stanley_v250420',
        filter_metadata: {
          techniques: ['bedtime_routine', 'individual_optimization'],
          function_mapping: ['personalized_bedtime_routine_creation'],
          principles: ['cognitive_arousal_avoidance', 'individual_solutions']
        }
      });

      // Analyze current activities and provide recommendations
      const stimulatingActivities = params.current_bedtime_activities.filter(activity =>
        ['screen_time', 'work_emails', 'social_media', 'tv'].includes(activity)
      );

      const calmingActivities = params.current_bedtime_activities.filter(activity =>
        ['reading', 'bath', 'meditation', 'light_stretching'].includes(activity)
      );

      const timeBasedRecommendations = {
        '30_minutes': [
          'Simple reading (physical book)',
          'Gentle stretching or relaxation',
          'Quiet preparation activities'
        ],
        '1_hour': [
          'Gradual wind-down activities',
          'Reading or light hobby',
          'Relaxing bath or shower',
          'Gentle self-care routine'
        ],
        '2_hours': [
          'Complete transition from day activities',
          'Longer reading or quiet hobbies',
          'Relaxing activities of choice',
          'Gradual lighting reduction'
        ]
      };

      const recommendations = timeBasedRecommendations[params.available_time_window as keyof typeof timeBasedRecommendations] || timeBasedRecommendations['1_hour'];

      const enhancedMessage = result.message +
        `\n\n**Your Personalized Routine Analysis:**\n` +
        (stimulatingActivities.length > 0 ? 
          `**Activities to Modify:** ${stimulatingActivities.map(activity => activity.replace('_', ' ')).join(', ')}\n` +
          `Stanley emphasizes avoiding cognitively arousing activities before bed.\n\n` : '') +
        (calmingActivities.length > 0 ? 
          `**Keep These Activities:** ${calmingActivities.map(activity => activity.replace('_', ' ')).join(', ')}\n` +
          `These align well with Stanley's sleep preparation principles.\n\n` : '') +
        `**Recommended Routine for ${params.available_time_window.replace('_', ' ')}:**\n` +
        recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n') +
        `\n\n**Stanley's Key Principle:** Your routine should be individualized and avoid mental stimulation. ` +
        `What works for others may not work for you - find YOUR optimal pre-sleep activities.\n\n` +
        `**Implementation Tips:**\n` +
        `• Start with one change at a time\n` +
        `• Focus on consistency rather than perfection\n` +
        `• Adjust based on what actually works for YOU\n` +
        `• Remember: the goal is preparing your mind and body for sleep, not following rigid rules`;

      console.log(`[function] personalized_bedtime_routine_creation success for requestId: ${requestId}`);
      audioLogger.info('function', 'personalized_bedtime_routine_creation_success', { requestId });

      return {
        ...result,
        message: enhancedMessage,
        routine_time_window: params.available_time_window,
        recommendations_provided: recommendations.length,
        stanley_principle: 'individual_optimization'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[function] personalized_bedtime_routine_creation error for requestId: ${requestId}: ${errorMessage}`);
      audioLogger.error('function', 'personalized_bedtime_routine_creation_failed', error as Error, { requestId });
      setFunctionError(errorMessage);

      return {
        success: false,
        error: `Error creating personalized bedtime routine: ${errorMessage}`
      };
    }
  }, [queryBookContent]);

  // Get sleep functions for GPT function definitions
  const sleepFunctions: GPTFunction[] = useMemo(() => {
    console.log(`[sleep] Generating sleep function definitions for Neil Stanley's book`);

    return [
      {
        type: 'function',
        name: 'individual_sleep_need_assessment',
        description: 'Assesses individual sleep requirements based on Stanley\'s principle that sleep needs are genetically determined, debunking the 8-hour myth through evaluation of personal patterns and daytime functioning',
        parameters: {
          type: 'object',
          properties: {
            current_sleep_duration: {
              type: 'string',
              description: 'User\'s typical nightly sleep duration',
              enum: ['3_hours', '4_hours', '5_hours', '6_hours', '7_hours', '8_hours', '9_hours', '10_hours', '11_hours']
            },
            daytime_alertness_level: {
              type: 'string',
              description: 'How alert user feels during the day',
              enum: ['consistently_alert', 'sometimes_drowsy', 'frequently_tired']
            },
            sleep_satisfaction: {
              type: 'string',
              description: 'How refreshed user feels upon waking',
              enum: ['well_rested', 'somewhat_rested', 'unrefreshed']
            },
            sleep_duration_anxiety: {
              type: 'boolean',
              description: 'Whether user worries about not getting 8 hours'
            }
          },
          required: ['current_sleep_duration', 'daytime_alertness_level', 'sleep_satisfaction']
        }
      },
      {
        type: 'function',
        name: 'bedroom_environment_optimization',
        description: 'Evaluates and optimizes sleep environment using Stanley\'s evidence-based criteria for darkness, noise, temperature, and comfort',
        parameters: {
          type: 'object',
          properties: {
            light_sources_present: {
              type: 'array',
              items: { type: 'string' },
              description: 'Current light sources in bedroom'
            },
            noise_level_estimate: {
              type: 'string',
              description: 'Approximate bedroom noise level',
              enum: ['very_quiet', 'moderate_noise', 'noisy_environment']
            },
            room_temperature: {
              type: 'string',
              description: 'Typical bedroom temperature',
              enum: ['too_warm', 'comfortable_cool', 'too_cold']
            },
            bed_comfort_rating: {
              type: 'string',
              description: 'Current bed and pillow comfort',
              enum: ['very_comfortable', 'adequate', 'uncomfortable']
            }
          },
          required: ['light_sources_present', 'noise_level_estimate', 'room_temperature', 'bed_comfort_rating']
        }
      },
      {
        type: 'function',
        name: 'chronotype_identification',
        description: 'Identifies natural chronotype using Stanley\'s approach to respecting individual circadian rhythms rather than forcing artificial schedules',
        parameters: {
          type: 'object',
          properties: {
            natural_bedtime_preference: {
              type: 'string',
              description: 'When user naturally feels sleepy',
              enum: ['early_evening', 'mid_evening', 'late_night']
            },
            natural_wake_preference: {
              type: 'string',
              description: 'When user naturally wakes without alarms',
              enum: ['early_morning', 'mid_morning', 'late_morning']
            },
            energy_peak_times: {
              type: 'array',
              items: { type: 'string' },
              description: 'When user feels most alert and energetic'
            },
            forced_schedule_impact: {
              type: 'string',
              description: 'How forced schedules affect the user',
              enum: ['no_impact', 'mild_difficulty', 'significant_struggle']
            }
          },
          required: ['natural_bedtime_preference', 'natural_wake_preference', 'energy_peak_times']
        }
      },
      {
        type: 'function',
        name: 'sleep_myth_debunking_education',
        description: 'Provides evidence-based corrections to sleep myths using Stanley\'s scientific approach, helping users distinguish between proven science and misconceptions',
        parameters: {
          type: 'object',
          properties: {
            current_sleep_beliefs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sleep-related beliefs user currently holds'
            },
            sleep_anxiety_sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'What sleep-related topics cause user worry'
            },
            information_sources: {
              type: 'array',
              items: { type: 'string' },
              description: 'Where user gets sleep information'
            }
          },
          required: ['current_sleep_beliefs']
        }
      },
      {
        type: 'function',
        name: 'personalized_bedtime_routine_creation',
        description: 'Creates individualized pre-sleep routines based on Stanley\'s principles, avoiding generic advice and focusing on individual effectiveness',
        parameters: {
          type: 'object',
          properties: {
            current_bedtime_activities: {
              type: 'array',
              items: { type: 'string' },
              description: 'What user currently does before bed'
            },
            routine_effectiveness: {
              type: 'string',
              description: 'How well current routine works',
              enum: ['very_effective', 'somewhat_effective', 'ineffective']
            },
            available_time_window: {
              type: 'string',
              description: 'How much time user has for bedtime routine',
              enum: ['30_minutes', '1_hour', '2_hours']
            },
            stimulating_activities_present: {
              type: 'boolean',
              description: 'Whether current routine includes stimulating activities'
            }
          },
          required: ['current_bedtime_activities', 'routine_effectiveness', 'available_time_window', 'stimulating_activities_present']
        }
      }
    ];
  }, []);

  // Function registry for WebRTC system
  const functionRegistry = useMemo(() => {
    console.log(`[sleep] Creating sleep function registry for Neil Stanley's book`);

    const registry = {
      'individual_sleep_need_assessment': individualSleepNeedAssessment,
      'bedroom_environment_optimization': bedroomEnvironmentOptimization,
      'chronotype_identification': chronotypeIdentification,
      'sleep_myth_debunking_education': sleepMythDebunkingEducation,
      'personalized_bedtime_routine_creation': personalizedBedroomRoutineCreation,
      'query_book_content': queryBookContent,
    };

    console.log(`[sleep] Function registry created with ${Object.keys(registry).length} functions`);
    return registry;
  }, [
    individualSleepNeedAssessment,
    bedroomEnvironmentOptimization,
    chronotypeIdentification,
    sleepMythDebunkingEducation,
    personalizedBedroomRoutineCreation,
    queryBookContent
  ]);

  // Get available functions for session configuration
  const getAvailableFunctions = useMemo((): (() => GPTFunction[]) => {
    return () => sleepFunctions;
  }, [sleepFunctions]);

  const hookReturn = {
    // Sleep function implementations
    individualSleepNeedAssessment,
    bedroomEnvironmentOptimization,
    chronotypeIdentification,
    sleepMythDebunkingEducation,
    personalizedBedroomRoutineCreation,
    queryBookContent,

    // Registry and configuration
    functionRegistry,
    getAvailableFunctions,

    // State
    lastFunctionResult,
    functionError,

    // Utility
    clearFunctionError: useCallback(() => setFunctionError(null), []),
    clearLastResult: useCallback(() => setLastFunctionResult(null), [])
  };

  console.log(`[sleep] Sleep functions hook returning ${Object.keys(hookReturn).length} items`);
  console.log(`[sleep] Function registry has ${Object.keys(hookReturn.functionRegistry).length} functions`);

  return hookReturn;
}