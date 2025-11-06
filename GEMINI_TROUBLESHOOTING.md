
# Gemini API Troubleshooting Guide

## Current Error: "Edge Function returned a non-2xx status code"

Based on the logs, the Edge Function is returning a **401 Unauthorized** status code. This indicates an issue with the Gemini API key configuration.

## Root Cause

The error occurs because:
1. The `GEMINI_API_KEY` environment variable is not set in Supabase
2. The API key is invalid or expired
3. The API key doesn't have the correct permissions

## Solution Steps

### Step 1: Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the generated API key (it should start with `AIza...`)

### Step 2: Set the API Key in Supabase

You need to set the `GEMINI_API_KEY` as a secret in your Supabase project. There are two ways to do this:

#### Option A: Using Supabase CLI (Recommended)

```bash
# Set the secret directly
supabase secrets set GEMINI_API_KEY=your_actual_api_key_here

# Or use an env file
echo "GEMINI_API_KEY=your_actual_api_key_here" > .env.local
supabase secrets set --env-file .env.local
```

#### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Scroll to **Secrets** section
4. Add a new secret:
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key (starts with `AIza...`)
5. Click **Save**

### Step 3: Verify the Secret is Set

After setting the secret, you can verify it's configured by checking the Edge Function logs:

1. Go to Supabase Dashboard → **Edge Functions** → **analyze-tools-image**
2. Click on **Logs**
3. Look for the initialization message that shows: `🔑 API Key status: SET (length: XX)`

### Step 4: Redeploy the Edge Function (if needed)

If you just set the secret, you may need to redeploy the Edge Function for it to pick up the new environment variable:

```bash
# Using Supabase CLI
supabase functions deploy analyze-tools-image
```

Or use the Supabase Dashboard:
1. Go to **Edge Functions** → **analyze-tools-image**
2. Click **Deploy** or **Redeploy**

### Step 5: Test the Function

1. Open your app
2. Go to "Add Tools"
3. Take a photo or select from gallery
4. Wait for the AI analysis

If it still fails, check the Edge Function logs for more detailed error messages.

## Common Issues and Solutions

### Issue: "API key not valid"
**Solution:** Make sure you copied the entire API key from Google AI Studio. It should be a long string starting with `AIza`.

### Issue: "API key doesn't have permission"
**Solution:** 
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Check that your API key has access to the Gemini API
3. You may need to enable the Gemini API in your Google Cloud project

### Issue: "Rate limit exceeded"
**Solution:** 
- Wait a few minutes before trying again
- Consider upgrading your Gemini API quota if you're making many requests

### Issue: "Request timeout"
**Solution:**
- The image might be too large. Try using a smaller image
- Check your internet connection
- The Gemini API might be experiencing issues

## Checking Edge Function Logs

To see detailed logs from the Edge Function:

### Using Supabase Dashboard:
1. Go to your project dashboard
2. Navigate to **Edge Functions** → **analyze-tools-image**
3. Click on **Logs** tab
4. Look for error messages with the 🔑 emoji showing API key status

### Using Supabase CLI:
```bash
supabase functions logs analyze-tools-image
```

## Testing the API Key Manually

You can test if your Gemini API key works by making a direct API call:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello, Gemini!"
      }]
    }]
  }'
```

If this returns a valid response, your API key is working correctly.

## Enhanced Error Messages

The updated Edge Function now provides more detailed error messages:

- **"Invalid or missing Gemini API key"** → The API key is not set or is invalid
- **"API key does not have permission"** → The API key doesn't have access to the Gemini API
- **"API rate limit exceeded"** → Too many requests, wait and try again
- **"Request timeout"** → The API took too long to respond
- **"Network error"** → Could not connect to the Gemini API

## Need More Help?

If you're still experiencing issues:

1. Check the Edge Function logs for the exact error message
2. Verify your API key works by testing it manually (see above)
3. Make sure you're using the correct model name: `gemini-2.5-flash`
4. Check the [Gemini API documentation](https://ai.google.dev/docs) for any service updates

## Summary

The most common fix is to simply set the `GEMINI_API_KEY` environment variable in Supabase:

```bash
supabase secrets set GEMINI_API_KEY=your_actual_api_key_here
```

After setting it, the app should work correctly!
