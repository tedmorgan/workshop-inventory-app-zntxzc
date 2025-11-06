
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "npm:@google/genai";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is not set');
  console.error('❌ Please set it using: supabase secrets set GEMINI_API_KEY=your_key_here');
}

console.log('🚀 Edge Function initialized - analyze-tools-image');
console.log(`🔑 API Key status: ${GEMINI_API_KEY ? 'SET (length: ' + GEMINI_API_KEY.length + ')' : 'NOT SET'}`);

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
    // Check API key first
    if (!GEMINI_API_KEY) {
      console.error(`[${requestId}] ❌ GEMINI_API_KEY not configured`);
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: GEMINI_API_KEY not set',
          hint: 'The administrator needs to set the GEMINI_API_KEY environment variable in Supabase',
          documentation: 'Run: supabase secrets set GEMINI_API_KEY=your_key_here',
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
      console.log(`[${requestId}] 📋 Previous response provided (${Array.isArray(previousResponse) ? previousResponse.length : 0} items):`);
      console.log(`[${requestId}] ${JSON.stringify(previousResponse)}`);
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

    // Initialize Gemini AI with the new SDK
    console.log(`[${requestId}] 🤖 Initializing Gemini AI client...`);
    console.log(`[${requestId}] 🔑 Using API key (first 10 chars): ${GEMINI_API_KEY.substring(0, 10)}...`);
    
    let ai;
    try {
      ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
      });
      console.log(`[${requestId}] ✅ Gemini AI client initialized successfully`);
    } catch (initError) {
      console.error(`[${requestId}] ❌ Failed to initialize Gemini AI client:`, initError);
      return new Response(
        JSON.stringify({
          error: 'Failed to initialize Gemini AI',
          message: initError instanceof Error ? initError.message : 'Unknown error',
          hint: 'Check if the GEMINI_API_KEY is valid',
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
    console.log(`\n[${requestId}] ${'═'.repeat(80)}`);
    console.log(`[${requestId}] 🚀 GEMINI API REQUEST - COMPLETE DETAILS`);
    console.log(`[${requestId}] ${'═'.repeat(80)}`);
    console.log(`[${requestId}] Model: ${model}`);
    console.log(`[${requestId}] Is Re-analysis: ${isReanalysis}`);
    console.log(`[${requestId}] Image Size: ${sizeInMB.toFixed(2)}MB`);
    console.log(`[${requestId}] Base64 Length: ${base64Data.length} chars`);
    console.log(`[${requestId}] ${'─'.repeat(80)}`);
    console.log(`[${requestId}] 📝 COMPLETE PROMPT TEXT (FULL - NOT TRUNCATED):`);
    console.log(`[${requestId}] ${'─'.repeat(80)}`);
    console.log(promptText);
    console.log(`[${requestId}] ${'─'.repeat(80)}`);
    
    if (isReanalysis) {
      console.log(`[${requestId}] 🔄 RE-ANALYSIS CONTEXT DETAILS:`);
      console.log(`[${requestId}]   - Previous Response Type: ${typeof previousResponse}`);
      console.log(`[${requestId}]   - Previous Response Is Array: ${Array.isArray(previousResponse)}`);
      console.log(`[${requestId}]   - Previous Response Length: ${Array.isArray(previousResponse) ? previousResponse.length : 'N/A'}`);
      console.log(`[${requestId}]   - Previous Response Full Data: ${JSON.stringify(previousResponse, null, 2)}`);
      console.log(`[${requestId}]   - User Feedback Type: ${typeof userFeedback}`);
      console.log(`[${requestId}]   - User Feedback Length: ${userFeedback?.length || 0} chars`);
      console.log(`[${requestId}]   - User Feedback Full Text: "${userFeedback}"`);
      console.log(`[${requestId}] ${'─'.repeat(80)}`);
    }
    
    console.log(`[${requestId}] 📦 REQUEST STRUCTURE TO GEMINI:`);
    console.log(`[${requestId}]   - Number of parts: ${parts.length}`);
    console.log(`[${requestId}]   - Part 1 (text prompt):`);
    console.log(`[${requestId}]     Type: text`);
    console.log(`[${requestId}]     Length: ${parts[0].text.length} chars`);
    console.log(`[${requestId}]     FULL TEXT: "${parts[0].text}"`);
    console.log(`[${requestId}]   - Part 2 (image):`);
    console.log(`[${requestId}]     Type: inlineData`);
    console.log(`[${requestId}]     MIME Type: ${parts[1].inlineData.mimeType}`);
    console.log(`[${requestId}]     Data Length: ${parts[1].inlineData.data.length} chars`);
    console.log(`[${requestId}] ${'═'.repeat(80)}\n`);

    console.log(`[${requestId}] 📤 Sending request to Gemini API NOW...`);
    const startTime = Date.now();
    
    // Call Gemini API using the new SDK with enhanced error handling
    let response;
    try {
      response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
      });
    } catch (apiError) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`[${requestId}] ❌ GEMINI API ERROR after ${duration}ms:`);
      console.error(`[${requestId}] Error type: ${apiError?.constructor?.name}`);
      console.error(`[${requestId}] Error message: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      console.error(`[${requestId}] Error stack: ${apiError instanceof Error ? apiError.stack : 'No stack trace'}`);
      console.error(`[${requestId}] Full error object: ${JSON.stringify(apiError, null, 2)}`);
      
      // Check for specific error types
      let errorMessage = 'Failed to call Gemini API';
      let errorHint = 'Please try again later';
      
      if (apiError instanceof Error) {
        const errorStr = apiError.message.toLowerCase();
        
        if (errorStr.includes('401') || errorStr.includes('unauthorized') || errorStr.includes('api key')) {
          errorMessage = 'Invalid or missing Gemini API key';
          errorHint = 'The GEMINI_API_KEY environment variable is not set correctly. Please contact the administrator to set it using: supabase secrets set GEMINI_API_KEY=your_key_here';
        } else if (errorStr.includes('403') || errorStr.includes('forbidden')) {
          errorMessage = 'API key does not have permission';
          errorHint = 'The Gemini API key does not have the required permissions. Please check the API key settings in Google AI Studio.';
        } else if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('rate limit')) {
          errorMessage = 'API rate limit exceeded';
          errorHint = 'Too many requests. Please wait a moment and try again.';
        } else if (errorStr.includes('timeout')) {
          errorMessage = 'Request timeout';
          errorHint = 'The Gemini API took too long to respond. Please try again.';
        } else if (errorStr.includes('network')) {
          errorMessage = 'Network error';
          errorHint = 'Could not connect to Gemini API. Please check your internet connection.';
        }
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          hint: errorHint,
          details: apiError instanceof Error ? apiError.message : 'Unknown error',
          requestId,
          apiKeyStatus: GEMINI_API_KEY ? 'SET' : 'NOT SET',
          apiKeyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
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

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[${requestId}] ✅ Gemini API response received in ${duration}ms`);

    console.log(`\n[${requestId}] ${'═'.repeat(80)}`);
    console.log(`[${requestId}] 📥 GEMINI API RESPONSE`);
    console.log(`[${requestId}] ${'═'.repeat(80)}`);
    console.log(`[${requestId}] Response time: ${duration}ms`);
    console.log(`[${requestId}] ${'─'.repeat(80)}`);
    console.log(`[${requestId}] Full response structure:`);
    console.log(JSON.stringify(response, null, 2));
    console.log(`[${requestId}] ${'═'.repeat(80)}\n`);

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
