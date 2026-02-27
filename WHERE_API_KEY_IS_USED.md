
# Where Your OpenAI API Key Is Used

## 🔐 Security First

Your OpenAI API key is **never exposed to the client app**. It's stored securely in Supabase and only used server-side in the Edge Function.

## 📍 Exact Location in Code

### Supabase Edge Function: `advanced-tool-search`

The API key is accessed and used in the Edge Function at these specific lines:

```typescript
// Line ~17: Get the API key from environment variables
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

// Line ~19-28: Check if API key exists
if (!openaiApiKey) {
  console.error('❌ OPENAI_API_KEY not configured');
  return new Response(JSON.stringify({
    error: 'OpenAI API key not configured. Please add your API key to the Supabase Edge Function secrets.'
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Line ~95-115: Use the API key to call OpenAI
const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${openaiApiKey}`  // ← API key used here
  },
  body: JSON.stringify({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1000
  })
});
```

## 🔄 Complete Request Flow

### 1. Client App (app/find-tool.tsx)
```typescript
// Line ~115-125: App calls Edge Function (NO API key here)
const { data, error } = await supabase.functions.invoke('advanced-tool-search', {
  body: {
    searchQuery: advancedSearchQuery,  // User's question
    deviceId: deviceId,                // Device identifier
  },
});
// ← Notice: NO API key is sent from the app
```

### 2. Supabase Edge Function
```typescript
// Edge Function receives request
// ↓
// Gets API key from Supabase secrets (server-side only)
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
// ↓
// Fetches user's inventory from database
const { data: inventory } = await supabase
  .from('tool_inventory')
  .select('*')
  .eq('device_id', deviceId);
// ↓
// Formats inventory for AI
const formattedInventory = inventory?.map((item, index) => ({
  entry: index + 1,
  bin_name: item.bin_name,
  bin_location: item.bin_location,
  tools: item.tools
}));
// ↓
// Constructs prompt
const userPrompt = `User Question: ${searchQuery}

Tool Inventory:
${JSON.stringify(formattedInventory, null, 2)}

Please help the user find the list of tools and their bin locations 
that would address their question.`;
// ↓
// Calls OpenAI API with the API key
const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: {
    'Authorization': `Bearer ${openaiApiKey}`  // ← API key used here
  },
  body: JSON.stringify({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })
});
// ↓
// Returns AI response to app
return new Response(JSON.stringify({
  response: aiResponse,
  inventoryCount: inventory?.length || 0
}));
```

### 3. Client App Receives Response
```typescript
// Line ~127-133: App displays AI response
if (data.choices && data.choices.length > 0) {
  setAiResponse(data.choices[0].message.content);
} else {
  setAiResponse("No results found.");
}
```

## 🛡️ Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT APP                          │
│  (React Native - Runs on user's device)                    │
│                                                             │
│  ❌ NO API key stored here                                 │
│  ❌ NO API key in code                                     │
│  ❌ NO API key in environment variables                    │
│                                                             │
│  ✅ Only sends: searchQuery + deviceId                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (HTTPS Request)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTION                   │
│  (Deno Runtime - Runs on Supabase servers)                 │
│                                                             │
│  ✅ API key stored in Supabase Secrets                     │
│  ✅ API key accessed via Deno.env.get()                    │
│  ✅ API key never leaves the server                        │
│                                                             │
│  Process:                                                   │
│  1. Receive request from app                               │
│  2. Get API key from secrets                               │
│  3. Fetch inventory from database                          │
│  4. Call OpenAI API with key                               │
│  5. Return AI response to app                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (HTTPS Request)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                        OPENAI API                           │
│  (api.openai.com)                                          │
│                                                             │
│  Receives:                                                  │
│  - Authorization: Bearer sk-...                            │
│  - Model: gpt-5-mini                                        │
│  - Messages: [system prompt, user prompt with inventory]   │
│                                                             │
│  Returns:                                                   │
│  - AI-generated response                                    │
└─────────────────────────────────────────────────────────────┘
```

## 📝 What Gets Sent to OpenAI

### Request Headers:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer sk-your-api-key-here"
}
```

### Request Body:
```json
{
  "model": "gpt-5-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful workshop tool assistant..."
    },
    {
      "role": "user",
      "content": "User Question: What would be good to use for removing drywall?\n\nTool Inventory:\n[{\n  \"entry\": 1,\n  \"bin_name\": \"Bin A\",\n  \"bin_location\": \"Shelf 2\",\n  \"tools\": [\"Hammer\", \"Screwdriver\", \"Utility Knife\"]\n}, ...]"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

### Response:
```json
{
  "choices": [
    {
      "message": {
        "content": "For removing drywall, I recommend..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 450,
    "completion_tokens": 200,
    "total_tokens": 650
  }
}
```

## 🔍 How to Verify Security

### 1. Check Client Code
Open `app/find-tool.tsx` and search for "OPENAI" or "sk-":
- ❌ You won't find any API key
- ✅ You'll only find the Edge Function call

### 2. Check Edge Function
The Edge Function code shows:
```typescript
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
```
- ✅ API key comes from environment variables
- ✅ Environment variables are stored in Supabase Secrets
- ✅ Secrets are encrypted and never exposed

### 3. Network Inspection
If you inspect network traffic from the app:
- ✅ You'll see requests to Supabase Edge Function
- ❌ You won't see the OpenAI API key
- ❌ You won't see direct requests to OpenAI from the app

## 🎯 Summary

### Where API Key Is Stored:
- **Supabase Dashboard** → Edge Functions → Secrets
- Environment variable name: `OPENAI_API_KEY`
- Encrypted and secure

### Where API Key Is Used:
- **Only in the Edge Function** (server-side)
- File: `supabase/functions/advanced-tool-search/index.ts`
- Line: `const openaiApiKey = Deno.env.get('OPENAI_API_KEY');`
- Used to authenticate with OpenAI API

### Where API Key Is NOT:
- ❌ Not in the React Native app code
- ❌ Not in any client-side files
- ❌ Not in environment variables accessible to the app
- ❌ Not in version control
- ❌ Not in any logs or console output

### Why This Is Secure:
1. **Server-side only**: API key never leaves Supabase servers
2. **Encrypted storage**: Supabase Secrets are encrypted at rest
3. **No client exposure**: App never sees or handles the API key
4. **HTTPS only**: All communication is encrypted in transit
5. **Access control**: Only the Edge Function can access the secret

## 🚀 Ready to Use

Once you add your API key to Supabase Secrets, the Edge Function will:
1. Automatically retrieve it from `Deno.env.get('OPENAI_API_KEY')`
2. Use it to authenticate with OpenAI
3. Process your search requests
4. Return AI-generated responses

**No code changes needed** - just add the secret and it works! ✨
