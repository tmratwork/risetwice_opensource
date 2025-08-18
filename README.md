  To see this code in action, visit https://www.r2ai.me

  To view all prompts, visit https://www.r2ai.me/prompts

  To view the knowledge base, visit https://docs.google.com/document/d/1ePTSwXbmYZqsGhVQCWGcqJ7h26R-s-_9cfl7H1cE4R8/edit?usp=sharing

  An AI-powered mental health support platform designed specifically for at-risk youth. 
  Specialized conversational AI that combines therapeutic content, crisis intervention, resource
  location, and future planning support through an innovative voice-first interface.
  
  Overview

  Leverage advanced AI technology to provide personalized mental health support through:

  - 🎯 AI Specialists: 8 specialized AI agents for crisis support, anxiety, depression, future planning,
  and resource location, but current version relying on triate AI only
  - 📚 Therapeutic Content: Evidence-based therapeutic books and resources with AI-powered content access
  - 🗣️ Voice-First Interface: Real-time voice conversations with AI specialists using WebRTC technology
  - 🧠 Adaptive Memory: Sophisticated conversation analysis and user profile building for personalized
  support
  - 🌍 Community Features: Safe community circles for peer support and shared experiences
  - 📍 Resource Location: Comprehensive resource search and mapping for local support services

  Key Features

  AI-Powered Mental Health Support

  - 34 specialized functions across 8 categories (crisis support, cultural support, future planning,
  resource location)
  - Dynamic function loading from database based on user needs and AI specialist type
  - Evidence-based therapeutic techniques including CBT, grounding, and validation

  Architecture (V16)

  - Next.js 15 with App Router and TypeScript
  - Supabase for database and real-time features
  - Firebase Authentication for secure user management
  - OpenAI GPT-4 and Anthropic Claude for AI responses
  - WebRTC for real-time voice communication
  - Pinecone for vector-based content search

  Privacy & Security

  - Admin-only access to sensitive moderation and crisis detection data
  - Comprehensive memory system with privacy controls
  - Crisis intervention protocols with proper data protection

  Tech Stack

  Core Technologies

  - Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
  - Backend: Next.js API Routes, Supabase, Firebase Functions
  - Database: Supabase (PostgreSQL) with Row Level Security
  - Authentication: Firebase Auth with admin role management
  - AI/ML: OpenAI GPT-4, Anthropic Claude, Pinecone Vector Database

  Key Dependencies

  - @anthropic-ai/sdk - Anthropic Claude integration
  - @supabase/supabase-js - Supabase client
  - openai - OpenAI API integration
  - firebase - Authentication and cloud functions
  - @pinecone-database/pinecone - Vector search
  - zustand - State management
  - next-themes - Theme management
  - mapbox-gl - Interactive mapping

  Getting Started

  Prerequisites

  - Node.js 18+ and npm
  - Supabase account and project
  - Firebase project with Authentication enabled
  - OpenAI API key
  - Anthropic API key

  Installation

  1. Clone the repository
  git clone https://github.com/your-org/livingbooks.git
  cd livingbooks

  2. Install dependencies
  npm install

  3. Environment Configuration

  Create .env.local with the following variables:
  # Database
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

  # Authentication
  NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
  # ... other Firebase config

  # AI Services
  OPENAI_API_KEY=your_openai_api_key
  ANTHROPIC_API_KEY=your_anthropic_api_key

  # Vector Database
  PINECONE_API_KEY=your_pinecone_api_key
  PINECONE_ENVIRONMENT=your_pinecone_environment

  # Optional Services
  MAPBOX_ACCESS_TOKEN=your_mapbox_token
  RESEND_API_KEY=your_resend_key

  4. Database Setup

  Initialize the Supabase database with the provided schema and RLS policies. See docs/open_source.md for
  detailed security setup instructions.

  5. Run the development server
  npm run dev

  The application will be available at http://localhost:3000.

  Project Structure

  src/
  ├── app/                    # Next.js App Router
  │   ├── api/v16/           # V16 API routes
  │   ├── chatbotV16/        # Main application interface
  │   └── community/         # Community features
  ├── components/            # Shared React components
  ├── hooks/                 # Custom React hooks
  ├── hooksV16/             # V16-specific hooks
  ├── lib/                  # Utility libraries
  └── contexts/             # React contexts

  docs/                     # Documentation
  ├── functions_V16.md      # Function system documentation
  ├── open_source.md        # Security and deployment guide
  └── ...                   # Additional documentation

  Core Components

  V16 Application Features

  - Mental Health Chat: AI-powered conversations with specialized mental health support
  - Resource Locator: Find local mental health resources, food assistance, housing, and more
  - Future Pathways: Educational and career planning guidance for at-risk youth
  - Community Circles: Safe peer support communities with moderation
  - Memory System: Conversation analysis and personalized user profiles

  AI Specialist System

  The platform features 8 specialized AI agents:
  - Triage Specialist: Initial assessment and routing (but in V16 handles everything)
  - Crisis Specialist: Immediate crisis intervention
  - Anxiety Specialist: Anxiety-specific support techniques
  - Depression Specialist: Depression-focused therapeutic approaches
  - Future Planning Specialist: Educational and career guidance
  - Resource Specialist: Local resource discovery and navigation
  - Cultural Specialist: Culturally responsive mental health support
  - Sleep Specialist: Sleep hygiene and insomnia support

  Development

  Available Scripts

  - npm run dev - Start development server with Turbopack
  - npm run build - Build for production
  - npm run start - Start production server
  - npm run lint - Run ESLint

  Code Guidelines

  - TypeScript Strict Mode: No any or unknown types
  - Database Security: All operations use Row Level Security
  - AI Integration: Functions and prompts loaded from Supabase, not hardcoded
  - Error Visibility: No fallbacks - errors should be visible in beta
  - Minimal Changes: Follow existing patterns and conventions

  Memory System

  V16 implements a sophisticated memory processing system:
  - Conversation Analysis: AI-powered extraction of insights from conversations
  - Profile Building: Dynamic user profile updates based on interactions
  - Scheduled Processing: Background jobs for conversation analysis
  - Privacy Controls: Complete user control over memory data

  Security Features

  - Admin role management with proper access controls
  - Crisis detection and intervention with protected data handling
  - Content moderation with admin-only access to sensitive data
  - Secure API authentication across all endpoints
  - Privacy-compliant memory processing with user consent

  Community Features

  - Community Circles: Create and join support communities
  - Moderated Content: AI and human moderation for safety
  - Access Controls: Public and private circle options
  - Peer Support: Safe spaces for shared experiences
  - Crisis Reporting: Integrated crisis detection and intervention

  Contributing

  Welcome contributions from developers, mental health professionals, and advocates for youth mental
  health. Please read our contribution guidelines (once somebody writes them) and security requirements before submitting pull
  requests.

  Before Contributing

  1. Review docs/open_source.md for security guidelines
  2. Understand the AI function system in docs/functions_V16.md
  3. Follow TypeScript strict mode and existing code patterns
  4. Test database security with proper RLS implementation

  License

  This project is open source under the MIT License. See LICENSE file for details.

  Support & Documentation

  - Technical Documentation: See /docs folder for detailed guides
  - Function System: Review docs/functions_V16.md for AI function specifications
  - Security Setup: Follow docs/open_source.md for secure deployment
  - Database Schema: Supabase table structures and RLS policies documented

  Acknowledgments

  This platform developed to support at-risk youth with accessible, AI-powered mental health resources.
  The platform combines evidence-based therapeutic techniques with modern technology to provide
  personalized, culturally responsive mental health support.

  ---
  Note: This project is designed for mental health support and includes crisis intervention features.
  Please ensure proper clinical oversight and follow local regulations when deploying mental health
  applications.
