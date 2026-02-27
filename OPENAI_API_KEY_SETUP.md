
# OpenAI API Key Setup Guide

## Overview
Your Advanced Search feature is already implemented and ready to use! You just need to add your OpenAI API key to Supabase.

## What's Already Done ✅
- ✅ Advanced Search UI in the Find Tool screen
- ✅ Supabase Edge Function (`advanced-tool-search`) deployed
- ✅ Integration between the app and the Edge Function

## Where to Add Your OpenAI API Key

### Step 1: Get Your OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy the key (it starts with `sk-...`)
6. **Important**: Save this key securely - you won't be able to see it again!

### Step 2: Add the API Key to Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **workshop-inventory-app** (ID: `bnyyfypaudhisookytoq`)
3. In the left sidebar, click on **Edge Functions**
4. Click on **Manage secrets** or **Secrets** button
5. Add a new secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-...`)
6. Click **Save** or **Add secret**

### Alternative: Using Supabase CLI
If you prefer using the command line:

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref bnyyfypaudhisookytoq

# Set the secret
supabase secrets set OPENAI_API_KEY=sk-your-actual-api-key-here
```

## How It Works

### The Flow:
1. **User enters a question** in the Advanced Search box
   - Example: "What would be good to use for removing drywall?"

2. **App sends request** to the `advanced-tool-search` Edge Function with:
   - The user's search query
   - The device ID (to fetch the right inventory)

3. **Edge Function processes**:
   - Fetches all tools from your inventory
   - Formats the inventory data
   - Sends to OpenAI with the prompt:
     ```
     "Using the included tool inventory help the user find the list of tools 
     and their bin locations that would address this question: [user's question]"
     ```

4. **OpenAI responds** with:
   - Relevant tools from your inventory
   - Bin names and locations
   - Explanation of why these tools are suitable

5. **App displays** the AI-generated response to the user

## Model Information
- **Model Used**: `gpt-5-mini`
- **Why this model**: Cost-effective, fast, and powerful enough for tool recommendations
- **Cost**: Approximately $0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Typical query cost**: Less than $0.01 per search

## Testing the Feature

### After adding your API key:
1. Open the app
2. Navigate to **Find Tool** screen
3. Click on **Advanced Search** tab
4. Enter a question like:
   - "What tools do I need for drywall work?"
   - "What would be good for cutting wood?"
   - "Show me all my power tools"
5. Click **Search**
6. Wait for the AI response (usually 2-5 seconds)

### Expected Response Format:
The AI will provide a conversational response like:

```
For removing drywall, I recommend the following tools from your inventory:

1. **Utility Knife** - Located in Bin A, Shelf 2
   - Perfect for scoring and cutting through drywall paper

2. **Pry Bar** - Located in Bin B, Shelf 1
   - Useful for prying drywall away from studs

3. **Hammer** - Located in Bin A, Shelf 1
   - Can be used to punch through drywall for removal

These tools will help you efficiently remove drywall. Make sure to wear safety 
glasses and a dust mask during the process!
```

## Troubleshooting

### Error: "OpenAI API key not configured"
- **Solution**: Make sure you've added the `OPENAI_API_KEY` secret to Supabase
- **Check**: The secret name must be exactly `OPENAI_API_KEY` (case-sensitive)

### Error: "Failed to get AI response"
- **Possible causes**:
  - Invalid API key
  - Insufficient OpenAI credits
  - API key doesn't have the right permissions
- **Solution**: 
  - Verify your API key is correct
  - Check your OpenAI account has available credits
  - Try generating a new API key

### No results or empty response
- **Check**: Make sure you have tools in your inventory
- **Check**: The device ID is correctly associated with your inventory items

### Slow response
- **Normal**: AI responses typically take 2-5 seconds
- **If longer**: Check your internet connection

## Security Notes

### ✅ Good Practices:
- API key is stored securely in Supabase Edge Function secrets
- API key is never exposed to the client app
- All API calls go through your Supabase Edge Function

### ⚠️ Important:
- Never commit your API key to version control
- Never share your API key publicly
- Rotate your API key if you suspect it's been compromised

## Cost Management

### Monitor Your Usage:
1. Go to [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Set up usage limits to prevent unexpected charges
3. Monitor your monthly spending

### Recommended Limits:
- **Soft limit**: $10/month (plenty for personal use)
- **Hard limit**: $20/month (safety net)

## Support

If you encounter any issues:
1. Check the Supabase Edge Function logs
2. Check the OpenAI API status page
3. Verify your API key is valid and has credits

## Summary

**You're almost done!** Just add your OpenAI API key to Supabase secrets and your Advanced Search feature will be fully functional. The feature will help you find the right tools for any job by intelligently searching through your entire workshop inventory.
