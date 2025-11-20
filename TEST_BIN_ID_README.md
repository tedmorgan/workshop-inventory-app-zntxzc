# Bin ID Accuracy Test Script

This test script validates how often GPT returns correct bin IDs in the advanced search responses.

## Prerequisites

Install TypeScript runner (choose one):

```bash
# Option 1: Install tsx (recommended - faster)
npm install -g tsx

# Option 2: Install ts-node
npm install -g ts-node

# Option 3: Use npx (no installation needed)
# Just use npx tsx or npx ts-node
```

## Usage

### Method 1: Using npm script

```bash
npm run test:bin-ids <deviceId>
```

### Method 2: Direct execution

```bash
# Using tsx
tsx test-bin-id-accuracy.ts <deviceId>

# Using ts-node
ts-node test-bin-id-accuracy.ts <deviceId>

# Using npx (no installation)
npx tsx test-bin-id-accuracy.ts <deviceId>
```

### Method 3: Using environment variable

```bash
DEVICE_ID=your-device-id-here tsx test-bin-id-accuracy.ts
```

## Getting Your Device ID

You can find your device ID in the app logs when it starts, or check the `tool_inventory` table in Supabase. The device ID is a UUID format string.

## What the Test Does

1. **Fetches your inventory** from Supabase (filtered by device ID)
2. **Makes 30 different queries** to the advanced-tool-search Edge Function
3. **Parses AI responses** to extract bin IDs from each tool
4. **Validates bin IDs** by checking if they exist in your actual inventory
5. **Reports statistics** on accuracy:
   - Percentage of queries with 100% valid bin IDs
   - Percentage of tools with valid bin IDs
   - List of invalid bin IDs found
   - Detailed breakdown of failed queries

## Test Queries

The script tests with 30 diverse queries including:
- "What tools do I need for drywall work?"
- "I need to drill a hole in concrete"
- "What can I use to cut wood?"
- And 27 more varied tool-related questions

## Output

The script provides:
- **Real-time progress** as each query is tested
- **Summary statistics** showing overall accuracy
- **Failed queries** with details on which bin IDs were invalid
- **Unique invalid bin IDs** list for debugging

## Example Output

```
🚀 Starting Bin ID Accuracy Test
📱 Device ID: 16C5874D...
📊 Testing 30 queries

[1/30] Testing: "What tools do I need for drywall work?"
[2/30] Testing: "I need to drill a hole in concrete"
...

================================================================================
📊 TEST RESULTS SUMMARY
================================================================================
Total Queries: 30
Successful Queries (100% valid bin IDs): 25 (83.3%)
Failed Queries: 5 (16.7%)

Total Tools Parsed: 150
Tools with Valid Bin IDs: 142 (94.7%)
Tools with Invalid Bin IDs: 8 (5.3%)
Tools without Bin IDs: 0 (0.0%)
```

## Troubleshooting

### "Device ID required" error
Make sure you provide the device ID as an argument or environment variable.

### "No inventory found"
Check that the device ID is correct and that you have inventory items in Supabase.

### Rate limiting errors
The script includes a 1-second delay between queries. If you still hit rate limits, increase the delay in the script.

### Edge Function errors
Make sure your Supabase Edge Function is deployed and the URL/key are correct in the script.

## Notes

- The test makes real API calls to OpenAI (costs apply)
- Each query takes ~2-5 seconds depending on API response time
- Total test time: ~2-3 minutes for 30 queries
- The script validates bin IDs against your actual inventory, so results are device-specific

