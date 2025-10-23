
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = 'AIzaSyBwakctmMO7kWAfGudzsfHPaku0Opzxc88';

Deno.serve(async (req) => {
  console.log('🚀 Edge Function called - analyze-tools-image');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    });
  }

  try {
    // Parse JSON body directly
    const body = await req.json();
    console.log('📦 Body received, keys:', Object.keys(body));
    
    const { imageBase64 } = body;

    if (!imageBase64) {
      console.error('❌ Missing imageBase64');
      return new Response(
        JSON.stringify({
          error: 'Missing imageBase64 in request body',
          receivedKeys: Object.keys(body),
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

    // Validate size
    const maxSize = 20 * 1024 * 1024;
    if (base64Data.length > maxSize) {
      return new Response(
        JSON.stringify({
          error: 'Image too large. Maximum 20MB.',
          sizeMB: (base64Data.length / (1024 * 1024)).toFixed(2),
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

    // Extract the text response
    const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      console.error('❌ No text response from Gemini');
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
      } else {
        // Fallback: split by newlines and clean up
        tools = textResponse
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith('[') && !line.startsWith(']'))
          .map((line) =>
            line
              .replace(/^[\d\-\*\.\)\]]+\s*/, '')
              .replace(/^["']|["']$/g, '')
              .trim()
          )
          .filter((line) => line.length > 0);
      }
    } catch (parseError) {
      console.error('❌ Error parsing tools:', parseError);
      tools = textResponse
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    console.log('🎉 Returning', tools.length, 'tools');

    return new Response(
      JSON.stringify({
        success: true,
        tools,
        rawResponse: textResponse,
        metadata: {
          toolCount: tools.length,
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
    console.error('❌ Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
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
