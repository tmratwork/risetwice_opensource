"use client";

import { memo } from 'react';
import { OptimizedMapDisplay } from './OptimizedMapDisplay';
import { type Resource } from './MapOptimizations';

interface MapDisplayProps {
  resources: Resource[];
  center?: [number, number]; // Default center point [longitude, latitude]
  zoom?: number;
  height?: string;
  width?: string;
  onMarkerClick?: (resource: Resource) => void;
  className?: string;
  city?: string;
}

// Helper function for timestamped logging
const logWithTimestamp = (prefix: string, message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  const perfTime = performance.now().toFixed(2);
  console.log(`${timestamp} [PERF:${perfTime}ms] [MapDisplay] ${prefix} ${message}`, ...args);
};

const MapDisplay = ({
  resources,
  center = [-117.1611, 32.7157], // Default to San Diego center
  zoom = 11,
  height = '400px',
  width = '100%',
  onMarkerClick,
  className = '',
  city = 'San Diego, CA'
}: MapDisplayProps) => {
  logWithTimestamp('🗺️ [MapDisplay]', `=== USING OPTIMIZED IMPLEMENTATION === Resources count: ${resources.length}`);

  // Use the optimized implementation with all the performance improvements
  return (
    <OptimizedMapDisplay
      resources={resources}
      center={center}
      zoom={zoom}
      height={height}
      width={width}
      onMarkerClick={onMarkerClick}
      className={className}
      city={city}
    />
  );
};

export default memo(MapDisplay);