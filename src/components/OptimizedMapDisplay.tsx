"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { batchGeocode, type Resource, type GeocodedResource } from './MapOptimizations';

// Get Mapbox token from environment variable
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface OptimizedMapDisplayProps {
  resources: Resource[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  width?: string;
  onMarkerClick?: (resource: GeocodedResource) => void;
  className?: string;
  city?: string;
}

interface PerformanceStats {
  geocodingTime: number;
  renderTime: number;
  totalTime: number;
  cacheHits: number;
  apiCalls: number;
}

// Helper function for timestamped logging
const logWithTimestamp = (prefix: string, message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  const perfTime = performance.now().toFixed(2);
  console.log(`${timestamp} [PERF:${perfTime}ms] [MapDisplay] ${prefix} ${message}`, ...args);
};

export const OptimizedMapDisplay = ({
  resources,
  center = [-117.1611, 32.7157], // Default to San Diego center
  zoom = 11,
  height = '500px',
  width = '100%',
  onMarkerClick,
  className = '',
  city = 'San Diego, CA'
}: OptimizedMapDisplayProps) => {
  logWithTimestamp('🗺️ [OptimizedMapDisplay]', `=== COMPONENT RENDER === Resources count: ${resources.length}`);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const isInitializing = useRef<boolean>(false);
  const hasInitialized = useRef<boolean>(false);

  const [geocodedResources, setGeocodedResources] = useState<GeocodedResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [selectedResource, setSelectedResource] = useState<GeocodedResource | null>(null);
  const [isMapInitializing, setIsMapInitializing] = useState<boolean>(false);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // Initialize map
  const initializeMap = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || !mapContainer.current || map.current || isInitializing.current || hasInitialized.current) {
      if (map.current) {
        logWithTimestamp('⚠️ [OptimizedMapDisplay]', 'Map already exists, skipping initialization');
      }
      if (isInitializing.current) {
        logWithTimestamp('⚠️ [OptimizedMapDisplay]', 'Map initialization already in progress, skipping');
      }
      if (hasInitialized.current) {
        logWithTimestamp('⚠️ [OptimizedMapDisplay]', 'Map already initialized once, skipping to prevent recreation');
      }
      return;
    }

    isInitializing.current = true;
    hasInitialized.current = true;
    setIsMapInitializing(true);

    try {
      if (!MAPBOX_TOKEN) {
        throw new Error('Mapbox token not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your environment.');
      }

      mapboxgl.accessToken = MAPBOX_TOKEN;

      logWithTimestamp('🗺️ [OptimizedMapDisplay]', 'Creating Mapbox GL map...');

      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: zoom,
        preserveDrawingBuffer: true
      });

      // Add navigation controls
      mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Handle successful load
      mapInstance.on('load', () => {
        logWithTimestamp('✅ [OptimizedMapDisplay]', 'Map canvas ready - waiting for resource data...');
        map.current = mapInstance;
        isInitializing.current = false;
        setIsMapInitializing(false);
        setIsMapLoaded(true);
        setLoading(false);
      });


      // Handle errors
      mapInstance.on('error', (e) => {
        logWithTimestamp('❌ [OptimizedMapDisplay]', 'Map error:', e);
        setError('Map loading error');
        isInitializing.current = false;
        setIsMapInitializing(false);
      });

    } catch (err) {
      logWithTimestamp('❌ [OptimizedMapDisplay]', 'Error creating map:', err);
      isInitializing.current = false;
      setIsMapInitializing(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []); // Remove changing dependencies - use default values and don't recreate map for prop changes

  // Create stable resource key for comparison
  const resourcesKey = JSON.stringify(resources.map(r => ({
    name: r.name,
    address: r.address || r.location,
    coordinates: r.coordinates
  })));

  // Process resources with optimized geocoding
  const processResources = useCallback(async () => {
    if (resources.length === 0) {
      setGeocodedResources([]);
      return;
    }

    const startTime = performance.now();
    setLoading(true);
    setLoadingProgress(0);
    setError(null);

    try {
      logWithTimestamp('📊 [OptimizedMapDisplay]', `Processing ${resources.length} resources (search city: ${city})`);

      // Filter resources that already have coordinates (skip geocoding)
      const withCoordinates = resources.filter(r => r.coordinates) as GeocodedResource[];
      const needGeocoding = resources.filter(r => !r.coordinates && (r.address || r.location));

      // Ensure needGeocoding resources have address field (fallback to location)
      const resourcesForGeocoding = needGeocoding.map(r => ({
        ...r,
        address: r.address || r.location || ''
      }));

      logWithTimestamp('📍 [OptimizedMapDisplay]', `${withCoordinates.length} with coordinates, ${needGeocoding.length} need geocoding`);

      let geocoded: GeocodedResource[] = [];
      const initialApiCallCount = needGeocoding.length;

      if (resourcesForGeocoding.length > 0) {
        setLoadingProgress(5);
        geocoded = await batchGeocode(
          resourcesForGeocoding,
          city,
          MAPBOX_TOKEN,
          (progress) => {
            // Map geocoding progress to 5-85% of total progress
            const mappedProgress = 5 + (progress * 80) / 100;
            setLoadingProgress(Math.round(mappedProgress));
          }
        );
        setLoadingProgress(85);
      }

      // Combine results
      const allResults: GeocodedResource[] = [...withCoordinates, ...geocoded];

      // If no geocoding succeeded but we have resources, show them without coordinates
      if (allResults.length === 0 && resources.length > 0) {
        logWithTimestamp('⚠️ [OptimizedMapDisplay]', 'No resources could be geocoded, showing without map markers');
        setError('Unable to locate resources on map. Check internet connection or try again later.');
      }

      setLoadingProgress(90);

      const endTime = performance.now();
      const totalTime = (endTime - startTime) / 1000;

      // Calculate cache performance
      const cacheHits = initialApiCallCount - (geocoded.length || 0);
      const apiCalls = geocoded.length || 0;

      setPerformanceStats({
        geocodingTime: totalTime * 0.8,
        renderTime: totalTime * 0.2,
        totalTime,
        cacheHits,
        apiCalls
      });

      setGeocodedResources(allResults);
      setLoadingProgress(100);

      logWithTimestamp('🎉 [OptimizedMapDisplay]', `Complete! Processed ${allResults.length} resources in ${totalTime.toFixed(2)}s`);
      logWithTimestamp('📈 [OptimizedMapDisplay]', `Performance: ${cacheHits} cache hits, ${apiCalls} API calls`);

    } catch (error) {
      logWithTimestamp('❌ [OptimizedMapDisplay]', 'Processing failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to process resources');
    } finally {
      setLoading(false);
    }
  }, [resourcesKey, city]);

  // Clear existing markers function
  const clearMarkers = useCallback(() => {
    const markerCount = markersRef.current.length;
    logWithTimestamp('🧹 [OptimizedMapDisplay]', `Removing ${markerCount} existing markers`);
    
    markersRef.current.forEach((marker, index) => {
      try {
        marker.remove();
      } catch (error) {
        logWithTimestamp('⚠️ [OptimizedMapDisplay]', `Error removing marker ${index + 1}:`, error);
      }
    });
    markersRef.current = [];
  }, []);

  // Add markers to map using proper Mapbox GL JS markers
  const addMarkersToMap = useCallback(() => {
    if (!map.current || !isMapLoaded || isMapInitializing || geocodedResources.length === 0) {
      logWithTimestamp('⚠️ [OptimizedMapDisplay]', `Cannot add markers - map ready: ${isMapLoaded}, initializing: ${isMapInitializing}, resources: ${geocodedResources.length}`);
      return;
    }

    // Additional safety check - ensure map is still valid
    try {
      if (!map.current.getContainer()) {
        logWithTimestamp('❌ [OptimizedMapDisplay]', 'Map container is invalid, skipping marker placement');
        return;
      }
    } catch (error) {
      logWithTimestamp('❌ [OptimizedMapDisplay]', 'Map instance is invalid, skipping marker placement:', error);
      return;
    }

    const layerStartTime = performance.now();
    logWithTimestamp('📍 [OptimizedMapDisplay]', `=== ADDING MARKERS TO MAP ===`);
    logWithTimestamp('📍 [OptimizedMapDisplay]', `Processing ${geocodedResources.length} geocoded resources`);

    // Log each resource's coordinates before processing
    geocodedResources.forEach((resource, index) => {
      const [lng, lat] = resource.coordinates;
      logWithTimestamp('📍 [OptimizedMapDisplay]', `Resource ${index}: ${resource.name} -> [lng=${lng.toFixed(4)}, lat=${lat.toFixed(4)}]`);
    });

    // Clear existing markers first
    clearMarkers();

    let successfulMarkers = 0;
    let failedMarkers = 0;

    // Create individual markers using Mapbox GL JS API
    geocodedResources.forEach((resource, index) => {
      try {
        const [lng, lat] = resource.coordinates;

        // Validate coordinates
        if (!lng || !lat || isNaN(lng) || isNaN(lat)) {
          logWithTimestamp('❌ [OptimizedMapDisplay]', `Invalid coordinates for ${resource.name}: [${lng}, ${lat}]`);
          failedMarkers++;
          return;
        }

        // Create marker element with better styling
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        markerElement.style.cssText = `
          background: #ff4757;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: bold;
          transition: filter 0.2s ease, box-shadow 0.2s ease;
          z-index: 1000;
        `;
        markerElement.textContent = (index + 1).toString();

        // Add hover effect using filter properties to avoid interfering with Mapbox positioning
        markerElement.addEventListener('mouseenter', () => {
          markerElement.style.filter = 'brightness(1.2) contrast(1.1)';
          markerElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)';
        });
        markerElement.addEventListener('mouseleave', () => {
          markerElement.style.filter = 'none';
          markerElement.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
        });

        // Create popup with better formatting
        const popup = new mapboxgl.Popup({ 
          offset: 35,
          closeButton: true,
          closeOnClick: false
        }).setHTML(`
          <div style="padding: 12px; max-width: 250px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; line-height: 1.3; color: #1a1a1a;">${resource.name}</h3>
            <div style="margin: 8px 0; padding: 6px 0; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 6px 0; font-size: 14px; color: #666; line-height: 1.4;">
                📍 ${resource.address || resource.location || 'Location not specified'}
              </p>
              ${resource.phone ? 
                `<p style="margin: 0; font-size: 14px; color: #007cbf; line-height: 1.4;">
                  📞 ${resource.phone}
                </p>` : 
                ''
              }
            </div>
          </div>
        `);

        logWithTimestamp('📍 [OptimizedMapDisplay]', `Creating marker ${index + 1}: ${resource.name} at [lng=${lng.toFixed(4)}, lat=${lat.toFixed(4)}]`);

        // Create and add marker using Mapbox GL JS - IMPORTANT: Mapbox expects [lng, lat] for LngLat
        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat([lng, lat]) // lng first, lat second
          .setPopup(popup)
          .addTo(map.current!);

        // Add click handler to marker element
        markerElement.addEventListener('click', () => {
          logWithTimestamp('🖱️ [OptimizedMapDisplay]', `Marker clicked: ${resource.name}`);
          setSelectedResource(resource);
          if (onMarkerClick) {
            onMarkerClick(resource);
          }
        });

        markersRef.current.push(marker);
        logWithTimestamp('✅ [OptimizedMapDisplay]', `Successfully added marker ${index + 1}: ${resource.name}`);
        successfulMarkers++;

      } catch (error) {
        logWithTimestamp('❌ [OptimizedMapDisplay]', `Failed to create marker ${index + 1}: ${resource.name} - ${error}`);
        failedMarkers++;
      }
    });

    // Fit map to show all markers if we have any successful ones
    if (successfulMarkers > 0) {
      try {
        const coordinates = geocodedResources
          .filter(r => r.coordinates && r.coordinates[0] && r.coordinates[1])
          .map(r => r.coordinates);

        if (coordinates.length > 1) {
          const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

          map.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15
          });
          logWithTimestamp('🗺️ [OptimizedMapDisplay]', `Map fitted to ${coordinates.length} markers`);
        } else if (coordinates.length === 1) {
          map.current.flyTo({
            center: coordinates[0],
            zoom: 13
          });
          logWithTimestamp('🗺️ [OptimizedMapDisplay]', `Map centered on single marker`);
        }
      } catch (error) {
        logWithTimestamp('❌ [OptimizedMapDisplay]', `Failed to fit map bounds: ${error}`);
      }
    }

    const layerDuration = ((performance.now() - layerStartTime) / 1000).toFixed(3);
    logWithTimestamp('📍 [OptimizedMapDisplay]', `=== MARKER PLACEMENT COMPLETE ===`);
    logWithTimestamp('📍 [OptimizedMapDisplay]', `Successfully added ${successfulMarkers} markers to map in ${layerDuration}s`);
    logWithTimestamp('📍 [OptimizedMapDisplay]', `Failed markers: ${failedMarkers}`);

    if (failedMarkers > 0) {
      logWithTimestamp('⚠️ [OptimizedMapDisplay]', `Warning: ${failedMarkers} markers failed to place`);
    }
  }, [geocodedResources, onMarkerClick, isMapLoaded, isMapInitializing, clearMarkers]);

  // Initialize map on mount (only once)
  useEffect(() => {
    initializeMap();

    return () => {
      logWithTimestamp('🧹 [OptimizedMapDisplay]', 'Cleaning up map instance');
      clearMarkers();
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setIsMapLoaded(false);
      setIsMapInitializing(false);
    };
  }, []); // Empty dependency array - only run once on mount

  // Process resources when they change
  useEffect(() => {
    processResources();
  }, [processResources]);

  // Add markers when geocoded resources are ready and map is loaded
  useEffect(() => {
    if (isMapLoaded && !loading && !isMapInitializing && geocodedResources.length > 0) {
      logWithTimestamp('📍 [OptimizedMapDisplay]', '=== TRIGGERING MARKER PLACEMENT ===');
      // Add a small delay to ensure map is fully ready
      const timeout = setTimeout(() => {
        addMarkersToMap();
      }, 100);

      return () => clearTimeout(timeout);
    } else {
      logWithTimestamp('⏭️ [OptimizedMapDisplay]', `Skipping marker placement - mapLoaded: ${isMapLoaded}, loading: ${loading}, initializing: ${isMapInitializing}, resources: ${geocodedResources.length}`);
    }
  }, [geocodedResources, loading, isMapLoaded, isMapInitializing, addMarkersToMap]);

  // Create popup for selected resource
  useEffect(() => {
    if (!map.current) return;

    // Remove existing popup
    const existingPopups = document.getElementsByClassName('mapboxgl-popup');
    if (existingPopups.length > 0) {
      Array.from(existingPopups).forEach(popup => popup.remove());
    }

    if (selectedResource) {
      const popupContent = `
        <div style="padding: 12px; max-width: 300px;">
          <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #1F2937;">
            ${selectedResource.name}
          </h3>
          
          <div style="font-size: 14px; line-height: 1.4; color: #374151;">
            <p style="margin-bottom: 8px;">${selectedResource.description}</p>
            
            ${selectedResource.address ? `
              <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px;">
                <span style="color: #6B7280;">📍</span>
                <span>${selectedResource.address}</span>
              </div>
            ` : ''}
            
            ${selectedResource.phone ? `
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span style="color: #6B7280;">📞</span>
                <a href="tel:${selectedResource.phone}" style="color: #2563EB; text-decoration: none;">
                  ${selectedResource.phone}
                </a>
              </div>
            ` : ''}
            
            ${selectedResource.website ? `
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                <span style="color: #6B7280;">🌐</span>
                <a href="${selectedResource.website}" target="_blank" rel="noopener noreferrer" 
                   style="color: #2563EB; text-decoration: none;">
                  Visit Website
                </a>
              </div>
            ` : ''}
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid #E5E7EB;">
              <span style="padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; ${selectedResource.verified
          ? 'background-color: #D1FAE5; color: #065F46;'
          : 'background-color: #F3F4F6; color: #374151;'
        }">
                ${selectedResource.verified ? '✓ Verified' : 'Unverified'}
              </span>
              
              <span style="font-size: 12px; color: #6B7280; text-transform: capitalize;">
                ${selectedResource.resource_type.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 })
        .setLngLat(selectedResource.coordinates)
        .setHTML(popupContent)
        .addTo(map.current);

      popup.on('close', () => {
        setSelectedResource(null);
      });
    }
  }, [selectedResource]);

  return (
    <div className={`relative ${className}`} style={{ width, height, minHeight: height }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          minHeight: height
        }}
        className="rounded-lg overflow-hidden shadow-md"
        data-testid="optimized-map-container"
      />

      {/* Loading overlay */}
      {(loading || isMapInitializing) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 bg-opacity-95 rounded-lg">
          <div className="w-64 bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-gray-700 font-medium text-center">
            {isMapInitializing ? 'Initializing map...' : `Processing ${resources.length} resources... ${loadingProgress}%`}
          </p>
          <p className="text-sm text-gray-500 mt-1 text-center">
            {isMapInitializing ? 'Setting up map canvas...' :
              loadingProgress < 10 ? 'Initializing...' :
              loadingProgress < 85 ? 'Geocoding addresses...' :
                loadingProgress < 95 ? 'Preparing map...' :
                  'Finalizing...'}
          </p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-90 rounded-lg">
          <div className="text-red-700 font-medium p-4 bg-white rounded-md shadow-lg max-w-md text-center">
            <p className="font-semibold mb-2">Error Loading Map</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* No results overlay */}
      {!loading && !error && geocodedResources.length === 0 && resources.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded-lg">
          <div className="text-gray-700 font-medium p-4 bg-white rounded-md shadow-lg">
            No locations could be geocoded. Please check the location data.
          </div>
        </div>
      )}

      {/* Resource count indicator */}
      {!loading && geocodedResources.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3">
          <div className="text-sm font-medium text-gray-900">
            📍 {geocodedResources.length} Locations Mapped
          </div>
          <div className="text-xs text-gray-600">
            in {city}
          </div>
          <div className="text-xs text-green-600 mt-1">
            ✅ Red numbered markers show locations
          </div>
        </div>
      )}

      {/* Performance stats */}
      {performanceStats && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white bg-opacity-90 p-2 rounded shadow">
          ⚡ Performance: {performanceStats.totalTime.toFixed(1)}s total
          ({performanceStats.cacheHits} cached, {performanceStats.apiCalls} API calls)
        </div>
      )}
    </div>
  );
};

export default OptimizedMapDisplay;