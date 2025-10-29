
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "npm:@google/genai";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is not set');
}

console.log('🚀 Edge Function initialized - analyze-tools-image');

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[${requestId}] 📥 NEW REQUEST: ${req.method} ${req.url}`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] ✅ Handling CORS preflight`);
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log(`[${requestId}] ❌ Method not allowed: ${req.method}`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    // Parse JSON body
    console.log(`[${requestId}] 📦 Parsing request body...`);
    const body = await req.json();
    console.log(`[${requestId}] ✅ Body parsed successfully`);
    console.log(`[${requestId}] Body keys: ${Object.keys(body).join(', ')}`);
    
    const { imageBase64, previousResponse, userFeedback } = body;

    if (!imageBase64) {
      console.error(`[${requestId}] ❌ Missing imageBase64 field`);
      return new Response(
        JSON.stringify({
          error: 'Missing imageBase64 in request body',
          receivedKeys: Object.keys(body),
          hint: 'Send a POST request with { "imageBase64": "your_base64_string" }',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`[${requestId}] ✅ imageBase64 received, length: ${imageBase64.length} chars`);

    // Check if this is a re-analysis request
    const isReanalysis = previousResponse && userFeedback;
    console.log(`[${requestId}] Request type: ${isReanalysis ? '🔄 RE-ANALYSIS' : '🆕 INITIAL ANALYSIS'}`);
    
    if (isReanalysis) {
      console.log(`[${requestId}] 📋 Previous response provided: ${JSON.stringify(previousResponse)}`);
      console.log(`[${requestId}] 💬 User feedback: "${userFeedback}"`);
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    console.log(`[${requestId}] ✅ Cleaned base64 data, length: ${base64Data.length} chars`);

    // Validate size (20MB limit for Gemini API)
    const sizeInMB = (base64Data.length * 0.75) / (1024 * 1024);
    const maxSize = 20;
    
    if (sizeInMB > maxSize) {
      console.error(`[${requestId}] ❌ Image too large: ${sizeInMB.toFixed(2)}MB (max: ${maxSize}MB)`);
      return new Response(
        JSON.stringify({
          error: `Image too large. Maximum ${maxSize}MB.`,
          sizeMB: sizeInMB.toFixed(2),
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`[${requestId}] 📊 Image size: ${sizeInMB.toFixed(2)}MB (within limits)`);

    if (!GEMINI_API_KEY) {
      console.error(`[${requestId}] ❌ GEMINI_API_KEY not configured`);
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: GEMINI_API_KEY not set',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Initialize Gemini AI with the new SDK
    console.log(`[${requestId}] 🤖 Initializing Gemini AI client...`);
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    });

    // Use Gemini 2.5 Flash model
    const model = 'gemini-2.5-flash';
    console.log(`[${requestId}] 🎯 Using model: ${model}`);
    
    // Prepare the prompt based on whether this is a re-analysis
    let promptText: string;
    
    if (isReanalysis) {
      // Re-analysis with context
      promptText = `You previously analyzed this image and identified these tools:
${JSON.stringify(previousResponse, null, 2)}

However, the user has provided this feedback:
"${userFeedback}"

Please re-analyze the image taking the user's feedback into account. Correct any mistakes, add any missed tools, or adjust tool names as requested. Return ONLY a JSON array of tool names, nothing else. Format: ["tool1", "tool2", "tool3"]. Be specific with tool names (e.g., "Phillips screwdriver" instead of just "screwdriver") and make sure to capture every tool in the image based on the user's feedback.`;
    } else {
      // Initial analysis
      promptText = 'Analyze this image and identify all tools visible. Return ONLY a JSON array of tool names, nothing else. Format: ["tool1", "tool2", "tool3"]. Be specific with tool names (e.g., "Phillips screwdriver" instead of just "screwdriver") and make sure to capture every tool in the image.';
    }
    
    // Prepare the request parts
    const parts = [
      {
        text: promptText,
      },
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg',
        },
      },
    ];

    // Log the complete Gemini API request payload
    console.log(`\n[${requestId}] ${'═'.repeat(70)}`);
    console.log(`[${requestId}] 🚀 GEMINI API REQUEST DETAILS`);
    console.log(`[${requestId}] ${'═'.repeat(70)}`);
    console.log(`[${requestId}] Model: ${model}`);
    console.log(`[${requestId}] Is Re-analysis: ${isReanalysis}`);
    console.log(`[${requestId}] Image Size: ${sizeInMB.toFixed(2)}MB`);
    console.log(`[${requestId}] Base64 Length: ${base64Data.length} chars`);
    console.log(`[${requestId}] ${'─'.repeat(70)}`);
    console.log(`[${requestId}] 📝 FULL PROMPT TEXT:`);
    console.log(`[${requestId}] ${'─'.repeat(70)}`);
    console.log(promptText);
    console.log(`[${requestId}] ${'─'.repeat(70)}`);
    
    if (isReanalysis) {
      console.log(`[${requestId}] 🔄 RE-ANALYSIS CONTEXT:`);
      console.log(`[${requestId}]   - Previous Response: ${JSON.stringify(previousResponse)}`);
      console.log(`[${requestId}]   - User Feedback: "${userFeedback}"`);
      console.log(`[${requestId}] ${'─'.repeat(70)}`);
    }
    
    console.log(`[${requestId}] 📦 REQUEST STRUCTURE:`);
    console.log(`[${requestId}]   - Number of parts: ${parts.length}`);
    console.log(`[${requestId}]   - Part 1 (text): ${parts[0].text.substring(0, 100)}...`);
    console.log(`[${requestId}]   - Part 2 (image): [BASE64_IMAGE_DATA_${base64Data.length}_CHARS]`);
    console.log(`[${requestId}] ${'═'.repeat(70)}\n`);

    console.log(`[${requestId}] 📤 Sending request to Gemini API...`);
    const startTime = Date.now();
    
    // Call Gemini API using the new SDK
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    });

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[${requestId}] ✅ Gemini API response received in ${duration}ms`);

    console.log(`\n[${requestId}] ${'═'.repeat(70)}`);
    console.log(`[${requestId}] 📥 GEMINI API RESPONSE`);
    console.log(`[${requestId}] ${'═'.repeat(70)}`);
    console.log(`[${requestId}] Response time: ${duration}ms`);
    console.log(`[${requestId}] ${'─'.repeat(70)}`);
    console.log(`[${requestId}] Full response structure:`);
    console.log(JSON.stringify(response, null, 2));
    console.log(`[${requestId}] ${'═'.repeat(70)}\n`);

    // Extract the text response
    const candidate = response.candidates?.[0];
    const textResponse = candidate?.content?.parts?.[0]?.text;

    if (!textResponse) {
      console.error(`[${requestId}] ❌ No text response from Gemini`);
      console.error(`[${requestId}] Full response: ${JSON.stringify(response, null, 2)}`);
      return new Response(
        JSON.stringify({
          error: 'No response from Gemini',
          rawResponse: response,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log(`[${requestId}] 📝 Text response from Gemini:`);
    console.log(`[${requestId}] ${textResponse}`);

    // Parse the JSON array from the response
    let tools: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = textResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        tools = JSON.parse(jsonMatch[0]);
        console.log(`[${requestId}] ✅ Successfully parsed JSON array: ${JSON.stringify(tools)}`);
      } else {
        console.log(`[${requestId}] ⚠️ No JSON array found in response, using fallback parsing`);
        // Fallback: split by newlines and clean up
        tools = textResponse
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0 && !line.startsWith('[') && !line.startsWith(']'))
          .map((line: string) =>
            line
              .replace(/^[\d\-\*\.\)\]]+\s*/, '')
              .replace(/^["']|["']$/g, '')
              .trim()
          )
          .filter((line: string) => line.length > 0);
        console.log(`[${requestId}] ✅ Fallback parsed tools: ${JSON.stringify(tools)}`);
      }
    } catch (parseError) {
      console.error(`[${requestId}] ❌ Error parsing tools: ${parseError}`);
      // Last resort: split by common delimiters
      tools = textResponse
        .split(/[\n,]/)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
      console.log(`[${requestId}] ✅ Last resort parsed tools: ${JSON.stringify(tools)}`);
    }

    console.log(`[${requestId}] 🎉 Successfully extracted ${tools.length} tools`);
    console.log(`[${requestId}] Tools: ${JSON.stringify(tools)}`);

    const responsePayload = {
      success: true,
      tools,
      rawResponse: textResponse,
      isReanalysis: isReanalysis,
      metadata: {
        requestId,
        toolCount: tools.length,
        imageSizeMB: sizeInMB.toFixed(2),
        model: model,
        hadPreviousResponse: !!previousResponse,
        hadUserFeedback: !!userFeedback,
        processingTimeMs: duration,
      },
    };

    console.log(`[${requestId}] 📤 Sending response to client:`);
    console.log(`[${requestId}] ${JSON.stringify(responsePayload, null, 2)}`);
    console.log(`[${requestId}] ${'='.repeat(80)}\n`);

    return new Response(
      JSON.stringify(responsePayload),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error(`[${requestId}] ❌ UNEXPECTED ERROR:`);
    console.error(`[${requestId}] Error type: ${error?.constructor?.name}`);
    console.error(`[${requestId}] Error message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`[${requestId}] Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    console.error(`[${requestId}] Full error object: ${JSON.stringify(error, null, 2)}`);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestId,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
