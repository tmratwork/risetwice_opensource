# Mental Health Resource Search Feature

This module provides a way for the LivingBooks V11 mental health AI companion to search for and retrieve mental health resources for users. The feature enables the AI to respond to user requests for information about available resources, support services, and mental health organizations.

## Overview

The resource search feature consists of these core components:

1. **Function Description**: A new AI function definition that describes when and how the AI should use the resource search capability
2. **API Route**: A backend service that handles search requests and returns formatted results
3. **Function Implementation**: The client-side implementation of the function in the Mental Health hook
4. **Response Formatter**: Enhanced formatting for displaying resource information in a user-friendly way

## How It Works

When a user asks about available mental health resources, the AI can recognize this intent and call the `resource_search_function`. This function:

1. Takes a search query and optional parameters like resource type and location
2. Sends the request to the backend API
3. Returns formatted results back to the AI
4. The AI can then present these resources to the user in a clear, helpful way

## Usage

### Function Parameters

The resource search function accepts these parameters:

- `query` (required): The search query to find relevant mental health resources
- `resource_type` (optional): The category of resource (e.g., "crisis_hotline", "therapy", "support_group")
- `location_specific` (optional): Whether the search should focus on location-specific resources
- `location` (optional): The specific location to search for resources

### Example Usage

```typescript
// Example of how the resource search function is called
const result = await resourceSearchFunction({
  query: "depression support groups",
  resource_type: "support_group",
  location_specific: true,
  location: "Chicago, IL"
});
```

### Response Format

The function returns a structured response with:

- A summary of the search results
- A list of relevant resources with details like:
  - Name
  - Description
  - Contact information (if available)
  - Website (if available)
  - Resource type
  - Availability
  - Location
- A formatted response ready to be presented to the user
- Suggestions for next steps based on the search results

## Implementation Details

### Mock Data for Development

The current implementation uses mock data for different resource types:
- Crisis hotlines and emergency services
- Therapy and counseling services
- Support groups
- Substance abuse resources
- General mental health resources

In a production environment, this would be replaced with a real search API or database query.

### Resource Types

The system supports these resource types:
- `crisis_hotline`: Emergency support services
- `therapy`: Professional therapy and counseling services
- `support_group`: Peer and community support groups
- `community_service`: Local community resources
- `educational`: Educational resources and information
- `financial_assistance`: Financial support for mental health
- `housing`: Housing assistance related to mental health
- `substance_abuse`: Resources for substance use disorders
- `other`: Miscellaneous resources

## Future Enhancements

Potential improvements for this feature:

1. Integration with a real search API or mental health resource database
2. Geolocation-based resource finding
3. Filtering by insurance acceptance, cost, or availability
4. Resource ratings and reviews
5. More sophisticated relevance scoring for better result ranking
6. User feedback collection on resource usefulness

## Security and Privacy Considerations

- User search queries are logged for analytics purposes only when a userId is provided
- No personally identifiable information is stored with search data
- Resources are marked as "verified" if they come from trusted sources
- Users are reminded to verify resource information before contacting

## API Reference

### Endpoint

```
POST /api/v11/resource-search
```

### Request Body

```json
{
  "query": "String (required)",
  "resource_type": "String (optional)",
  "location_specific": "Boolean (optional)",
  "location": "String (optional)",
  "userId": "String (optional)"
}
```

### Response

```json
{
  "success": true,
  "results": {
    "summary": "String",
    "resources": "Array of resource objects",
    "result_count": "Number",
    "query_context": "Object",
    "formatted_response": "String (ready to display)"
  },
  "query": "String",
  "resource_type": "String",
  "location": "String"
}
```