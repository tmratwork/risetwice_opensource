// Example of how to use MapResourcesDisplay with stable function references
// This prevents the memo optimization from failing due to function reference changes

"use client";

import React, { useState, useCallback } from 'react';
import MapResourcesDisplay from './MapResourcesDisplay';

export default function StableMapExample() {
  const [mapVisible, setMapVisible] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | undefined>(undefined);

  // ✅ CRITICAL: Use useCallback to create stable function reference
  // This prevents the memo from failing due to function reference changes
  const handleCloseMap = useCallback(() => {
    setMapVisible(false);
    setCurrentSearchId(undefined);
  }, []); // Empty dependencies - this function is always stable

  // Example function to trigger map display
  const handleShowMap = useCallback((searchId: string) => {
    setCurrentSearchId(searchId);
    setMapVisible(true);
  }, []);

  return (
    <div>
      {/* Your main content */}
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Resource Search</h1>
        
        {/* Example search buttons */}
        <div className="space-x-4">
          <button
            onClick={() => handleShowMap('search-emergency-shelter-san-diego')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Show Emergency Shelters
          </button>
          
          <button
            onClick={() => handleShowMap('search-food-banks-san-diego')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Show Food Banks
          </button>
        </div>
      </div>

      {/* Map overlay - only render when visible */}
      {mapVisible && (
        <MapResourcesDisplay
          searchId={currentSearchId}
          visible={mapVisible}
          onClose={handleCloseMap} // ✅ Stable function reference
        />
      )}
    </div>
  );
}

// Alternative pattern: If you need to pass dynamic data to onClose,
// you can still keep it stable by using useCallback with dependencies
export function StableMapExampleWithDynamicClose() {
  const [mapVisible, setMapVisible] = useState(false);
  const [currentSearchId, setCurrentSearchId] = useState<string | undefined>(undefined);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // ✅ Even with dependencies, this creates a stable reference
  // when the dependencies don't change
  const handleCloseMapWithHistory = useCallback(() => {
    setMapVisible(false);
    
    // Add to search history
    if (currentSearchId) {
      setSearchHistory(prev => [...prev, currentSearchId]);
    }
    
    setCurrentSearchId(undefined);
  }, [currentSearchId]); // Only recreated when currentSearchId changes

  const handleShowMap = useCallback((searchId: string) => {
    setCurrentSearchId(searchId);
    setMapVisible(true);
  }, []);

  return (
    <div>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Resource Search with History</h1>
        
        <div className="space-x-4 mb-4">
          <button
            onClick={() => handleShowMap('search-emergency-shelter-san-diego')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Show Emergency Shelters
          </button>
        </div>

        {/* Search history */}
        {searchHistory.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Recent Searches:</h3>
            <ul className="text-sm text-gray-600">
              {searchHistory.map((search, index) => (
                <li key={index}>{search}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {mapVisible && (
        <MapResourcesDisplay
          searchId={currentSearchId}
          visible={mapVisible}
          onClose={handleCloseMapWithHistory} // ✅ Stable reference with controlled dependencies
        />
      )}
    </div>
  );
}