
# Gemini Integration Troubleshooting Guide

This guide helps you debug and fix issues with the Gemini API integration for tool identification.

## Current Issue: FunctionsHttpError (401/400)

The tests are failing with `FunctionsHttpError`, which indicates the Edge Function is rejecting requests before they reach the Gemini API.

### Root Cause

The Edge Function has **JWT verification enabled** (`verify_jwt: true`), which requires authentication. However, the test script is not sending authentication tokens, causing the requests to be rejected.

## Solution: Disable JWT Verification

Since the tool identification feature doesn't require user-specific authentication, we should disable JWT verification for this Edge Function.

### Method 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click on **analyze-tools-image**
4. Look for **Settings** or **Configuration** tab
5. Find the **Verify JWT** option
6. **Disable** it (toggle off or uncheck)
7. **Save** the changes
8. Run the test again

### Method 2: Using Supabase CLI (Alternative)

If you have access to the Supabase CLI:

```bash
# Serve the function locally without JWT verification
supabase functions serve analyze-tools-image --no-verify-jwt

# Deploy with the config.toml setting
# Make sure supabase/config.toml has:
# [functions.analyze-tools-image]
# verify_jwt = false

supabase functions deploy analyze-tools-image
```

**Note:** The config.toml method has been unreliable in this project. The dashboard method is more reliable.

### Method 3: Add Authentication to Tests (Not Recommended)

If you want to keep JWT verification enabled, you would need to:

1. Sign in to the app before running tests
2. The Supabase client will automatically include the JWT token

However, this is not recommended for this use case since tool identification doesn't require user authentication.

## Understanding the Error Codes

### 401 Unauthorized
- **Cause:** JWT verification is enabled, but no valid JWT token was provided
- **Solution:** Disable JWT verification (see above)
- **Logs show:** "Unauthorized" or "Invalid JWT"

### 400 Bad Request
- **Cause:** Request body is malformed or missing required fields
- **Solution:** Check that you're sending `{ imageBase64: "..." }` in the request body
- **Logs show:** "Missing imageBase64" or "Invalid JSON"

### 500 Internal Server Error
- **Cause:** Edge Function encountered an error while processing
- **Possible reasons:**
  - Gemini API key is invalid
  - Gemini API is down or rate-limited
  - Image is too large or invalid format
- **Solution:** Check Edge Function logs in Supabase Dashboard

### 502 Bad Gateway
- **Cause:** Network error calling Gemini API
- **Solution:** Check Gemini API status and your API key

### 504 Gateway Timeout
- **Cause:** Request took too long to process
- **Solution:** Reduce image size or check Gemini API performance

## Checking Logs

### App Console Logs
Run the test and check your React Native debugger console for detailed logs:
- Request details
- Response data
- Error messages
- Timing information

### Edge Function Logs
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → **analyze-tools-image**
3. Click on **Logs** tab
4. Look for recent requests
5. Check for error messages and stack traces

### What to Look For in Logs

**Successful Request:**
```
🚀 Edge Function called - analyze-tools-image
✅ Received base64 image, length: 12345
🤖 Calling Gemini API...
📡 Gemini API response status: 200
✅ Gemini response parsed successfully
🎉 Returning 5 tools
```

**JWT Verification Error:**
```
401 Unauthorized
(No function logs - request rejected before reaching function)
```

**Missing imageBase64:**
```
❌ Missing imageBase64 in request body
Body keys: []
```

**Gemini API Error:**
```
❌ Gemini API error response: Invalid API key
```

## Testing Checklist

Before running tests, verify:

- [ ] Edge Function is deployed (version 13 or later)
- [ ] JWT verification is **disabled** in Supabase Dashboard
- [ ] Gemini API key is set correctly in the Edge Function
- [ ] Your internet connection is working
- [ ] Supabase project is active (not paused)

## Running Tests

### Simple Test
Tests with a 1x1 pixel sample image:
```typescript
import { testGeminiIntegration } from './testGemini';
await testGeminiIntegration();
```

### Test with Custom Image
Tests with your own image:
```typescript
import { testWithCustomImage } from './testGemini';
const base64Image = '...'; // Your base64 encoded image
await testWithCustomImage(base64Image);
```

### Multiple Test Iterations
Runs 3 tests to check consistency:
```typescript
import { runMultipleTests } from './testGemini';
await runMultipleTests(3);
```

## Expected Test Results

### Successful Test
```
✅ All tests completed! Check console for detailed logs.

[
  {
    "success": true,
    "data": {
      "tools": ["tool1", "tool2", "tool3"],
      "rawResponse": "..."
    },
    "duration": 1234
  }
]
```

### Failed Test (JWT Verification)
```
❌ All tests failed

[
  {
    "success": false,
    "error": {
      "name": "FunctionsHttpError",
      "message": "401 Unauthorized"
    },
    "duration": 123
  }
]
```

## Next Steps After Fixing

Once JWT verification is disabled and tests pass:

1. Test with real tool images
2. Verify the identified tools are accurate
3. Integrate into the main app workflow
4. Add error handling for production use
5. Consider adding rate limiting or usage tracking

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Edge Function Configuration](https://supabase.com/docs/guides/functions/function-configuration)

## Still Having Issues?

If you're still experiencing problems after following this guide:

1. Check the Edge Function logs in Supabase Dashboard
2. Verify your Gemini API key is valid
3. Try deploying the Edge Function again
4. Check your Supabase project status
5. Review the app console logs for detailed error messages

## Summary

**The main issue is JWT verification being enabled.** Disable it in the Supabase Dashboard, and the tests should pass. The Edge Function code is working correctly; it's just being blocked by the authentication layer.
