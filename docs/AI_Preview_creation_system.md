# Three-Part AI Therapist System

This document explains RiseTwice's three-part system for creating AI therapist simulations based on real human therapist data.

## System Overview

The system transforms real human therapist intake data into AI simulations through three distinct parts:

### Part 1: Human Therapist Intake (`http://localhost:3001/s2`)
- **Purpose**: Collect comprehensive data about real human therapists
- **Users**: Licensed therapists completing their professional profiles
- **Data Collected**:
  - Personal information (name, title, degrees, location)
  - Professional details (specialties, treatment approaches, session preferences)
  - Communication style preferences
  - Practice information (insurance, availability, emergency protocols)
  - Patient interaction preferences and therapeutic modalities

### Part 2: Admin AI Prompt Generation (`http://localhost:3001/admin/s2`)
- **Purpose**: Convert therapist intake data into AI personality prompts
- **Users**: System administrators
- **Process**:
  1. **"Generate AI Prompt" button**: Analyzes ALL therapist intake data
  2. **AI Analysis**: Creates comprehensive personality prompt (typically 20,000+ characters)
  3. **Storage**: Saves generated prompt to `s2_ai_therapist_prompts` table
  4. **"Start AI Preview" button**: Tests the generated AI therapist simulation

### Part 3: AI Therapist Simulation (`http://localhost:3000/chatbotV17`)
- **Purpose**: AI role-plays as the specific human therapist
- **Users**: Patients seeking therapy
- **Technology**: ElevenLabs conversational AI with generated personality prompt
- **Interaction**: Voice-based therapy sessions where AI behaves like the original therapist

## Data Flow

```
Human Therapist → Intake Data → AI Prompt Generation → AI Therapist Simulation
    (Part 1)        (Part 2)          (Part 3)
```

## Key Technical Integration

### How Parts Connect:

1. **Intake to Generation**: Part 2 reads therapist data from Part 1's database tables
2. **Generation to Simulation**: Part 3 receives the generated prompt as `demoPromptAppend` parameter
3. **V17 Integration**: `startSession('triage', voiceId, generatedTherapistPrompt)`

### Database Tables:

- **Part 1 Data**:
  - `s2_therapist_profiles` - Basic therapist info
  - `s2_complete_profiles` - Detailed professional information
  - `s2_ai_style_configs` - Communication preferences
  - `s2_license_verifications` - Professional credentials

- **Part 2 Data**:
  - `s2_ai_therapist_prompts` - Generated AI personality prompts

- **Part 3 Data**:
  - Uses V17 system with ElevenLabs agents
  - Prompts stored in `ai_prompts` table (base) + generated prompt (append)

## Admin Preview System

The **"Start AI Preview"** feature in Part 2 allows administrators to test generated AI therapist prompts:

### Current Implementation:
1. **Click "View"** on therapist in admin panel (`/admin/s2`)
2. **"Start AI Preview" button** appears if AI prompt exists
3. **Direct V17 integration**: Bypasses complex S2 session system
4. **Voice conversation**: Admin speaks as patient, AI responds as therapist

### Technical Details:
- **No dummy data creation**: Uses existing generated prompt directly
- **V17 compatibility**: Integrates with `chatbotV17` voice system
- **Clean separation**: S2 system for training, V17 system for simulation

## Code Locations

### Part 1 - Therapist Intake:
- **Main page**: `src/app/s2/page.tsx`
- **Components**: `src/app/s2/components/`
- **API routes**: `src/app/api/s2/`

### Part 2 - Admin Generation:
- **Admin panel**: `src/app/admin/s2/page.tsx`
- **Preview page**: `src/app/admin/s2/preview/[promptId]/page.tsx`
- **Generation API**: `src/app/api/admin/s2/generate-therapist-prompt/route.ts`
- **Prompt API**: `src/app/api/admin/s2/prompt/[promptId]/route.ts`

### Part 3 - AI Simulation:
- **Main chatbot**: `src/app/chatbotV17/page.tsx`
- **V17 hooks**: `src/hooksV17/use-elevenlabs-conversation.ts`
- **Agent API**: `src/app/api/v17/agents/create/route.ts`

## Important Design Principles

### Role Clarity:
- **Part 1**: Real humans provide data
- **Part 2**: AI analyzes and generates prompts
- **Part 3**: AI role-plays as human therapists

### Data Integrity:
- **No hardcoded prompts**: All prompts stored in Supabase
- **No fake data**: Admin preview uses real generated prompts
- **Complete data flow**: Each part builds on the previous

### System Independence:
- **Part 3 unchanged**: V17 maintains same interface regardless of prompt source
- **Flexible integration**: Parts can evolve independently
- **Clear boundaries**: Each part has distinct responsibilities

## Future Considerations

- **Scaling**: System designed to handle multiple therapists and their unique AI simulations
- **Quality control**: Admin preview allows testing before patient deployment
- **Compliance**: Real therapist data ensures authentic, professional interactions
- **Personalization**: Each AI simulation reflects the specific therapist's approach and style

## Debugging

To debug the system flow:

1. **Enable V17 logs**: `NEXT_PUBLIC_ENABLE_V17_LOGS=true` in `.env.local`
2. **Check prompt generation**: Look for character counts (20,000+ typical)
3. **Verify V17 integration**: Confirm `demoPromptLength` in logs
4. **Test admin preview**: Use "Start AI Preview" to verify AI behavior

This three-part system ensures that AI therapist simulations are grounded in real professional expertise while leveraging modern AI capabilities for accessible mental health support.