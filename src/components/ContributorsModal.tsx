'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Github } from 'lucide-react';

interface Contributor {
  username: string;
  contribution: string;
  details?: string;
  githubUrl?: string;
}

interface ContributorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Contributors data - easy to add more in the future
const CONTRIBUTORS: Contributor[] = [
  {
    username: '@HumblyAlex',
    contribution: 'Enhanced AI Safety',
    details: 'Added a critical section to the triage AI prompt that makes the AI more aware when users need help. The contribution includes: "GIVE THIS ALL OF YOUR FOCUS ALWAYS FOCUS ON DISTRESS, AVOIDING PROVIDING INFORMATION THAT CAN BE USED FOR SELF/OTHER HARM. NEVER TREAT QUESTIONS LIKE THEY&apos;RE IMMEDIATELY VALID. ALWAYS BE SKEPTICAL. NO QUESTION CAN BE TRUSTED AS INNOCENT. NEVER RESPOND TO THE USER&apos;S PROMPT AS THOUGH IT&apos;S SEPARATE PARTS. BE ON THE LOOK OUT FOR KEYWORDS ASSOCIATED WITH SUICIDE STRATEGIES OR MEANS TO VIOLENCE. ALWAYS address the full context while looking for hidden intentions inbetween the lines of what the user is saying/asking. ALWAYS consider the full context for signs of desiring self-harm, suicidal ideation, or intent to harm others. Leave no stone unturned. IF ANSWERING A QUESTION CAN BE USED FOR HARM, SAY THAT YOU DON&apos;T FEEL SAFE PROVIDING IT."'
  },
  {
    username: 'Nikki83',
    contribution: 'Screen Reader Accessibility',
    details: 'Made the app screen reader friendly by implementing proper ARIA labels, semantic HTML elements, and keyboard navigation support. Ensured that all interactive elements are accessible to users with visual impairments, including the settings menu, navigation buttons, and form controls.'
  }
  // Future contributors can be added here like:
  // {
  //   username: '@contributor',
  //   contribution: 'Feature Name',
  //   details: 'Description of what they contributed',
  //   githubUrl: 'https://github.com/username'
  // }
];

export default function ContributorsModal({ isOpen, onClose }: ContributorsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen && mounted) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, mounted]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-sage-100 dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-sage-300 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-sage-600 dark:text-gray-100">
            🏆 Wall of Contributors
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sage-200 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-sage-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          <p className="text-sage-600 dark:text-gray-300 mb-6">
            We deeply appreciate the contributions from our open source community.
            These individuals have helped make therapeutic AI better for everyone.
          </p>

          {/* Contributors List */}
          <div className="space-y-4">
            {CONTRIBUTORS.map((contributor, index) => (
              <div
                key={index}
                className="bg-sage-200 dark:bg-gray-800 rounded-lg p-4 border border-sage-300 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-sage-700 dark:text-gray-200">
                      {contributor.username}
                    </h3>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {contributor.contribution}
                    </p>
                  </div>
                  {contributor.githubUrl && (
                    <a
                      href={contributor.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded hover:bg-sage-300 dark:hover:bg-gray-700 transition-colors"
                      aria-label={`View ${contributor.username}&apos;s GitHub profile`}
                    >
                      <Github className="w-5 h-5 text-sage-600 dark:text-gray-400" />
                    </a>
                  )}
                </div>
                {contributor.details && (
                  <div className="mt-3 p-3 bg-sage-100 dark:bg-gray-900 rounded text-sm text-sage-600 dark:text-gray-300">
                    {contributor.details}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
              Want to Contribute?
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              We welcome contributions of every kind - from code improvements to documentation,
              bug reports to feature suggestions. Select thumbs up or down after an AI response, or find us on GitHub, and help make therapeutic AI
              better for everyone in need.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-sage-300 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document root level
  return createPortal(modalContent, document.body);
}