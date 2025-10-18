Sleep Page Structure

  1. /chatbotV15/sleep/layout.tsx - Layout component that matches the existing V15 structure
  2. /chatbotV15/sleep/page.tsx - Main sleep page component based on the mental health page but adapted for sleep
  wellness
  3. /hooksV15/functions/use-sleep-functions-v15.ts - Sleep-specific functions hook for quest retrieval and sleep
  wellness features

  Key Features

  Sleep Page (/chatbotV15/sleep):
  - Sleep Wellness Modules - Displays sleep-specific quests/modules
  - Two tabs: Modules and Insights (same structure as mental health page)
  - Sleep-specific quest retrieval - Uses different API endpoints (/api/v11/sleep-quests)
  - Sleep context throughout - All text adapted for sleep wellness rather than mental health
  - Same UI/UX - Maintains consistency with existing V15 pages

  Sleep Functions Hook:
  - Sleep-specific functions like sleep_hygiene_function, sleep_relaxation_function, sleep_schedule_function
  - Sleep resource search - Adapted resource locator for sleep clinics, sleep studies, support groups
  - Sleep quest management - Handles sleep-specific quest data and API calls
  - Sleep content queries - Uses sleep-specific namespaces and book content