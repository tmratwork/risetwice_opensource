# Claude API Web Search Response Format Consistency

Yes, Claude maintains a consistent JSON format for all web search responses. Based on the logs and general API documentation:

## Standard Format Elements

For any web search operation, Claude's API returns responses with these consistent components:

1. **Core Response Structure**:
   ```json
   {
     "id": "msg_...",
     "model": "claude-3-X-...",
     "content": [...],
     "stop_reason": "end_turn" | "max_tokens" | etc.,
     "usage": {
       "input_tokens": X,
       "output_tokens": Y,
       "server_tool_use": {
         "web_search_requests": Z
       }
     }
   }
   ```

2. **Content Array Block Types**:
   - `text` blocks (Claude's responses)
   - `server_tool_use` blocks (search queries)
   - `web_search_tool_result` blocks (search results)
   - Citation-enhanced text blocks

3. **Web Search Result Format**:
   Each search result consistently contains:
   ```json
   {
     "type": "web_search_result",
     "title": "Page Title",
     "url": "https://example.com/...",
     "encrypted_content": "EpABC...",
     "page_age": "Date" | null
   }
   ```

4. **Citation Format**:
   ```json
   {
     "citations": [
       {
         "type": "web_search_result_location",
         "cited_text": "Quoted text...",
         "url": "https://example.com/...",
         "title": "Page Title",
         "encrypted_index": "EpABC..."
       }
     ],
     "type": "text",
     "text": "Claude's text with citation..."
   }
   ```

## Format Consistency Across Uses

This format remains consistent regardless of:
- The search query content
- Number of search iterations (up to the limit)
- The Claude model version being used
- Whether results are found or not

The only variations you might see are:
- Number of blocks in the `content` array (depends on search complexity)
- Presence of `page_age` (sometimes null)
- Number of citations (depends on Claude's answer)
- Additional fields might appear in newer API versions

This standardized format makes it reliable to parse and extract information programmatically from any Claude web search response.

---

# Text Block Location in Claude API Response

The `text` blocks are located directly within the `content` array of the Claude API response. Here's exactly where to find them:

## Structure of `content` Array

```json
{
  "id": "msg_...",
  "model": "claude-3-x-...",
  "content": [  // <-- This is the top-level array
    {
      "type": "text",  // <-- Look for blocks with this type
      "text": "I understand you need time-sensitive information..."  // <-- This contains Claude's response text
    },
    {
      "type": "server_tool_use",
      "id": "srvtoolu_...",
      "name": "web_search",
      "input": { "query": "..." }
    },
    {
      "type": "web_search_tool_result",
      "tool_use_id": "srvtoolu_...",
      "content": [...]
    },
    // More blocks...
    {
      "citations": [...],  // <-- Some text blocks also have citations
      "type": "text",
      "text": "The San Diego Housing Commission..."
    }
  ],
  "stop_reason": "max_tokens",
  "usage": {...}
}
```

## Two Variants of Text Blocks

1. **Simple Text Blocks**:
   ```json
   {
     "type": "text",
     "text": "Based on my research..."
   }
   ```

2. **Text Blocks with Citations**:
   ```json
   {
     "citations": [
       {
         "type": "web_search_result_location",
         "cited_text": "...",
         "url": "...",
         "title": "...",
         "encrypted_index": "..."
       }
     ],
     "type": "text",
     "text": "The San Diego Housing Commission..."
   }
   ```

To extract all of Claude's text responses, you should process all content blocks that have `"type": "text"`, whether they have citations or not. These blocks, arranged sequentially, contain the complete synthesized information Claude is providing.