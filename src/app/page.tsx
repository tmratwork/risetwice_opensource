// /src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  // Automatically redirect to the latest chatbot on component mount
  useEffect(() => {
    router.push('/chatbotV17');
  }, [router]);

  return (
    <div className="container mx-auto p-8 max-w-xl">
      <h1 className="text-3xl font-bold mb-8 text-center">RiseTwice</h1>
      <p className="text-center mb-8">Routing to most recent version...</p>

      <div className="flex flex-col space-y-4">
        <div className="text-center">
          <p className="mb-4 text-sm text-gray-600">If you are not routed automatically, please click below:</p>

          <Link
            href="/chatbotV17"
            className="bg-blue-500 text-white py-3 px-4 rounded-lg text-center hover:bg-blue-600 transition"
          >
            Let&apos;s Talk
          </Link>
        </div>
      </div>
    </div>
  );
}