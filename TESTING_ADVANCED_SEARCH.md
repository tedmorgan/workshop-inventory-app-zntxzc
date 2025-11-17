
# Testing Advanced Search Feature

## Pre-requisites

Before testing, ensure:

1. ✅ OpenAI API key is configured in Supabase Edge Functions secrets
2. ✅ You have at least a few tools in your inventory
3. ✅ The `advanced-tool-search` Edge Function is deployed

## Quick Test Checklist

### 1. Test Simple Search (Baseline)

- [ ] Open the app and navigate to "Find Tool"
- [ ] Verify "Simple Tool Search" is selected by default
- [ ] Enter a tool name you know exists (e.g., "hammer")
- [ ] Press Search
- [ ] Verify results appear with images and bin locations

### 2. Test Advanced Search (AI)

- [ ] Tap "Advanced Search" button
- [ ] Verify the input changes to multi-line
- [ ] Enter: "What would be good to use for removing drywall?"
- [ ] Press Search
- [ ] Wait 2-5 seconds for AI response
- [ ] Verify AI response appears in a card format
- [ ] Verify response mentions specific tools from your inventory

### 3. Test Mode Switching

- [ ] Switch between Simple and Advanced modes
- [ ] Verify search input changes appropriately
- [ ] Verify previous results are cleared when switching

### 4. Test Error Handling

- [ ] Try searching with empty input (should be disabled)
- [ ] If API key not configured, verify error message is clear

## Sample Test Queries

### For Advanced Search

Try these queries to test different scenarios:

**General Tool Queries:**
- "What tools do I need for drywall installation?"
- "Show me all my cutting tools"
- "What do I have for electrical work?"
- "Tools for woodworking projects"

**Location-Based Queries:**
- "What's in my garage bins?"
- "Show me tools in the basement"
- "What tools are in bin A?"

**Task-Based Queries:**
- "What do I need to hang a picture?"
- "Tools for fixing a leaky faucet"
- "What should I use for sanding wood?"
- "How can I cut metal pipes?"

**Inventory Queries:**
- "Do I have any power drills?"
- "What measuring tools do I own?"
- "List all my hand tools"

## Expected Behavior

### Simple Search
- **Speed**: Instant results
- **Results**: List of matching inventory items
- **Display**: Images, bin names, locations, tool lists

### Advanced Search
- **Speed**: 2-5 seconds (API processing)
- **Results**: AI-generated text response
- **Display**: Formatted text in a card with sparkle icon
- **Content**: 
  - Specific tool recommendations
  - Bin names and locations
  - Explanation of why tools are suitable
  - Suggestions if no exact match

## Troubleshooting

### Issue: "OpenAI API key not configured"

**Solution**: 
1. Go to Supabase Dashboard
2. Navigate to Edge Functions → Secrets
3. Add `OPENAI_API_KEY` with your OpenAI key
4. Restart the Edge Function if needed

### Issue: "Failed to get AI response"

**Possible Causes**:
- Invalid OpenAI API key
- Insufficient OpenAI credits
- Rate limit exceeded
- Network connectivity issue

**Solution**:
1. Verify API key in OpenAI dashboard
2. Check OpenAI account has credits
3. Wait a moment and try again
4. Check Supabase Edge Function logs

### Issue: AI response is not relevant

**Possible Causes**:
- Empty or very small inventory
- Query is too vague
- Tools don't match the query

**Solution**:
1. Add more tools to your inventory
2. Make query more specific
3. Try different phrasing

### Issue: Search button stays disabled

**Cause**: Empty search input

**Solution**: Type something in the search box

## Checking Edge Function Logs

To debug issues:

1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Click on `advanced-tool-search`
4. View the Logs tab
5. Look for error messages or API responses

## Performance Benchmarks

**Expected Response Times**:
- Simple Search: < 100ms
- Advanced Search: 2-5 seconds
- Image Loading: 1-2 seconds

**API Costs** (approximate):
- Per Advanced Search: $0.00015 - $0.0003
- Depends on inventory size and response length

## Success Criteria

The feature is working correctly if:

1. ✅ Both search modes are accessible
2. ✅ Simple search returns matching results instantly
3. ✅ Advanced search returns AI-generated recommendations
4. ✅ AI response is relevant to the query
5. ✅ AI mentions specific tools from your inventory
6. ✅ Bin names and locations are included in AI response
7. ✅ Error messages are clear and helpful
8. ✅ UI is responsive and smooth

## Example Successful AI Response

**Query**: "What would be good to use for removing drywall?"

**Expected Response**:
```
Based on your inventory, here are the tools that would be perfect for removing drywall:

1. **Utility Knife** (Bin: Tool Box A, Location: Garage Shelf 2)
   - Essential for scoring and cutting through drywall paper

2. **Pry Bar** (Bin: Hand Tools, Location: Workshop Wall)
   - Great for pulling drywall away from studs

3. **Hammer** (Bin: Tool Box A, Location: Garage Shelf 2)
   - Useful for punching through drywall to create starting points

4. **Reciprocating Saw** (Bin: Power Tools, Location: Garage Cabinet)
   - Makes quick work of cutting through drywall in larger sections

These tools will help you efficiently remove drywall. Start with the utility knife to score, use the hammer to create access points, and the pry bar to pull sections away from the wall.
```

## Next Steps After Testing

Once testing is complete:

1. Document any issues found
2. Verify API costs are acceptable
3. Consider adding more test queries
4. Share feedback on AI response quality
5. Monitor OpenAI usage in dashboard
