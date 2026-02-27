
# OpenAI API Setup Guide

This guide will help you configure your OpenAI API key for the Advanced Tool Search feature.

## Where to Add Your OpenAI API Key

Your OpenAI API key needs to be added as a **Supabase Edge Function Secret**. This keeps your API key secure and prevents it from being exposed in your app code.

### Step 1: Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy your API key (it starts with `sk-...`)

### Step 2: Add the API Key to Supabase

You have two options to add your API key:

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `bnyyfypaudhisookytoq`
3. Navigate to **Edge Functions** in the left sidebar
4. Click on **Manage secrets** or **Settings**
5. Add a new secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-...`)
6. Click **Save**

#### Option B: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-actual-api-key-here
```

### Step 3: Verify the Setup

1. Open your app
2. Navigate to **Find Tool**
3. Switch to **Advanced Search** mode
4. Try a query like: "What would be good to use for removing drywall?"
5. The AI should respond with tool recommendations from your inventory

## Important Notes

- **Security**: Never commit your API key to version control
- **Cost**: OpenAI API calls are charged per token. The Advanced Search uses GPT-4o-mini which is cost-effective
- **Model**: The function uses `gpt-5-mini` (faster output, uses max_completion_tokens)
- **Rate Limits**: Be aware of OpenAI's rate limits on your account

## Troubleshooting

### Error: "OpenAI API key not configured"

This means the `OPENAI_API_KEY` secret is not set in Supabase. Follow Step 2 above.

### Error: "Failed to get AI response"

This could mean:
- Your API key is invalid
- You've exceeded your OpenAI rate limit
- Your OpenAI account has insufficient credits

Check your OpenAI account dashboard for more details.

### The AI response is not relevant

The AI analyzes your entire tool inventory. Make sure:
- You have tools added to your inventory
- Your search query is clear and specific
- Try rephrasing your question

## Example Queries

Here are some example queries you can try:

- "What tools do I need for drywall installation?"
- "Show me all cutting tools"
- "What's in my garage bins?"
- "Tools for electrical work"
- "What do I have for woodworking?"

## API Costs

The Advanced Search feature uses OpenAI's API which has associated costs:

- **Model**: GPT-4o-mini
- **Approximate cost**: $0.00015 per request (varies based on inventory size)
- **Recommendation**: Monitor your usage in the OpenAI dashboard

## Edge Function Details

The Advanced Search is powered by a Supabase Edge Function called `advanced-tool-search`. 

**Function Location**: `supabase/functions/advanced-tool-search/index.ts`

The function:
1. Receives your search query and device ID
2. Fetches your complete tool inventory from the database
3. Formats the inventory for the AI
4. Calls OpenAI's API with a specialized prompt
5. Returns the AI's recommendations

## Need Help?

If you encounter any issues:
1. Check the Supabase Edge Function logs
2. Verify your OpenAI API key is valid
3. Ensure you have credits in your OpenAI account
4. Check that the `advanced-tool-search` Edge Function is deployed
