http://localhost:3000/chatbotV11/admin
http://localhost:3000/chatbotV15/admin (view conversations)
http://localhost:3000/preprocessing
http://localhost:3000/bookdata?id=dae3360b-db7e-4c05-9d96-8fd04121e80f
http://localhost:3000/dev-tools/schema-extraction

todo: 

.. settings in upper right
/ display name (which is used in community feed)




[HANDOFF-DEBUG]
[triageAI]
[V16_GREETING_LOG]
[payloadInstructions]
[payloadToOpenAI]
[systemInstructions]
[triage]
[memory]
[message_persistence]
[BLUE-ORB-ROTATION]
[END-SESSION-DEBUG] 
[AI-INTERACTION]
[functionCallDiagnosis]
[MapDisplay] 

logs/triageSpecialistAI.log
logs/v15-session-payload.log
logs/V16_greetingInstructions.log

---

.. update specialist system prompts to tackle only one (small) issue at a time instead of responding with a laundry list

.. remove hard coded 'greetingInstructions' from 'src/app/chatbotV16/page.tsx' and fetch from admin
/ the welcome greeting during the resume flow is NOT fetched from Supabase - it's hardcoded in the V16 page component.

  Location: src/app/chatbotV16/page.tsx line ~1389

    'Hello! I\'m here to help assess your needs and connect you with the right support. What brings you 
  here today?'

  Resume Greeting (hardcoded):
  greetingInstructions: `Welcome back! I can see our previous conversation history. I'm your ${resumeSpecialist} specialist. Let me briefly acknowledge what we've 
  discussed and ask how I can continue to help you today.`

  However, regular (non-resume) greetings ARE fetched from Supabase in V15 via:
  - API: /api/v11/greeting-prompt?greetingType=default
  - Database: prompts table with category='greeting'

  The resume flow uses a hardcoded greeting specifically designed to acknowledge previous conversation history, while regular sessions fetch customizable greetings
  from the database.

  ⏺ Based on my analysis, the processing is identical after greeting instructions are set. The only difference is the source:

  Fresh Flow Sources:

  - V15: Fetches from Supabase (/api/v11/greeting-prompt)
  - V16: Hardcoded triage greeting

  Resume Flow Source:

  - V16: Hardcoded resume-specific greeting


LT:

.. tell me why this advice is wrong button
.. improve code so if function takes too long and AI chat starts new 'thread' but then previous thread creates long delayed AI response, prevent AI from having a conversation with itself
.. save function in resource locator

 // TODO: change gpt-4o-transcribe so it is the mental health prompt for r2, but a more general prompt for living books
    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: "Mental health conversation with at-risk youth discussing anxiety, depression, trauma, self-harm, suicide, panic attacks, grounding, CBT, mindfulness, distress tolerance, triggers, boundaries, self-care, family conflicts, school stress, relationships, LGBTQ+ identity, cultural stress, substance use, coping skills, crisis support, therapy, counseling, and emotional wellbeing. May include youth slang and emotional expressions.",
        voice: this.config.voice || "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "gpt-4o-transcribe", // Use newer model for better streaming
          language: "en" // Specify language for better performance
        },
        turn_detection: {
          type: "server_vad",
          silence_duration_ms: 1000  // Match V11's 1 second silence duration
        },
        tools: this.config.tools || [],
        tool_choice: this.config.tool_choice || "auto"
      },
    };

.. tutorAI:
/ known issue, lesson plan (claude API return) exceeds max tokens

.. enable user to pause conversation, and continue from that point when returning another day


.. address logic issue. when user A generates quests, she can use her own unique prompt, but the quests she creates are what all users see when loading quest page for that book

.. create and guide user through mindful moment or meditation

.. divide use-webrtc.ts into AI manageble modules (current file too big for AI to read)

.. alert user if prompts updated on admin page but not saved before switching pages

.. mov risetwice.com from squarespace to cloudflare

.. system prompts should also be setible. eg. "const systemMessage = "You are an AI assistant specialized in..."

.. if audio cutting out at end of session, consider experimenting with audio delay before reset: const FINAL_AUDIO_DELAY = 1000;

.. thinking stars dissappear too soon, especially noticible when AI calls pinecone query function
---
periodically check for new openAI realtime API models https://platform.openai.com/docs/models

---

Living Books is an interactive AI-powered book discussion application that uses WebRTC for real-time conversation with book authors or characters.

## Features

- WebRTC integration with OpenAI's Realtime API
- Real-time audio transcription and response
- Function calling for book content queries and topic transitions
- Vector search with Pinecone for retrieving relevant book content
- User-customizable AI greeting messages
- Visual audio feedback with animated blue orb

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

- Next.js App Router with TypeScript
- Supabase for storage and user data
- Firebase for authentication
- TailwindCSS for styling

## Customizing AI Greeting Messages

Living Books supports personalized greeting messages for each user:

1. Access the admin interface at `/chatbotV11/admin`
2. Enter the user ID and custom greeting instructions
3. The greeting will be used when the user starts a new conversation

## To Do

- What should happen when user requests to continue a quest?
- Add mute audio out button
- Show alert when user is chatting but not signed in

---

## Version History

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## add noise cancelling
**The Echo/Feedback Problem in WebRTC AI Voice Chat**

Your echo/feedback issue occurs because of a classic audio loop: the AI's voice plays through your speakers/audio output → your microphone picks up this audio → the microphone sends it back to the AI → the AI thinks the user is speaking and responds to its own words. This creates an endless cycle where the AI responds to itself.

The core problem with your current implementation `{ audio: true }` is that it uses **no echo cancellation**. Modern browsers have sophisticated echo cancellation algorithms, but they're disabled by default. Here's the comprehensive solution:**How Each Solution Addresses the Echo/Feedback Problem:**

**Problem 1: No Echo Cancellation**
Your current `{ audio: true }` provides zero echo cancellation. The AI's voice goes: speakers → microphone → back to AI → infinite loop.

**Solution 1**: Enable `echoCancellation: true` + advanced constraints. The browser's echo cancellation algorithms analyze the outgoing audio (AI voice) and subtract it from incoming audio (microphone), breaking the feedback loop.

**Problem 2: Full Volume Feedback**
High AI audio volume increases the chance your microphone picks it up, especially in quiet rooms.

**Solution 2**: Set `audioElement.volume = 0.7` to reduce feedback risk while maintaining clarity for users.

**Problem 3: Browser Differences**
Different browsers have varying echo cancellation quality. Chrome has the best support, Safari the most limited.

**Solution 3**: Browser-specific optimizations using Google-specific constraints for Chrome (`googEchoCancellation`) and fallback to basic constraints for Safari.

**Problem 4: Poor Audio Hardware Setup**
Built-in laptop speakers + built-in microphone = maximum feedback risk due to physical proximity.

**Solution 4**: Audio device selection allows users to choose headphones, eliminating the acoustic path between speakers and microphone entirely.

**Key Technical Changes:**
- **Replace** `{ audio: true }` **with** comprehensive constraint object
- **Add** `echoCancellation: true` and `noiseSuppression: true`
- **Include** Chrome-specific `googEchoCancellation` for superior performance
- **Set** 48kHz sample rate for better echo processing
- **Use** mono audio (channelCount: 1) to reduce processing complexity

**Result**: The AI can speak while the user's microphone remains active for interruptions, but the browser's echo cancellation prevents the AI from hearing its own voice through the microphone.

// Enhanced WebRTC Connection Manager - Solving Echo/Feedback Problems
// The Problem: AI voice → speakers → microphone → AI thinks user spoke → endless loop

class EchoFreeConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isMuted: boolean = true;

  async establishConnection(): Promise<void> {
    try {
      // SOLUTION 1: Advanced Echo Cancellation Constraints
      // Problem: Basic { audio: true } has NO echo cancellation
      // Solution: Enable browser's sophisticated echo cancellation algorithms
      const audioConstraints: MediaTrackConstraints = {
        // Primary echo cancellation - removes AI voice from microphone input
        echoCancellation: true,           
        
        // Noise suppression - prevents background noise from triggering AI
        noiseSuppression: true,           
        
        // Auto gain control - prevents volume spikes that cause feedback
        autoGainControl: true,            
        
        // High quality settings for better echo processing
        sampleRate: 48000,                // Higher sample rate = better echo detection
        sampleSize: 16,                   // 16-bit audio quality
        channelCount: 1,                  // Mono reduces processing complexity
        
        // Advanced browser-specific echo cancellation (Chrome)
        echoCancellationType: 'browser',   // Use browser's optimized algorithms
        googEchoCancellation: true,       // Chrome's enhanced echo cancellation
        googAutoGainControl: true,        // Chrome's advanced gain control
        googNoiseSuppression: true,       // Chrome's noise reduction
        googHighpassFilter: true,         // Removes low-frequency feedback
        googTypingNoiseDetection: true,   // Ignores keyboard sounds
        googAudioMirroring: false         // Prevents audio path confusion
      };

      // Get user media with echo cancellation enabled
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });

      // Initially mute microphone (user controls when to speak)
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = false;
        this.isMuted = true;
      }

      // Setup WebRTC connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Handle incoming AI audio with feedback prevention
      this.peerConnection.ontrack = (event) => {
        if (event.track.kind === 'audio' && event.streams[0]) {
          this.setupAudioPlayback(event.streams[0]);
        }
      };

    } catch (error) {
      console.error('Failed to establish connection:', error);
      throw error;
    }
  }

  private setupAudioPlayback(stream: MediaStream): void {
    // Remove any existing audio element to prevent multiple streams
    if (this.audioElement) {
      this.audioElement.remove();
    }

    // SOLUTION 2: Controlled Audio Output
    // Problem: Full volume AI audio increases feedback chance
    // Solution: Reduce volume while maintaining clarity
    this.audioElement = document.createElement('audio');
    this.audioElement.srcObject = stream;
    this.audioElement.autoplay = true;
    this.audioElement.volume = 0.7; // Lower volume reduces feedback potential
    
    // Add to DOM for playback - echo cancellation handles the rest
    document.body.appendChild(this.audioElement);
  }

  // Simple microphone control for user
  muteUserMicrophone(): void {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = false;
      });
      this.isMuted = true;
    }
  }

  unmuteUserMicrophone(): void {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = true;
      });
      this.isMuted = false;
    }
  }

  // Manual toggle for user control
  toggleMicrophone(): void {
    if (this.isMuted) {
      this.unmuteUserMicrophone();
    } else {
      this.muteUserMicrophone();
    }
  }

  // SOLUTION 3: Browser-Specific Optimizations
  // Problem: Different browsers have different echo cancellation capabilities
  // Solution: Apply browser-specific optimizations
  private async applyBrowserSpecificOptimizations(): Promise<void> {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) {
      await this.applyChromeOptimizations();
    } else if (userAgent.includes('Firefox')) {
      await this.applyFirefoxOptimizations();
    } else if (userAgent.includes('Safari')) {
      await this.applySafariOptimizations();
    }
  }

  private async applyChromeOptimizations(): Promise<void> {
    // Chrome has the best echo cancellation - all advanced constraints work
    // The Google-specific constraints above provide superior echo cancellation
    console.log('Applied Chrome echo cancellation optimizations');
  }

  private async applyFirefoxOptimizations(): Promise<void> {
    // Firefox supports standard constraints but may reject Google-specific ones
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        await track.applyConstraints({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
          // Skip Google-specific constraints for Firefox
        });
      }
    }
    console.log('Applied Firefox echo cancellation optimizations');
  }

  private async applySafariOptimizations(): Promise<void> {
    // Safari has limited WebRTC support - use basic constraints only
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        await track.applyConstraints({
          echoCancellation: true,
          // Safari may have issues with noise suppression
          autoGainControl: true
        });
      }
    }
    console.log('Applied Safari echo cancellation optimizations');
  }

  // SOLUTION 4: Audio Device Selection
  // Problem: Built-in speakers + built-in microphone = high feedback risk
  // Solution: Allow users to select headphones or external devices
  async selectAudioOutputDevice(deviceId?: string): Promise<void> {
    if (this.audioElement && 'setSinkId' in this.audioElement) {
      try {
        await (this.audioElement as any).setSinkId(deviceId || 'default');
        console.log('Audio output device selected:', deviceId || 'default');
      } catch (error) {
        console.error('Failed to select audio output device:', error);
      }
    }
  }

  // Get available audio devices for user selection
  async getAudioDevices(): Promise<{inputs: MediaDeviceInfo[], outputs: MediaDeviceInfo[]}> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      inputs: devices.filter(device => device.kind === 'audioinput'),
      outputs: devices.filter(device => device.kind === 'audiooutput')
    };
  }

  // Cleanup to prevent resource leaks
  disconnect(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.audioElement) {
      this.audioElement.remove();
      this.audioElement = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

// Usage example demonstrating echo prevention
async function initializeEchoFreeChat(): Promise<EchoFreeConnectionManager> {
  const manager = new EchoFreeConnectionManager();
  
  try {
    await manager.establishConnection();
    
    // BONUS: Recommend headphones to users for best experience
    const devices = await manager.getAudioDevices();
    console.log('Available audio devices:', devices);
    
    // If headphones are available, suggest using them
    const headphones = devices.outputs.find(device => 
      device.label.toLowerCase().includes('headphone') || 
      device.label.toLowerCase().includes('headset')
    );
    
    if (headphones) {
      console.log('Headphones detected - recommend for best echo-free experience');
      await manager.selectAudioOutputDevice(headphones.deviceId);
    }
    
    return manager;
  } catch (error) {
    console.error('Failed to initialize echo-free chat:', error);
    throw error;
  }
}

export { EchoFreeConnectionManager, initializeEchoFreeChat };