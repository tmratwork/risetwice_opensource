// src/app/chatbotV18/p1/how-it-works/page.tsx
"use client";

import { useRouter } from 'next/navigation';
import { MicVocal, PhoneCall, AudioLines, Pointer, HeartHandshake } from 'lucide-react';

export default function HowItWorksPage() {
  const router = useRouter();

  const handleGetStarted = () => {
    // Navigate to patient intake form
    router.push('/chatbotV18/p1/intake');
  };

  return (
    <div className="w-full h-full overflow-y-auto px-6 pt-16 pb-6">
      <div className="w-full max-w-5xl mx-auto">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100">
          How it works
        </h1>

        {/* Steps Grid - 2x2 layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center">
                <span className="text-white dark:text-black text-xl font-bold">1</span>
              </div>
              <MicVocal className="w-8 h-8 text-gray-800 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2 text-gray-800">
                  Tell us your story
                </h2>
                <p className="text-base text-gray-700 leading-relaxed">
                  Complete a brief intake process with our AI chatbot. Use your voice to tell us about your main reasons for therapy and what you&apos;re looking for in a provider.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center">
                <span className="text-white dark:text-black text-xl font-bold">2</span>
              </div>
              <PhoneCall className="w-8 h-8 text-gray-800 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2 text-gray-800">
                  We reach out to therapists
                </h2>
                <p className="text-base text-gray-700 leading-relaxed">
                  We contact providers in your area who match your specific needs and take your insurance. They listen to your intake to gauge whether they are a good fit.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold">3</span>
              </div>
              <AudioLines className="w-8 h-8 text-gray-800 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2 text-gray-800">
                  Interested therapists record a private voice message just for you
                </h2>
                <p className="text-base text-gray-700 leading-relaxed">
                  Listen to their intros to get a genuine feel for their personality and approach, right from your phone or computer.
                </p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center">
                <span className="text-white dark:text-black text-xl font-bold">4</span>
              </div>
              <Pointer className="w-8 h-8 text-gray-800 flex-shrink-0" />
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2 text-gray-800">
                  Choose the best fit & start healing
                </h2>
                <p className="text-base text-gray-700 leading-relaxed">
                  After hearing their messages, you decide who feels like the best fit. You then contact them directly to set up your first appointment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Get Started Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleGetStarted}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-4 px-12 rounded-2xl transition-colors text-xl shadow-lg"
          >
            Get Started
          </button>
        </div>

        {/* Financial Assistance Info */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <HeartHandshake className="w-12 h-12 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-base text-gray-700 leading-relaxed">
                <strong className="font-bold">
                  **For eligible populations in need, RiseTwice will pay for some or all of your sessions, removing the financial barrier to get started. Contact{' '}
                  <a
                    href="mailto:drbyron@risetwice.com"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    drbyron@risetwice.com
                  </a>
                  {' '}to learn more**
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
