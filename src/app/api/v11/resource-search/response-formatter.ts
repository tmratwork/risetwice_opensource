// file: src/app/api/v11/resource-search/response-formatter.ts

/**
 * Helper module for formatting resource search results
 * Provides enhanced formatting for various resource types
 */

interface Resource {
  name: string;
  description: string;
  contact?: string | null;
  website?: string | null;
  resource_type: string;
  availability?: string;
  location?: string;
  verified?: boolean;
  relevance_score?: number;
}

interface SearchParams {
  query: string;
  resource_type?: string;
  location_specific?: boolean;
  location?: string;
}

interface FormatOptions {
  includeLinks: boolean;
  includeVerificationStatus: boolean;
  highlightImportant: boolean;
  listFormat: 'markdown' | 'plain' | 'html';
}

/**
 * Formats a single resource for display with appropriate formatting
 */
export function formatSingleResource(resource: Resource, options: Partial<FormatOptions> = {}): string {
  const {
    includeLinks = true,
    includeVerificationStatus = false,
    highlightImportant = true,
    listFormat = 'markdown'
  } = options;

  // Base resource text
  let resourceText = '';
  
  // Add resource name (with formatting based on format type)
  if (listFormat === 'markdown') {
    resourceText += `**${resource.name}**`;
  } else if (listFormat === 'html') {
    resourceText += `<strong>${resource.name}</strong>`;
  } else {
    resourceText += resource.name;
  }
  
  // Add resource type
  resourceText += ` (${resource.resource_type.replace('_', ' ')})`;
  
  // Add verification marker if requested and resource is verified
  if (includeVerificationStatus && resource.verified) {
    if (listFormat === 'markdown') {
      resourceText += ' ✓';
    } else if (listFormat === 'html') {
      resourceText += ' <span class="verified">✓</span>';
    } else {
      resourceText += ' [Verified]';
    }
  }
  
  // Add description
  resourceText += `\n${resource.description}`;
  
  // Add contact info if available
  if (resource.contact) {
    if (highlightImportant) {
      if (listFormat === 'markdown') {
        resourceText += `\n**Contact:** ${resource.contact}`;
      } else if (listFormat === 'html') {
        resourceText += `\n<strong>Contact:</strong> ${resource.contact}`;
      } else {
        resourceText += `\nContact: ${resource.contact}`;
      }
    } else {
      resourceText += `\nContact: ${resource.contact}`;
    }
  }
  
  // Add website if available and links are included
  if (resource.website && includeLinks) {
    if (listFormat === 'markdown') {
      resourceText += `\n**Website:** [${resource.website}](${resource.website})`;
    } else if (listFormat === 'html') {
      resourceText += `\n<strong>Website:</strong> <a href="${resource.website}">${resource.website}</a>`;
    } else {
      resourceText += `\nWebsite: ${resource.website}`;
    }
  } else if (resource.website) {
    resourceText += `\nWebsite: ${resource.website}`;
  }
  
  // Add availability if present
  if (resource.availability) {
    resourceText += `\nAvailability: ${resource.availability}`;
  }
  
  // Add location if present
  if (resource.location) {
    resourceText += `\nLocation: ${resource.location}`;
  }
  
  return resourceText;
}

/**
 * Formats a list of resources for display
 */
export function formatResourceList(resources: Resource[], options: Partial<FormatOptions> = {}): string {
  const {
    listFormat = 'markdown'
  } = options;
  
  // Sort resources by relevance score if available
  const sortedResources = [...resources].sort((a, b) => {
    // If relevance scores are available, use them
    if (a.relevance_score !== undefined && b.relevance_score !== undefined) {
      return b.relevance_score - a.relevance_score;
    }
    // Otherwise, alphabetical by name
    return a.name.localeCompare(b.name);
  });
  
  // Format each resource and join with appropriate separators
  return sortedResources.map((resource, index) => {
    // Add item numbering based on format
    if (listFormat === 'markdown') {
      return `${index + 1}. ${formatSingleResource(resource, options)}`;
    } else if (listFormat === 'html') {
      return `<li>${formatSingleResource(resource, options)}</li>`;
    } else {
      return `${index + 1}. ${formatSingleResource(resource, options)}`;
    }
  }).join(listFormat === 'html' ? '' : '\n\n');
}

/**
 * Creates a summary section based on search query and results
 */
export function generateResourceSummary(resources: Resource[], params: SearchParams): string {
  if (resources.length === 0) {
    return `I couldn't find any specific mental health resources matching your query about "${params.query}". Please try a different search term or consider contacting a local healthcare provider for more information.`;
  }
  
  let summary = `I found ${resources.length} resource${resources.length === 1 ? '' : 's'} that might help with your query about "${params.query}". `;
  
  // Add resource type context if provided
  if (params.resource_type && params.resource_type !== 'other') {
    const friendlyType = params.resource_type.replace('_', ' ');
    summary += `They focus on ${friendlyType} services. `;
  }
  
  // Add location context if provided
  if (params.location_specific && params.location) {
    summary += `These resources are specific to ${params.location}. `;
  } else {
    summary += 'These resources may be available in various locations. ';
  }
  
  // Add usage guidance
  summary += 'Below is a list of the most relevant resources I found:';
  
  return summary;
}

/**
 * Generate a disclaimer to add to resource results
 */
export function generateResourceDisclaimer(): string {
  return `\n\nPlease note: This information is provided for educational purposes and doesn't constitute professional advice. Always verify resource availability and suitability before reaching out. If you're in crisis, please call your local emergency number or a crisis hotline immediately.`;
}

/**
 * Creates a comprehensive, formatted resource list with summary and disclaimer
 */
export function createFormattedResourceResponse(
  resources: Resource[],
  params: SearchParams,
  options: Partial<FormatOptions> = {}
): string {
  const summary = generateResourceSummary(resources, params);
  const resourceList = formatResourceList(resources, options);
  const disclaimer = generateResourceDisclaimer();
  
  return `${summary}\n\n${resourceList}${disclaimer}`;
}

/**
 * Analyzes resource results to provide recommendations and next steps
 */
export function analyzeResourceResults(resources: Resource[], params: SearchParams): string {
  if (resources.length === 0) {
    return 'Consider broadening your search or trying different keywords to find more resources. You might also want to contact local community services or healthcare providers for location-specific assistance.';
  }
  
  // Count resource types
  const typeCounts: Record<string, number> = {};
  resources.forEach(resource => {
    typeCounts[resource.resource_type] = (typeCounts[resource.resource_type] || 0) + 1;
  });
  
  const dominantType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .shift();
  
  let analysisText = '';
  
  // Add suggestions based on search results
  if (dominantType && dominantType[0] === 'crisis_hotline' && dominantType[1] > 1) {
    analysisText += 'Multiple crisis resources are available. If you\'re in immediate distress, please consider calling one of the crisis hotlines listed above. ';
  } else if (dominantType && dominantType[0] === 'therapy' && dominantType[1] > 1) {
    analysisText += 'Several therapy options are available. Consider factors like cost, availability, and approach when choosing a therapist. ';
  }
  
  // Add location-specific suggestions if no location was provided
  if (!params.location) {
    analysisText += 'For more location-specific resources, try adding your city or region to your search query. ';
  }
  
  // Add general next steps
  analysisText += 'If you\'d like more information on a specific resource, I can help you understand what they offer or how to contact them.';
  
  return analysisText;
}

/**
 * Full formatter function to create a comprehensive response
 */
export function createCompleteResourceResponse(
  resources: Resource[],
  params: SearchParams
): string {
  const formattedResponse = createFormattedResourceResponse(resources, params, {
    includeLinks: true,
    includeVerificationStatus: true,
    highlightImportant: true,
    listFormat: 'markdown'
  });
  
  const analysis = analyzeResourceResults(resources, params);
  
  return `${formattedResponse}\n\n**Next Steps:**\n${analysis}`;
}