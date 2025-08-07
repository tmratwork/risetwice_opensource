// Helper functions to extract and process location data from Claude API web search results

import { Resource, Citation } from './route';

interface ExtractedLocation {
  name: string;
  address?: string;
  coordinates?: [number, number]; // [longitude, latitude]
  confidence: number; // 0-1 scale of how confident we are in this location
}

/**
 * Extracts location information from a resource description
 */
export function extractLocationFromResource(resource: Resource): ExtractedLocation | null {
  // Skip resources that don't have enough information
  if (!resource.description || resource.description.length < 10) {
    return null;
  }

  // Extract location from description
  let location: ExtractedLocation | null = null;

  // Check if the resource has a location field already
  if (resource.location) {
    location = {
      name: resource.name,
      address: resource.location,
      confidence: 0.8 // High confidence if explicitly provided
    };
  } else {
    // 1. Try to extract explicit address declarations from description
    // Patterns like "Address: 123 Main St, San Diego, CA"
    const explicitAddressMatch = resource.description.match(/(?:address|location|located at|find us at|situated at)\s*(?:is|:|at)?\s*([^\.,;\n]+(?:[\.,]\s*[A-Za-z\s]+(?:,\s*[A-Z]{2})?)?)/i);
    if (explicitAddressMatch && explicitAddressMatch[1] && explicitAddressMatch[1].length > 10) {
      location = {
        name: resource.name,
        address: explicitAddressMatch[1].trim(),
        confidence: 0.85
      };
    } else {
      // 2. Look for street address patterns with numbers
      // This pattern looks for numbers followed by street names and optional city/state
      const streetAddressMatch = resource.description.match(/(\d+\s+[A-Za-z0-9\s-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Plaza|Plz|Square|Sq|Highway|Hwy|Parkway|Pkwy|Terrace|Ter|Place|Pl|Suite|Ste|Unit|Apt|Circle|Cir|Trail|Trl)[^\.,;\n]*(?:[\.,]\s*[A-Za-z\s]+(?:[\.,]\s*[A-Z]{2})?)?)/i);
      if (streetAddressMatch && streetAddressMatch[1] && streetAddressMatch[1].length > 10) {
        location = {
          name: resource.name,
          address: streetAddressMatch[1].trim(),
          confidence: 0.8
        };
      } else {
        // 3. Try to find an address with a zip code pattern
        const zipCodeMatch = resource.description.match(/([^\.,;\n]+?\s+\d{5}(?:-\d{4})?)/i);
        if (zipCodeMatch && zipCodeMatch[1] && zipCodeMatch[1].length > 10) {
          location = {
            name: resource.name,
            address: zipCodeMatch[1].trim(),
            confidence: 0.75
          };
        }
      }
    }
  }

  // If no specific address was found, use general location terms
  if (!location) {
    // 4. Look for city/state patterns like "San Diego, CA"
    const cityStateMatch = resource.description.match(/(?:in|of|near|at|serving)\s+([A-Za-z\s.-]+,\s*[A-Z]{2})/i);
    if (cityStateMatch && cityStateMatch[1]) {
      location = {
        name: resource.name,
        address: cityStateMatch[1].trim(),
        confidence: 0.6
      };
    } else {
      // 5. Look for standalone city or region names
      const cityMatch = resource.description.match(/(?:in|of|near|at|serving)\s+([A-Za-z\s.-]+(?:City|Town|Village|County|Area|Region))/i);
      if (cityMatch && cityMatch[1]) {
        location = {
          name: resource.name,
          address: cityMatch[1].trim(),
          confidence: 0.5
        };
      } else {
        // 6. Look for standalone recognized place names
        const placeMatch = resource.description.match(/(?:in|of|near|at|serving)\s+([A-Za-z\s.-]+(?:San Diego|Los Angeles|New York|Chicago|Houston|Phoenix|Philadelphia|San Antonio|Dallas|Austin))/i);
        if (placeMatch && placeMatch[1]) {
          location = {
            name: resource.name,
            address: placeMatch[1].trim(),
            confidence: 0.45
          };
        }
      }
    }
  }

  return location;
}

/**
 * Enhances resources with location information from web search citations
 */
export function enhanceResourcesWithCitations(resources: Resource[], citations: Citation[]): Resource[] {
  return resources.map(resource => {
    // Skip if there's no citation index
    if (resource.citation_index === undefined || resource.citation_index < 0 || !citations[resource.citation_index]) {
      return resource;
    }

    const citation = citations[resource.citation_index];
    let foundLocation = false;
    let locationFromUrl = '';
    
    // Look for location in citation URL
    if (citation.url) {
      // 1. Look for common location patterns in URLs
      // Pattern for city-state: sandiego-ca, san-francisco-ca
      const cityStateMatch = citation.url.match(/(?:\/|\.)([a-z]+-[a-z]+)(?:\/|\.|\?|$)/i);
      if (cityStateMatch && cityStateMatch[1]) {
        locationFromUrl = cityStateMatch[1].replace(/-/g, ' ');
        foundLocation = true;
      }
      
      // 2. Look for regions/areas in directories
      // Pattern for location directories: /locations/san-diego/ or /regions/southern-california/
      const locationDirMatch = citation.url.match(/\/(locations|areas|regions|cities|counties)\/([a-z0-9-]+)(?:\/|\.|\?|$)/i);
      if (locationDirMatch && locationDirMatch[2]) {
        // Higher quality location data from a location-specific directory
        locationFromUrl = locationDirMatch[2].replace(/-/g, ' ');
        foundLocation = true;
      }
      
      // 3. Check for location in domain name
      // Pattern for location subdomains: sandiego.example.com or sd.example.com
      const subdomainMatch = citation.url.match(/^https?:\/\/([a-z0-9-]+)\.(?:[a-z0-9-]+\.[a-z]{2,})/i);
      if (subdomainMatch && subdomainMatch[1] && !['www', 'web', 'api', 'mail', 'ftp', 'admin'].includes(subdomainMatch[1].toLowerCase())) {
        // Only if it doesn't look like a technical subdomain
        const subdomain = subdomainMatch[1].replace(/-/g, ' ');
        if (subdomain.length > 2) { // Avoid short codes
          locationFromUrl = subdomain;
          foundLocation = true;
        }
      }
      
      // 4. Look for specific organization domains that imply location
      // Pattern for government sites: sandiegocounty.gov, cityofsandiego.gov
      const govDomainMatch = citation.url.match(/^https?:\/\/(?:www\.)?(?:cityof|countyof)?([a-z0-9-]+)\.(gov|org|edu)/i);
      if (govDomainMatch && govDomainMatch[1] && govDomainMatch[1].length > 3) {
        // Government domains often indicate the location
        locationFromUrl = govDomainMatch[1].replace(/-/g, ' ');
        foundLocation = true;
      }
      
      // Only use if we don't already have a location and found something useful
      if (foundLocation && !resource.location && locationFromUrl.length > 3) {
        return {
          ...resource,
          location: locationFromUrl
        };
      }
    }

    // 5. Try to extract location from citation title if available
    if (citation.title && !resource.location) {
      // Look for location patterns in the title
      const titleLocationMatch = citation.title.match(/\b(San Diego|Los Angeles|New York|Chicago|Houston|Phoenix|Philadelphia|San Antonio|Dallas|Austin)\b/i);
      if (titleLocationMatch && titleLocationMatch[1]) {
        return {
          ...resource,
          location: titleLocationMatch[1]
        };
      }
    }

    return resource;
  });
}

/**
 * Process resources to add or improve location information
 */
export function processResourceLocations(resources: Resource[], citations: Citation[]): Resource[] {
  // First, enhance resources with citation data
  const enhancedResources = enhanceResourcesWithCitations(resources, citations);
  
  // Then extract and add location information where needed
  return enhancedResources.map(resource => {
    // Skip resources that already have good location data
    if (resource.location && resource.location.length > 5) {
      return resource;
    }

    const extractedLocation = extractLocationFromResource(resource);
    if (extractedLocation && extractedLocation.address) {
      return {
        ...resource,
        location: extractedLocation.address
      };
    }

    return resource;
  });
}

/**
 * Extract location information from resource name if not found elsewhere
 */
export function extractLocationFromName(resource: Resource): string | null {
  if (!resource.name) return null;
  
  // Look for locations in resource name - often format is "Name - Location"
  const nameLocationMatch = resource.name.match(/\s+-\s+([A-Za-z\s,]+)$/);
  if (nameLocationMatch && nameLocationMatch[1] && nameLocationMatch[1].length > 3) {
    return nameLocationMatch[1].trim();
  }
  
  // Look for locations in parentheses - format "Name (Location)"
  const parenthesesMatch = resource.name.match(/\(([A-Za-z\s,]+)\)$/);
  if (parenthesesMatch && parenthesesMatch[1] && parenthesesMatch[1].length > 3) {
    return parenthesesMatch[1].trim();
  }
  
  // Look for recognized city names in the resource name
  const cityMatch = resource.name.match(/\b(San Diego|Los Angeles|New York|Chicago|Houston|Phoenix|Philadelphia|San Antonio|Dallas|Austin|San Francisco|Seattle|Portland|Miami|Denver|Atlanta|Boston|Washington DC|Las Vegas)\b/);
  if (cityMatch && cityMatch[1]) {
    return cityMatch[1];
  }
  
  return null;
}

/**
 * Add a default location if none was found but we know the general search area
 * This helps when resource descriptions don't explicitly mention the location
 * but we know they are relevant to a specific area from the search context
 */
export function addDefaultLocation(resources: Resource[], defaultLocation: string | null): Resource[] {
  if (!defaultLocation) return resources;
  
  return resources.map(resource => {
    if (!resource.location) {
      return {
        ...resource,
        location: defaultLocation
      };
    }
    return resource;
  });
}

/**
 * Main function to enhance all resources with location data
 */
export function enhanceResourcesWithLocations(resources: Resource[], citations: Citation[]): Resource[] {
  console.log(`Enhancing ${resources.length} resources with location data`);
  
  // Process all resources to add or improve location information
  let processedResources = processResourceLocations(resources, citations);
  
  // Try to extract location from resource names for resources still missing location
  processedResources = processedResources.map(resource => {
    if (!resource.location) {
      const nameLocation = extractLocationFromName(resource);
      if (nameLocation) {
        return {
          ...resource,
          location: nameLocation
        };
      }
    }
    return resource;
  });
  
  // Log resources with locations for debugging
  const resourcesWithLocations = processedResources.filter(r => r.location);
  console.log(`Successfully added location data to ${resourcesWithLocations.length} resources`);
  
  // Log detailed information about resources to diagnose mapping issues
  console.log('=== BEFORE GEOCODING ===');
  processedResources.forEach((r, i) => {
    console.log(`${i}: "${r.name}" - Location: "${r.location || 'NONE'}"`);
  });
  
  return processedResources;
}