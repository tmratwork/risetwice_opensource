
# AI Prompt: Generate Function Specifications for "How to Sleep Well: The Science of Sleeping Smarter, Living Better and Being Productive" by Dr. Neil Stanley

## Context
You are creating function specifications for a mental health AI companion app that helps users with sleep improvement. These functions will be implemented in TypeScript for a WebRTC/OpenAI realtime API system. The functions should be based on Dr. Neil Stanley's evidence-based sleep science approach.

## Book Information
- **Title**: "How to Sleep Well: The Science of Sleeping Smarter, Living Better and Being Productive"
- **Author**: Dr. Neil Stanley (PhD in Sleep Research, 35+ years experience)
- **Focus**: Evidence-based sleep science, myth-busting approach, practical sleep improvement
- **Approach**: Scientific, research-backed sleep optimization methods with individual focus
- **Target Audience**: Adults seeking scientifically-backed sleep improvement methods

## Dr. Neil Stanley's Core Principles (Key Evidence-Based Insights)

### 1. **Sleep Individuality & The "8-Hour Myth"**
- Sleep needs are as individual as height or shoe size, genetically determined
- Normal sleep range is 3-11 hours per night (8 hours is just an average)
- The key is finding YOUR optimal sleep duration that leaves you refreshed and alert

### 2. **Scientific Myth-Busting Approach**
- Debunks common sleep myths with scientific evidence and humor
- Challenges the "sleep crisis" narrative and over-hyped sleep industry claims
- Emphasizes evidence-based recommendations over trendy sleep "hacks"

### 3. **Quality Over Quantity Focus**
- Better quality sleep is more important than hitting arbitrary hour targets
- Focus on sleep efficiency and feeling refreshed rather than duration alone
- Individual optimization based on how you feel the next day

### 4. **Evidence-Based Sleep Hygiene**
- Bedroom environment: dark, quiet (≤35 decibels), cool, comfortable
- Remove all light sources, use heavy curtains or blinds
- Avoid stimulating activities 1-2 hours before bed

### 5. **"Sleep Divorce" Advocacy**
- Sleeping separately from partners if it improves sleep quality
- 50% of sleep disturbance comes from bed partners
- Separate sleeping can improve relationships by reducing sleep-related resentment

### 6. **Circadian Rhythm Respect**
- Understanding natural chronotypes (night owls vs. morning larks)
- Consistent sleep-wake times more important than arbitrary bedtimes
- Age doesn't change sleep needs - they're fixed by early twenties

### 7. **Practical Problem-Solving**
- If awake for 20+ minutes at night, get up and do something else
- Focus on what you can control rather than worrying about sleep
- "Find what works for you" rather than following generic advice

### 8. **Professional Medical Boundaries**
- Clear guidance on when to seek medical help for sleep disorders
- Distinguishes between normal sleep variations and medical conditions
- Emphasis on qualified sleep medicine professionals for serious issues

### 9. **Anti-Sleep Industry Skepticism**
- Critical of sleep tracking devices, apps, and gadgets ("not very useful")
- Skeptical of dietary supplements and unproven sleep "remedies"
- Focus on fundamental sleep principles rather than technological solutions

### 10. **Blue Light Myth Debunking**
- Questions the overblown concerns about blue light from screens
- More concerned with mental stimulation than light wavelengths
- Practical approach to technology use before bed

## Your Task
Generate detailed function specifications (NOT code) for sleep-related functions that an AI assistant could call during conversations with users about sleep improvement. Each function should align with Dr. Stanley's evidence-based, myth-busting approach to sleep science.

## Function Categories Needed

### 1. Core Sleep Science Functions
- Individual sleep need assessment (debunking 8-hour myth)
- Evidence-based sleep hygiene recommendations  
- Bedroom environment optimization based on Stanley's criteria
- Circadian rhythm and chronotype evaluation

### 2. Sleep Optimization Functions
- Personalized sleep routine creation based on individual needs
- Sleep/wake timing optimization respecting natural patterns
- Pre-sleep preparation activities (Stanley-approved)
- Sleep maintenance strategies for middle-of-night awakenings

### 3. Sleep Problem Resolution Functions
- Evidence-based insomnia management (avoiding myths)
- Sleep-related anxiety management with practical solutions
- Partner sleep disturbance assessment and solutions
- When-to-seek-medical-help guidance

### 4. Lifestyle Integration Functions
- Realistic diet and sleep impact assessment
- Exercise timing and sleep quality (evidence-based)
- Technology/screen time practical management
- Stress management using proven techniques

### 5. Sleep Tracking and Monitoring Functions
- Sleep diary guidance focusing on quality over quantity
- Sleep quality evaluation using Stanley's criteria
- Progress tracking based on daytime alertness and well-being
- Individual goal setting (not generic targets)

## Required Output Format

For each function, provide:

### Function Name
Use snake_case format (e.g., `individual_sleep_assessment`)

### Function Description
1-2 sentences explaining what the function does, when it should be called by the AI, and how it aligns with Stanley's approach

### Parameters
List each parameter with:
- **Name**: parameter name in snake_case
- **Type**: string, string[], boolean, etc.
- **Required**: yes/no
- **Description**: what this parameter represents
- **Example Values**: 2-3 example values based on Stanley's research

### Stanley's Scientific Basis
Explain which of Stanley's key principles or research this function is based on

### Function Purpose
Explain the specific sleep science goal this function addresses using Stanley's methodology

### Expected User Benefits
What outcomes the user should expect, emphasizing quality and individual optimization

### Content Focus Areas
What specific topics/content this function should reference from Stanley's evidence-based approach

### Success Metrics
How to measure if this function helped the user (focusing on daytime alertness, well-being, not just sleep duration)

## Example Format

```
## Function: individual_sleep_need_assessment

**Description**: Assesses the user's individual sleep requirements based on Stanley's principle that sleep needs are genetically determined like height, debunking the universal 8-hour myth through systematic evaluation of personal sleep patterns and daytime functioning.

**Parameters**:
- **current_sleep_duration** (string, required): User's typical nightly sleep duration
  - Examples: "5_hours", "7_hours", "9_hours"
- **daytime_alertness_level** (string, required): How alert user feels during the day
  - Examples: "consistently_alert", "sometimes_drowsy", "frequently_tired"
- **sleep_satisfaction** (string, required): How refreshed user feels upon waking
  - Examples: "well_rested", "somewhat_rested", "unrefreshed"

**Stanley's Scientific Basis**: Based on Stanley's core principle that sleep needs are individual and genetically determined, ranging from 3-11 hours, with 8 hours being merely an average not a requirement.

**Function Purpose**: Determine the user's optimal sleep duration based on their individual physiology rather than arbitrary social expectations, following Stanley's evidence-based approach.

**Expected User Benefits**: Liberation from 8-hour anxiety, discovery of their true sleep needs, improved sleep quality through personalized targets rather than generic advice.

**Content Focus Areas**: Stanley's research on sleep duration variability, genetic factors in sleep needs, relationship between sleep duration and daytime functioning, myth-busting around sleep duration requirements.

**Success Metrics**: User reports improved daytime alertness, reduced sleep anxiety, ability to recognize their optimal sleep duration, decreased obsession with hitting arbitrary hour targets.
```

## Requirements

Generate specifications for approximately 15-20 functions covering all five categories. Each function should:

1. **Align with Stanley's evidence-based approach** and specific principles from his research
2. **Address real sleep problems** while debunking common myths and misconceptions
3. **Provide actionable, scientifically-grounded guidance** rather than trendy sleep advice
4. **Build on each other** (assessment → personalized recommendations → tracking)
5. **Cover different user scenarios** with Stanley's individualized approach
6. **Include both immediate and long-term** sleep improvement strategies
7. **Emphasize quality over quantity** in line with Stanley's core philosophy
8. **Include appropriate medical boundaries** as Stanley advocates

## Safety and Clinical Considerations

### Medical Referral Guidelines
- Functions should identify when sleep issues require professional medical evaluation
- Clear boundaries between app guidance and medical diagnosis/treatment
- Reference to qualified sleep medicine professionals for serious disorders

### Evidence-Based Boundaries
- No promotion of unproven sleep aids, supplements, or devices
- Avoid reinforcing sleep myths or anxiety-inducing advice
- Focus on scientifically validated recommendations only

### Individual Variation Respect
- All recommendations must account for individual differences
- Avoid one-size-fits-all solutions
- Emphasize finding what works for each specific user

## Output
Provide the function specifications in the format shown above, organized by category. Focus on creating comprehensive, scientifically-grounded functions that would genuinely help users improve their sleep based on Dr. Stanley's evidence-based methodologies and myth-busting approach.