// Test component to verify map optimization performance improvements
"use client";

import { useState } from 'react';
import { OptimizedMapDisplay } from './OptimizedMapDisplay';
import { type Resource } from './MapOptimizations';

const SAMPLE_RESOURCES: Resource[] = [
  {
    name: "Mental Health Resource Center",
    description: "Comprehensive mental health services including counseling and support groups",
    address: "123 Main Street, San Diego, CA 92101",
    phone: "(619) 555-0123",
    website: "https://example.com",
    resource_type: "mental_health",
    verified: true,
    citation_index: 0,
    type: "healthcare"
  },
  {
    name: "Crisis Support Hotline",
    description: "24/7 crisis intervention and emotional support services",
    address: "456 Oak Avenue, San Diego, CA 92102",
    phone: "(619) 555-0456",
    resource_type: "crisis_support",
    verified: true,
    citation_index: 1,
    type: "support"
  },
  {
    name: "Community Food Bank",
    description: "Emergency food assistance for families and individuals in need",
    address: "789 Pine Street, San Diego, CA 92103",
    phone: "(619) 555-0789",
    website: "https://foodbank.example.com",
    resource_type: "food_assistance",
    verified: false,
    citation_index: 2,
    type: "food"
  },
  {
    name: "Housing Assistance Program",
    description: "Temporary housing and rental assistance for homeless individuals",
    address: "321 Cedar Boulevard, San Diego, CA 92104",
    phone: "(619) 555-0321",
    resource_type: "housing",
    verified: true,
    citation_index: 3,
    type: "housing"
  },
  {
    name: "Youth Counseling Services",
    description: "Specialized mental health services for teenagers and young adults",
    address: "654 Elm Drive, San Diego, CA 92105",
    phone: "(619) 555-0654",
    website: "https://youth.example.com",
    resource_type: "mental_health",
    verified: true,
    citation_index: 4,
    type: "healthcare"
  }
];

export const MapOptimizationTest = () => {
  const [testStarted, setTestStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);

  const startTest = () => {
    console.log('🧪 [MapOptimizationTest] Starting performance test...');
    setStartTime(performance.now());
    setTestStarted(true);
    setEndTime(null);
  };

  const handleMapReady = () => {
    if (startTime) {
      const end = performance.now();
      setEndTime(end);
      const duration = (end - startTime) / 1000;
      console.log(`🎉 [MapOptimizationTest] Test completed in ${duration.toFixed(2)}s`);
    }
  };

  const duration = startTime && endTime ? ((endTime - startTime) / 1000).toFixed(2) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Map Optimization Performance Test
        </h1>
        
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg mb-4">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Expected Performance Improvements:
          </h2>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• <strong>Batch Geocoding:</strong> Rate-limited requests instead of Promise.all()</li>
            <li>• <strong>Persistent Caching:</strong> 7-day localStorage cache for geocoded addresses</li>
            <li>• <strong>Optimized Rendering:</strong> MapBox Source/Layer instead of individual markers</li>
            <li>• <strong>Target:</strong> Reduce load time from ~2.5 minutes to under 30 seconds</li>
          </ul>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={startTest}
            disabled={testStarted}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {testStarted ? 'Test Running...' : 'Start Performance Test'}
          </button>
          
          {duration && (
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              ✅ Completed in {duration}s
            </div>
          )}
          
          {testStarted && !duration && (
            <div className="text-orange-600 dark:text-orange-400">
              🔄 Testing in progress...
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This test uses {SAMPLE_RESOURCES.length} sample resources with real addresses in San Diego.
          Check the browser console for detailed performance logs.
        </div>
      </div>

      {testStarted && (
        <div className="border rounded-lg overflow-hidden shadow-lg">
          <OptimizedMapDisplay
            resources={SAMPLE_RESOURCES}
            height="600px"
            width="100%"
            city="San Diego, CA"
            onMarkerClick={(resource) => {
              console.log('📍 Clicked resource:', resource.name);
              // Trigger completion when first marker is clicked (map is fully ready)
              if (!endTime) {
                handleMapReady();
              }
            }}
          />
        </div>
      )}
      
      {testStarted && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Test Progress:</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <div>• Sample resources loaded: {SAMPLE_RESOURCES.length}</div>
            <div>• Performance monitoring: Active</div>
            <div>• Cache status: Check localStorage for &apos;living_books_geocode_cache_v1&apos;</div>
            <div>• Expected improvements: Geocoding speed, rendering efficiency, caching benefits</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapOptimizationTest;