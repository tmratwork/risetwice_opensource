// Optimized geocoding and map rendering utilities for MapDisplay
// Based on WebAI recommendations for reducing 2.5min load time to under 30s

interface Resource {
  name: string;
  description: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  resource_type: string;
  type?: string;
  address?: string | null;
  location?: string;
  hours?: string | null;
  eligibility?: string | null;
  costs?: string | null;
  languages?: string | null;
  accessibility?: string | null;
  notes?: string | null;
  verified: boolean;
  citation_index: number;
  availability?: string;
  coordinates?: [number, number];
  relevance_score?: number;
}

interface GeocodedResource extends Resource {
  coordinates: [number, number];
  geocoding_accuracy?: string;
  geocoding_confidence?: number;
}

interface CachedGeocode {
  coordinates: [number, number];
  timestamp: number;
  accuracy: string;
  confidence?: number;
}

// Persistent cache using localStorage
const GEOCODE_CACHE_KEY = 'living_books_geocode_cache_v1';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

class GeocodeCache {
  private static getCache(): Record<string, CachedGeocode> {
    try {
      const cached = localStorage.getItem(GEOCODE_CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('[GeocodeCache] Failed to read cache:', error);
      return {};
    }
  }

  private static setCache(cache: Record<string, CachedGeocode>): void {
    try {
      localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('[GeocodeCache] Failed to write cache:', error);
    }
  }

  static get(address: string, city: string): CachedGeocode | null {
    const cache = this.getCache();
    const key = `${address}_${city}`.toLowerCase().trim();
    const cached = cache[key];

    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      return cached;
    }

    return null;
  }

  static set(address: string, city: string, result: CachedGeocode): void {
    const cache = this.getCache();
    const key = `${address}_${city}`.toLowerCase().trim();
    cache[key] = result;
    this.setCache(cache);
  }

  static cleanup(): void {
    const cache = this.getCache();
    const now = Date.now();
    const cleaned = Object.fromEntries(
      Object.entries(cache).filter(([, value]) =>
        now - value.timestamp < CACHE_DURATION
      )
    );
    this.setCache(cleaned);
  }
}

// Helper function for timestamped logging
const logWithTimestamp = (prefix: string, message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  const perfTime = performance.now().toFixed(2);
  console.log(`${timestamp} [PERF:${perfTime}ms] [MapDisplay] ${prefix} ${message}`, ...args);
};

// Optimized batch geocoding with rate limiting
export const batchGeocode = async (
  resources: Resource[],
  city: string,
  mapboxToken: string,
  onProgress?: (progress: number) => void
): Promise<GeocodedResource[]> => {
  const startTime = performance.now();

  logWithTimestamp('🎯 [BatchGeocode]', `Starting batch geocoding for ${resources.length} resources in ${city}`);

  // Clean cache periodically
  GeocodeCache.cleanup();

  // Step 1: Separate cached vs uncached
  const cached: GeocodedResource[] = [];
  const needGeocoding: Resource[] = [];

  resources.forEach(resource => {
    if (!resource.address) {
      console.warn(`[BatchGeocode] Skipping resource without address: ${resource.name}`);
      return;
    }

    const cachedResult = GeocodeCache.get(resource.address, city);

    if (cachedResult) {
      cached.push({
        ...resource,
        coordinates: cachedResult.coordinates,
        geocoding_accuracy: cachedResult.accuracy,
        geocoding_confidence: cachedResult.confidence
      } as GeocodedResource);
    } else {
      needGeocoding.push(resource);
    }
  });

  logWithTimestamp('📊 [BatchGeocode]', `${cached.length} cached, ${needGeocoding.length} new requests needed`);
  onProgress?.(10);

  if (needGeocoding.length === 0) {
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    logWithTimestamp('✅ [BatchGeocode]', `All results from cache in ${duration}s`);
    onProgress?.(100);
    return cached;
  }

  // Step 2: Batch process uncached with rate limiting
  const geocoded: GeocodedResource[] = [];
  const BATCH_SIZE = 5; // Smaller batches to avoid rate limits
  const DELAY_BETWEEN_BATCHES = 200; // ms - slightly longer delay

  const totalBatches = Math.ceil(needGeocoding.length / BATCH_SIZE);

  for (let i = 0; i < needGeocoding.length; i += BATCH_SIZE) {
    const batch = needGeocoding.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    logWithTimestamp('📍 [BatchGeocode]', `Processing batch ${batchNumber}/${totalBatches} (${batch.length} resources)`);

    const batchPromises = batch.map(async (resource, batchIndex) => {
      // Clean and validate the address to prevent 422 errors
      const cleanAddress = (resource.address || '').toString()
        .replace(/^(null|undefined|N\/A),?\s*/i, '')
        .replace(/,?\s*null\s*$/i, '')
        .replace(/[^\w\s,.-]/g, '') // Remove special characters except basic punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Skip if address is empty, too short, or just the city name
      if (!cleanAddress || cleanAddress.length < 3 || cleanAddress.toLowerCase() === city.toLowerCase()) {
        logWithTimestamp(`⚠️ [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Skipping invalid/generic address: "${resource.address}" -> "${cleanAddress}"`);
        return null;
      }

      // Use the address as-is without appending city (resources may not be in the specified city)
      const searchTerm = cleanAddress;

      logWithTimestamp(`🔍 [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Geocoding: ${resource.name} - "${searchTerm}" (original: "${resource.address}")`);

      const geocodeStartTime = performance.now();

      try {
        // Use Mapbox Geocoding v6 API with proper URL construction to avoid 422 errors
        const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
        url.searchParams.set('q', searchTerm);
        url.searchParams.set('country', 'us');
        url.searchParams.set('limit', '1');
        url.searchParams.set('types', 'address'); // v6 doesn't support 'poi' - use only 'address' to avoid 422 errors
        url.searchParams.set('access_token', mapboxToken);

        // Debug the final URL (with token masked for security)
        logWithTimestamp(`🔗 [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Request URL: ${url.toString().replace(mapboxToken, '[TOKEN]')}`);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 429) {
            logWithTimestamp(`    ⏳ [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Rate limit hit, will retry later`);
            throw new Error(`Rate limit exceeded (429) - will retry`);
          }
          if (response.status === 422) {
            // Enhanced 422 error debugging as suggested by WebAI
            const errorText = await response.text();
            let errorDetail = 'Unknown validation error';
            try {
              const errorJson = JSON.parse(errorText);
              errorDetail = errorJson.message || errorText;
            } catch {
              errorDetail = errorText;
            }
            logWithTimestamp(`    ❌ [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Validation error (422) for "${searchTerm}": ${errorDetail}`);
            logWithTimestamp(`    🔍 [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Full request details: ${url.toString()}`);
            throw new Error(`Geocoding validation error: ${errorDetail}`);
          }
          if (response.status === 401 || response.status === 403) {
            logWithTimestamp(`    🔐 [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Authentication error: ${response.status} - check Mapbox token`);
            throw new Error(`Authentication error: ${response.status} - check Mapbox token`);
          }
          logWithTimestamp(`    ❌ [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Geocoding API error: ${response.status} ${response.statusText}`);
          throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        const geocodeDuration = ((performance.now() - geocodeStartTime) / 1000).toFixed(3);

        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          // Mapbox returns coordinates as [longitude, latitude]
          const [lng, lat] = feature.geometry.coordinates;
          const coordinates: [number, number] = [lng, lat];
          const accuracy = feature.properties?.accuracy || (feature.relevance && feature.relevance > 0.8) ? 'rooftop' : 'approximate';
          const confidence = feature.relevance || 0.8;

          logWithTimestamp(`    ✅ [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Success in ${geocodeDuration}s: ${resource.name} -> [${lat.toFixed(4)}, ${lng.toFixed(4)}] (lng/lat: [${lng.toFixed(4)}, ${lat.toFixed(4)}])`);
          logWithTimestamp(`    📍 [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Coordinates format: [lng=${lng}, lat=${lat}] -> will be stored as [${lng}, ${lat}]`);

          // Cache the successful result
          GeocodeCache.set(resource.address!, city, {
            coordinates,
            timestamp: Date.now(),
            accuracy,
            confidence
          });

          return {
            ...resource,
            coordinates,
            geocoding_accuracy: accuracy,
            geocoding_confidence: confidence
          } as GeocodedResource;
        } else {
          logWithTimestamp(`    🚫 [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `No geocoding result for: ${resource.address} (${geocodeDuration}s)`);
          return null;
        }

      } catch (error) {
        const geocodeDuration = ((performance.now() - geocodeStartTime) / 1000).toFixed(3);
        logWithTimestamp(`    ❌ [BatchGeocode-${batchNumber}.${batchIndex + 1}]`, `Geocoding failed in ${geocodeDuration}s for "${resource.address}":`, error);
        return null;
      }
    });

    // Process batch and collect results
    const batchResults = await Promise.allSettled(batchPromises);

    let batchSuccesses = 0;
    batchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        geocoded.push(result.value);
        batchSuccesses++;
      }
    });

    logWithTimestamp('📊 [BatchGeocode]', `Batch ${batchNumber} complete: ${batchSuccesses}/${batch.length} successful`);

    // Update progress
    const progressPercent = 10 + (batchNumber / totalBatches) * 80;
    onProgress?.(Math.round(progressPercent));

    // Rate limiting: delay between batches (but not after the last batch)
    if (i + BATCH_SIZE < needGeocoding.length) {
      logWithTimestamp('⏱️ [BatchGeocode]', `Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  const totalResults = [...cached, ...geocoded];
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;

  logWithTimestamp('✅ [BatchGeocode]', `Completed in ${duration.toFixed(2)}s`);
  logWithTimestamp('📊 [BatchGeocode]', `Final results: ${totalResults.length}/${resources.length} geocoded (${Math.round(totalResults.length / resources.length * 100)}%)`);
  logWithTimestamp('📈 [BatchGeocode]', `Performance: ${cached.length} from cache, ${geocoded.length} from API`);

  onProgress?.(100);
  return totalResults;
};

// Helper function to clean location strings (moved from MapDisplay)
export const cleanLocationString = (location: string): string => {
  if (!location) return '';

  // Remove common prefixes/suffixes that interfere with geocoding
  const cleaned = location
    .replace(/^(located at|address|location|at|in)\s*:?\s*/i, '')
    .replace(/\s*(location|address)\s*$/i, '')
    .replace(/^["']|["']$/g, '') // Remove quotes
    .trim();

  // If it looks like contact info instead of location, return empty
  if (isContactInfo(cleaned)) {
    return '';
  }

  return cleaned;
};

// Helper to detect if text is contact info rather than location
const isContactInfo = (text: string): boolean => {
  const contactPatterns = [
    /call.*(?:right away|immediately|now)/i,
    /\b\d{3}[-.,\s]?\d{3}[-.,\s]?\d{4}\b/, // Phone numbers
    /\b2-?1-?1\b/, // 211
    /email|website|phone|contact/i,
    /^(for|to|call|visit|contact)\b/i
  ];

  return contactPatterns.some(pattern => pattern.test(text));
};

// Helper to extract location from description (moved from MapDisplay)
export const extractLocationFromDescription = (description: string): string | null => {
  if (!description) return null;

  const locationPatterns = [
    /(?:located|situated|found|based)\s+(?:at|in|on)\s+([^.!?\n]+)/i,
    /(?:address|location):\s*([^.!?\n]+)/i,
    /\b(downtown|uptown|midtown|central|north|south|east|west)\s+\w+/i,
    /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|blvd|drive|dr)\b/i
  ];

  for (const pattern of locationPatterns) {
    const match = description.match(pattern);
    if (match) {
      const extracted = match[1] || match[0];
      if (!isContactInfo(extracted)) {
        return extracted.trim();
      }
    }
  }

  return null;
};

export type { Resource, GeocodedResource, CachedGeocode };