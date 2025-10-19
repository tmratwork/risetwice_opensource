// src/app/chatbotV18/p1/page.tsx
"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export default function PatientIntakeLanding() {
  const router = useRouter();
  const { user } = useAuth();

  const handleNextSteps = () => {
    // TODO: Navigate to new patient intake flow
    console.log('Next Steps clicked - navigate to intake');
  };

  const handleViewMessages = () => {
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to check your therapist messages.');
      return;
    }

    // User is logged in - show empty message box
    alert('Your message box is empty. Therapists will reach out once they review your intake.');
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        {/* Welcome Title */}
        <h1 className="text-5xl font-bold text-center mb-12 text-gray-800 dark:text-gray-100">
          Welcome
        </h1>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* New Patient Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg flex flex-col">
            <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">
              New Patient?
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 leading-relaxed flex-grow">
              Start with a 10-minute conversation with our AI. Share what&apos;s going on, and therapists who can help will reach out to you.
            </p>
            <button
              onClick={handleNextSteps}
              className="w-full bg-sage-300 dark:bg-sage-400 hover:bg-sage-400 dark:hover:bg-sage-500 text-gray-800 dark:text-gray-900 font-semibold py-4 px-6 rounded-xl transition-colors text-lg"
            >
              Next Steps
            </button>
          </div>

          {/* Returning Patient Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg flex flex-col">
            {/* Returning Badge */}
            <div className="inline-block bg-yellow-400 text-gray-900 px-4 py-1 rounded-lg font-semibold text-sm mb-4 self-start">
              Returning
            </div>
            <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">
              Check Your Matches
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 leading-relaxed flex-grow">
              Therapists have listened to your intake and recorded personal messages for you. Hear who&apos;s ready to help.
            </p>
            <button
              onClick={handleViewMessages}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-4 px-6 rounded-xl transition-colors text-lg"
            >
              View Therapist Messages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
