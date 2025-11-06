
# Gemini API Setup Guide for Tool Inventory App

## Problem Summary

Your app is showing the error: **"AI Analysis Error: Edge Function returned a non-2xx status code"**

The Supabase logs show **401 Unauthorized** errors, which means the Gemini API key is either:
- Not set in Supabase
- Set incorrectly
- Invalid or expired

## Solution: Set Up Your Gemini API Key

### Step 1: Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"** or **"Get API Key"**
4. Copy the API key (it starts with `AIza...`)
5. **Important**: Keep this key secure and never commit it to your code repository

### Step 2: Set the API Key in Supabase

You have two options to set the environment variable:

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **bnyyfypaudhisookytoq**
3. Navigate to **Settings** → **Edge Functions** (in the left sidebar)
4. Scroll down to **"Secrets"** or **"Environment Variables"**
5. Click **"Add new secret"**
6. Enter:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your actual Gemini API key (paste the key you copied)
7. Click **"Save"** or **"Add"**

#### Option B: Via Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase secrets set GEMINI_API_KEY=your_actual_api_key_here
```

Replace `your_actual_api_key_here` with your actual API key.

### Step 3: Verify the Setup

After setting the API key:

1. **Wait 30-60 seconds** for the Edge Function to restart with the new environment variable
2. **Try analyzing an image again** in your app
3. **Check the logs** in Supabase Dashboard:
   - Go to **Edge Functions** → **analyze-tools-image** → **Logs**
   - You should now see detailed logs including:
     - `🚀 Edge Function initialized - analyze-tools-image`
     - `🔑 API Key status: SET (length: XX)`
     - Request processing logs

### Step 4: Troubleshooting

If you still see errors after setting the API key:

#### Error: "Invalid API Key" or "401 Unauthorized"

**Possible causes:**
- The API key was copied incorrectly (extra spaces, missing characters)
- The API key is expired or revoked
- The API key doesn't have access to the Gemini API

**Solutions:**
1. Double-check the API key in Google AI Studio
2. Create a new API key and set it again
3. Verify the API key has the correct permissions in Google Cloud Console

#### Error: "403 Forbidden"

**Possible causes:**
- The API key doesn't have permission to use the Gemini 2.0 Flash model
- Billing is not enabled in Google Cloud

**Solutions:**
1. Enable billing in Google Cloud Console
2. Verify the API key has access to the Gemini API
3. Try using a different model (e.g., `gemini-1.5-flash`)

#### Error: "429 Rate Limit Exceeded"

**Possible causes:**
- Too many requests in a short time
- Free tier quota exceeded

**Solutions:**
1. Wait a few minutes before trying again
2. Upgrade to a paid plan in Google AI Studio
3. Implement rate limiting in your app

#### Still Not Working?

1. **Check the Edge Function logs** in Supabase Dashboard for detailed error messages
2. **Verify the API key is set correctly**:
   - The logs should show: `🔑 API Key status: SET (length: XX)`
   - If it shows `NOT SET`, the environment variable wasn't saved correctly
3. **Test the API key directly** using curl:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

Replace `YOUR_API_KEY` with your actual API key. If this returns an error, the API key itself is invalid.

## How the Edge Function Works

The Edge Function (`analyze-tools-image`) does the following:

1. **Receives an image** (as base64) from your React Native app
2. **Validates the request** (checks for API key, image size, etc.)
3. **Calls the Gemini API** with the image and a prompt
4. **Parses the response** to extract tool names
5. **Returns the results** to your app

The function includes extensive logging to help debug issues. All logs are visible in the Supabase Dashboard under **Edge Functions** → **analyze-tools-image** → **Logs**.

## API Key Security Best Practices

- ✅ **DO**: Store the API key as an environment variable in Supabase
- ✅ **DO**: Keep the API key secret and never share it publicly
- ✅ **DO**: Rotate the API key periodically
- ✅ **DO**: Monitor API usage in Google AI Studio
- ❌ **DON'T**: Commit the API key to your code repository
- ❌ **DON'T**: Hardcode the API key in your app
- ❌ **DON'T**: Share the API key in screenshots or logs

## Additional Resources

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)

## Summary

The issue is that the **GEMINI_API_KEY environment variable is not set or is invalid** in your Supabase project. Follow the steps above to:

1. Get your Gemini API key from Google AI Studio
2. Set it as a secret in Supabase Dashboard
3. Wait for the Edge Function to restart
4. Try analyzing an image again

The Edge Function has been redeployed (version 28) and is ready to use once you set the API key.
