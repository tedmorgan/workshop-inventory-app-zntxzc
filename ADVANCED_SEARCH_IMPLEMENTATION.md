
# Advanced Search Implementation Summary

## Overview

The Find Tool screen now has two search modes:

1. **Simple Tool Search** - Direct text matching against tool names, bin names, and locations
2. **Advanced Search** - AI-powered natural language search using OpenAI's GPT-4o-mini

## Architecture

### Frontend (app/find-tool.tsx)

- Toggle between Simple and Advanced search modes
- Simple search: Client-side filtering of inventory
- Advanced search: Calls Supabase Edge Function with natural language query

### Backend (Supabase Edge Function)

**Function Name**: `advanced-tool-search`

**Endpoint**: `https://[your-project].supabase.co/functions/v1/advanced-tool-search`

**Flow**:
```
User Query → Edge Function → Fetch Inventory → Format for AI → OpenAI API → Response
```

## Key Features

### Simple Tool Search
- Fast, instant results
- Searches tool names, bin names, and bin locations
- Case-insensitive matching
- Shows matching inventory items with images

### Advanced Search
- Natural language queries
- AI analyzes entire inventory
- Contextual recommendations
- Explains why tools are suitable
- Suggests alternatives if tools not found

## API Key Configuration

**Required Environment Variable**: `OPENAI_API_KEY`

**Where to Set**: Supabase Dashboard → Edge Functions → Secrets

**Format**: `sk-...` (OpenAI API key)

See `OPENAI_API_SETUP.md` for detailed setup instructions.

## Code Structure

### State Management
```typescript
const [searchMode, setSearchMode] = useState<SearchMode>('simple');
const [simpleSearchQuery, setSimpleSearchQuery] = useState('');
const [advancedSearchQuery, setAdvancedSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<ToolInventoryItem[]>([]);
const [aiResponse, setAiResponse] = useState<string>('');
```

### Simple Search Function
```typescript
const searchToolsSimple = async () => {
  // Fetch inventory from Supabase
  // Filter client-side based on query
  // Display matching items
}
```

### Advanced Search Function
```typescript
const searchToolsAdvanced = async () => {
  // Call Edge Function with query and device ID
  // Display AI response
}
```

## Edge Function Details

### Input
```json
{
  "searchQuery": "What would be good to use for removing drywall?",
  "deviceId": "user-device-id"
}
```

### Output
```json
{
  "response": "Based on your inventory, here are the tools...",
  "inventoryCount": 15
}
```

### AI Prompt Structure

**System Prompt**: Defines the AI as a workshop tool assistant

**User Prompt**: Includes:
- User's question
- Complete formatted inventory (tools, bin names, locations)
- Instruction to recommend tools and locations

## UI Components

### Mode Toggle
- Two buttons: Simple Tool Search and Advanced Search
- Visual indicator for active mode
- Icons: magnifying glass (simple) and sparkles (advanced)

### Search Input
- **Simple**: Single-line text input
- **Advanced**: Multi-line text input (3-5 lines)
- Placeholder examples for guidance

### Results Display
- **Simple**: List of matching inventory items with images
- **Advanced**: AI-generated text response in a card

## Error Handling

### Edge Function Errors
- Missing API key: Clear error message
- OpenAI API failure: User-friendly error
- Database errors: Logged and handled gracefully

### Frontend Errors
- Network failures: Retry suggestion
- Empty inventory: Helpful message
- No results: Alternative suggestions

## Performance Considerations

- Simple search: Instant (client-side)
- Advanced search: 2-5 seconds (API call)
- Loading indicators for both modes
- Keyboard dismissal on search

## Security

- API key stored in Supabase secrets (not in code)
- Device ID used to filter user's inventory
- Edge Function validates all inputs
- CORS headers properly configured

## Testing

### Test Simple Search
1. Enter "hammer" in simple search
2. Should show all bins containing hammers

### Test Advanced Search
1. Switch to Advanced Search
2. Enter "What tools do I need for drywall work?"
3. Should receive AI recommendations

## Future Enhancements

Potential improvements:
- Voice input for advanced search
- Search history
- Favorite queries
- Tool recommendations based on project type
- Integration with tool purchase suggestions
