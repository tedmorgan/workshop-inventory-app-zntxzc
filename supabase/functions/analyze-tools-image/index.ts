
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    
    const { imageBase64 } = body;

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

    // Call Gemini API
    console.log('🤖 Calling Gemini API...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: 'Analyze this image and identify all tools visible. Return ONLY a JSON array of tool names, nothing else. Format: ["tool1", "tool2", "tool3"]. Be specific with tool names (e.g., "Phillips screwdriver" instead of just "screwdriver").',
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 1024,
      },
    };

    console.log('📤 Sending request to Gemini...');
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiPayload),
    });

    console.log('📡 Gemini response status:', geminiResponse.status);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('❌ Gemini API error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Gemini API request failed',
          status: geminiResponse.status,
          details: errorText,
        }),
        {
          status: geminiResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log('✅ Gemini response received');
    console.log('📝 Response structure:', JSON.stringify(geminiData, null, 2));

    // Extract the text response
    const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      console.error('❌ No text response from Gemini');
      console.error('Full response:', JSON.stringify(geminiData, null, 2));
      return new Response(
        JSON.stringify({
          error: 'No response from Gemini',
          rawResponse: geminiData,
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
        metadata: {
          toolCount: tools.length,
          imageSizeMB: sizeInMB.toFixed(2),
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
