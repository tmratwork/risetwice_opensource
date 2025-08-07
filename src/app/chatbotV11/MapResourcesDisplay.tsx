"use client";

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import MapDisplay from '@/components/MapDisplay';
import { type Resource } from '@/components/MapOptimizations';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapResourcesDisplayProps {
  searchId?: string;
  visible: boolean;
  onClose: () => void;
}

// Helper function for timestamped logging
const logWithTimestamp = (prefix: string, message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  const perfTime = performance.now().toFixed(2);
  console.log(`${timestamp} [PERF:${perfTime}ms] [MapDisplay] ${prefix} ${message}`, ...args);
};

let renderCount = 0;
function MapResourcesDisplay({ searchId, visible, onClose }: MapResourcesDisplayProps) {
  renderCount++;
  // Only log every 10th render to reduce spam but still show the issue
  if (renderCount % 10 === 1) {
    logWithTimestamp('🖼️ [MapResourcesDisplay]', `=== COMPONENT RENDER #${renderCount} ===`);
    logWithTimestamp('🖼️ [MapResourcesDisplay]', 'Props:', { searchId, visible });
    logWithTimestamp('🖼️ [MapResourcesDisplay]', 'This component is rendering even though props may not have changed');
  }
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [city, setCity] = useState<string>('San Diego, CA');
  const [debugInfo, setDebugInfo] = useState<{
    totalResources: number;
    withLocation: number;
    withCoordinates: number;
    locationTypes: Record<string, number>;
  }>({ 
    totalResources: 0, 
    withLocation: 0, 
    withCoordinates: 0,
    locationTypes: {}
  });
  
  // Track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);

  // Memoized fetch function to prevent re-creation
  const fetchResources = useCallback(async () => {
    if (!searchId || isFetchingRef.current) {
      logWithTimestamp('⏭️ [MapResourcesDisplay]', 'Skipping fetch - no searchId or already fetching');
      return;
    }
    
    const fetchStartTime = performance.now();
    logWithTimestamp('🔄 [MapResourcesDisplay]', `Starting fetch for searchId: ${searchId}`);
    
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // Get search data from sessionStorage
      const existingSearches = JSON.parse(sessionStorage.getItem('resource_searches') || '[]');
      const searchData = existingSearches.find((s: { id: string }) => s.id === searchId);
      
      if (!searchData) {
        setError("Could not find search data. Please try a new search.");
        setLoading(false);
        return;
      }
      
      // Extract city from search data
      if (searchData.location) {
        logWithTimestamp('🏙️ [MapResourcesDisplay]', `Setting city to: ${searchData.location}`);
        setCity(searchData.location);
      } else {
        logWithTimestamp('⚠️ [MapResourcesDisplay]', 'No location specified in search data');
      }
      
      // Use existing search results from sessionStorage instead of making duplicate API call
      logWithTimestamp('💾 [MapResourcesDisplay]', 'Using cached search results from sessionStorage');
      
      if (searchData && searchData.results && searchData.results.resources) {
        // Analyze resources before filtering
        const allResources = searchData.results.resources as Resource[];
        const resourcesWithLocation = allResources.filter(
          (r: Resource) => r.location || r.coordinates
        );
        
        // Collect debug information about resources
        const resourceTypes: Record<string, number> = {};
        allResources.forEach((r: Resource) => {
          const type = r.resource_type || 'unknown';
          resourceTypes[type] = (resourceTypes[type] || 0) + 1;
        });
        
        // Set debug info
        setDebugInfo({
          totalResources: allResources.length,
          withLocation: allResources.filter((r: Resource) => r.location).length,
          withCoordinates: allResources.filter((r: Resource) => r.coordinates).length,
          locationTypes: resourceTypes
        });
        
        const fetchDuration = ((performance.now() - fetchStartTime) / 1000).toFixed(2);
        logWithTimestamp('📥 [MapResourcesDisplay]', `Resources loaded from cache in ${fetchDuration}s`);
        
        // Debug: Log exactly what we have in cache
        logWithTimestamp('🔍 [MapResourcesDisplay]', '=== CACHED DATA DEBUG ===');
        logWithTimestamp('🔍 [MapResourcesDisplay]', 'Full cached response:', searchData);
        logWithTimestamp('🔍 [MapResourcesDisplay]', 'Resources array:', searchData.results.resources);
        
        if (searchData.results.resources) {
          searchData.results.resources.forEach((resource: Resource, i: number) => {
            logWithTimestamp(`🔍 [MapResourcesDisplay]`, `Cached Resource ${i}: name="${resource.name}", location="${resource.location}", contact="${resource.contact}"`);
          });
        }
        
        // Log detailed resource info
        logWithTimestamp('🔍 [MapResourcesDisplay]', 'All resources:', allResources.map((r: Resource) => ({
          name: r.name?.substring(0, 30),
          location: r.location || 'none',
          coordinates: r.coordinates || 'none',
          resource_type: r.resource_type
        })));
        
        // Warn if resources don't match expected location
        if (searchData.location) {
          const expectedCity = searchData.location.toLowerCase();
          const mismatchedResources = allResources.filter((r: Resource) => {
            const resourceLocation = (r.location || '').toLowerCase();
            return resourceLocation && !resourceLocation.includes(expectedCity);
          });
          
          if (mismatchedResources.length > 0) {
            logWithTimestamp('⚠️ [MapResourcesDisplay]', `WARNING: ${mismatchedResources.length}/${allResources.length} resources are NOT in ${searchData.location}`);
            logWithTimestamp('⚠️ [MapResourcesDisplay]', 'Mismatched locations:', mismatchedResources.map(r => ({
              name: r.name?.substring(0, 30),
              location: r.location
            })));
          }
        }
        
        // Filter and set resources that have locations
        logWithTimestamp('📍 [MapResourcesDisplay]', `Setting ${resourcesWithLocation.length} resources with locations`);
        setResources(resourcesWithLocation);
        
        // Enhanced logging for resource display success/failure
        console.log('[AI-INTERACTION] ===== MAP COMPONENT RESOURCE RESULTS =====');
        console.log('[AI-INTERACTION] Total resources found:', allResources.length);
        console.log('[AI-INTERACTION] Resources with locations:', resourcesWithLocation.length);
        console.log('[AI-INTERACTION] Search data location:', searchData.location);
        
        if (resourcesWithLocation.length === 0) {
          console.log('[AI-INTERACTION] 🚨 ISSUE: No resources have location data for map display');
          console.log('[AI-INTERACTION] All resources:', allResources.map(r => ({ name: r.name, location: r.location })));
          setError("No resources with location information found.");
        } else {
          console.log('[AI-INTERACTION] ✅ SUCCESS: Resources loaded and ready for map display');
          console.log('[AI-INTERACTION] Resources for map:', resourcesWithLocation.map(r => ({ 
            name: r.name?.substring(0, 30), 
            location: r.location,
            hasCoordinates: !!r.coordinates 
          })));
        }
      } else {
        setError("No resource data available.");
        setDebugInfo({ 
          totalResources: 0, 
          withLocation: 0, 
          withCoordinates: 0,
          locationTypes: {}
        });
      }
    } catch (err) {
      const fetchDuration = ((performance.now() - fetchStartTime) / 1000).toFixed(2);
      logWithTimestamp('❌ [MapResourcesDisplay]', `Error processing search data after ${fetchDuration}s:`, err);
      setError("Error processing search data. Please try again.");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [searchId]);
  
  // Load resources from sessionStorage when component mounts or searchId changes
  useEffect(() => {
    logWithTimestamp('⚡ [MapResourcesDisplay]', '=== PARENT LOAD RESOURCES EFFECT ===');
    logWithTimestamp('⚡ [MapResourcesDisplay]', `Visible: ${visible}, SearchId: ${searchId}`);
    
    if (!visible || !searchId) {
      logWithTimestamp('⚡ [MapResourcesDisplay]', 'Skipping resource load - not visible or no searchId');
      
      // Enhanced logging for resource display failure diagnosis
      console.log('[AI-INTERACTION] ===== MAP COMPONENT NOT DISPLAYING =====');
      console.log('[AI-INTERACTION] Map visible:', visible);
      console.log('[AI-INTERACTION] Search ID:', searchId);
      console.log('[AI-INTERACTION] Reason: component not visible or no search ID provided');
      if (!visible) {
        console.log('[AI-INTERACTION] 🚨 ISSUE: Map component is not visible - check if search triggered map display event');
      }
      if (!searchId) {
        console.log('[AI-INTERACTION] 🚨 ISSUE: No search ID provided - check if resource search function generated search ID');
      }
      
      return;
    }
    
    console.log('[AI-INTERACTION] ===== MAP COMPONENT LOADING RESOURCES =====');
    console.log('[AI-INTERACTION] Search ID:', searchId);
    console.log('[AI-INTERACTION] Map visible:', visible);
    console.log('[AI-INTERACTION] About to load resources from session storage');
    
    fetchResources();
  }, [searchId, visible, fetchResources]);

  // Handle resource marker click
  const handleResourceClick = useCallback((resource: Resource) => {
    setSelectedResource(resource);
  }, []);

  // Handle closing the resource details view
  const handleCloseDetails = useCallback(() => {
    setSelectedResource(null);
  }, []);

  if (!visible) {
    if (renderCount % 10 === 1) {
      logWithTimestamp('🖼️ [MapResourcesDisplay]', 'Component actually rendered but returning null - not visible');
    }
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resources Map</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
          {/* Map container - ensure it has sufficient height */}
          <div className="w-full md:w-2/3 h-[400px] md:h-[600px] relative" style={{ minHeight: '400px' }}>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 p-4 bg-white dark:bg-gray-800 rounded shadow">{error}</div>
              </div>
            ) : (
              <>
                {logWithTimestamp('🌐 [MapResourcesDisplay]', `Passing ${resources.length} resources to MapDisplay with city: "${city}"`)}
                <MapDisplay 
                  resources={resources}
                  height="100%"
                  width="100%"
                  onMarkerClick={handleResourceClick}
                  className="rounded-none"
                  center={[-117.1611, 32.7157]} // San Diego center
                  zoom={10}
                  city={city}
                />
                {/* Debug overlay */}
                <div className="absolute bottom-0 left-0 bg-white dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 p-1 text-xs text-gray-600 dark:text-gray-400 max-w-full overflow-hidden">
                  Resources: {debugInfo.totalResources} total | {debugInfo.withLocation} with location | {debugInfo.withCoordinates} with coordinates
                </div>
              </>
            )}
          </div>
          
          {/* Resource list/details panel */}
          <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            {selectedResource ? (
              <div className="p-4">
                <div className="mb-2 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">{selectedResource.name}</h3>
                  <button 
                    onClick={handleCloseDetails}
                    className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Back to list
                  </button>
                </div>
                
                <div className="mb-2">
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                    {selectedResource.resource_type.replace('_', ' ')}
                  </span>
                  {selectedResource.verified && (
                    <span className="ml-2 inline-block px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      Verified
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{selectedResource.description}</p>
                
                {selectedResource.location && (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Location:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedResource.location}</p>
                  </div>
                )}
                
                {selectedResource.contact && (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Contact:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedResource.contact}</p>
                  </div>
                )}
                
                {selectedResource.website && (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Website:</p>
                    <a 
                      href={selectedResource.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {selectedResource.website}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 px-2">Resources List</h3>
                {resources.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 px-2">
                    {loading ? "Loading resources..." : "No resources with location information available."}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {resources.map((resource, index) => (
                      <li key={index} className="py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => handleResourceClick(resource)}>
                        <div className="flex justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{resource.name}</p>
                          {resource.verified && (
                            <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{resource.resource_type.replace('_', ' ')}</p>
                        {resource.location && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{resource.location}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
let memoComparisonCount = 0;
export default memo(MapResourcesDisplay, (prevProps, nextProps) => {
  memoComparisonCount++;
  const searchIdEqual = prevProps.searchId === nextProps.searchId;
  const visibleEqual = prevProps.visible === nextProps.visible;
  const onCloseEqual = prevProps.onClose === nextProps.onClose;
  
  const areEqual = searchIdEqual && visibleEqual && onCloseEqual;
  
  // Always log when props are not equal to find the issue
  if (!areEqual) {
    console.log('[MapDisplay] Props changed! Memo comparison #' + memoComparisonCount, {
      searchIdEqual,
      visibleEqual,
      onCloseEqual,
      prevOnClose: prevProps.onClose,
      nextOnClose: nextProps.onClose,
      areTheSameFunction: prevProps.onClose === nextProps.onClose
    });
    
    // ⚠️ WARNING: If onCloseEqual is false, the parent component is passing
    // a new function reference on every render. Use useCallback in the parent:
    // const handleClose = useCallback(() => { ... }, []);
    if (!onCloseEqual) {
      console.warn('⚠️ [MapDisplay] onClose function is unstable! Use useCallback in parent component');
    }
  }
  
  return areEqual;
});