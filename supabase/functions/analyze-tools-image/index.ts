
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI } from "npm:@google/genai";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is not set');
}

console.log('🚀 Edge Function initialized - analyze-tools-image');

Deno.serve(async (req: Request) => {
  console.log('📥 Request received:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight');
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
    console.log('❌ Method not allowed:', req.method);
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
    console.log('📦 Parsing request body...');
    const body = await req.json();
    console.log('✅ Body parsed, keys:', Object.keys(body));
    
    const { imageBase64, previousResponse, userFeedback } = body;

    if (!imageBase64) {
      console.error('❌ Missing imageBase64 field');
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

    console.log('✅ imageBase64 received, length:', imageBase64.length);

    // Check if this is a re-analysis request
    const isReanalysis = previousResponse && userFeedback;
    if (isReanalysis) {
      console.log('🔄 Re-analysis request detected');
      console.log('📝 Previous response:', JSON.stringify(previousResponse));
      console.log('💬 User feedback:', userFeedback);
    } else {
      console.log('🆕 Initial analysis request');
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    console.log('✅ Cleaned base64, length:', base64Data.length);

    // Validate size (20MB limit for Gemini API)
    const sizeInMB = (base64Data.length * 0.75) / (1024 * 1024);
    const maxSize = 20;
    
    if (sizeInMB > maxSize) {
      console.error(`❌ Image too large: ${sizeInMB.toFixed(2)}MB`);
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

    console.log(`📊 Image size: ${sizeInMB.toFixed(2)}MB`);

    if (!GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not configured');
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
    console.log('🤖 Initializing Gemini 2.5 API...');
    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    });

    // Use Gemini 2.5 Flash model
    const model = 'gemini-2.5-flash';
    
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
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 GEMINI API CALL PAYLOAD');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Model:', model);
    console.log('Is Re-analysis:', isReanalysis);
    console.log('');
    console.log('📝 PROMPT TEXT:');
    console.log('-----------------------------------------------------------');
    console.log(promptText);
    console.log('-----------------------------------------------------------');
    console.log('');
    console.log('📊 REQUEST STRUCTURE:');
    console.log('- Number of parts:', parts.length);
    console.log('- Part 1 (text):', parts[0].text.substring(0, 100) + '...');
    console.log('- Part 2 (image): base64 data, length:', base64Data.length, 'chars');
    console.log('- Image size:', sizeInMB.toFixed(2), 'MB');
    console.log('');
    if (isReanalysis) {
      console.log('🔄 RE-ANALYSIS CONTEXT:');
      console.log('- Previous Response:', JSON.stringify(previousResponse));
      console.log('- User Feedback:', userFeedback);
      console.log('');
    }
    console.log('📤 Full API Request Object:');
    console.log(JSON.stringify({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: promptText,
            },
            {
              inlineData: {
                data: '[BASE64_IMAGE_DATA_' + base64Data.length + '_CHARS]',
                mimeType: 'image/jpeg',
              },
            },
          ],
        },
      ],
    }, null, 2));
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    console.log('📤 Sending request to Gemini 2.5...');
    
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

    console.log('✅ Gemini 2.5 response received');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 GEMINI API RESPONSE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Full response structure:', JSON.stringify(response, null, 2));
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Extract the text response
    const candidate = response.candidates?.[0];
    const textResponse = candidate?.content?.parts?.[0]?.text;

    if (!textResponse) {
      console.error('❌ No text response from Gemini');
      console.error('Full response:', JSON.stringify(response, null, 2));
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

    console.log('📝 Text response:', textResponse);

    // Parse the JSON array from the response
    let tools: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = textResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        tools = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed JSON array:', tools);
      } else {
        console.log('⚠️ No JSON array found, using fallback parsing');
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
        console.log('✅ Fallback parsed tools:', tools);
      }
    } catch (parseError) {
      console.error('❌ Error parsing tools:', parseError);
      // Last resort: split by common delimiters
      tools = textResponse
        .split(/[\n,]/)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
      console.log('✅ Last resort parsed tools:', tools);
    }

    console.log('🎉 Returning', tools.length, 'tools');

    return new Response(
      JSON.stringify({
        success: true,
        tools,
        rawResponse: textResponse,
        isReanalysis: isReanalysis,
        metadata: {
          toolCount: tools.length,
          imageSizeMB: sizeInMB.toFixed(2),
          model: model,
          hadPreviousResponse: !!previousResponse,
          hadUserFeedback: !!userFeedback,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
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
