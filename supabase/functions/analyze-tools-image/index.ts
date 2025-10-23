
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Hardcoded Gemini API key
const GEMINI_API_KEY = 'AIzaSyBwakctmMO7kWAfGudzsfHPaku0Opzxc88';

Deno.serve(async (req) => {
  console.log('🚀 Edge Function called - analyze-tools-image');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Log all headers for debugging
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  console.log('Headers:', JSON.stringify(headers, null, 2));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight');
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    });
  }

  try {
    console.log('📥 Reading request body');
    
    // Read the raw body first
    const rawBody = await req.text();
    console.log('📦 Raw body length:', rawBody.length);
    console.log('📦 Raw body first 500 chars:', rawBody.substring(0, 500));
    console.log('📦 Raw body last 100 chars:', rawBody.substring(Math.max(0, rawBody.length - 100)));
    
    // Try to parse as JSON
    let body;
    try {
      body = JSON.parse(rawBody);
      console.log('✅ Successfully parsed JSON body');
      console.log('📊 Body keys:', Object.keys(body));
      console.log('📊 Body structure:', JSON.stringify(body, (key, value) => {
        if (key === 'imageBase64' && typeof value === 'string') {
          return `[base64 string of length ${value.length}]`;
        }
        return value;
      }, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse JSON body');
      console.error('Parse error:', parseError);
      console.error('Raw body type:', typeof rawBody);
      console.error('Raw body:', rawBody);
      
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          receivedBodyPreview: rawBody.substring(0, 500),
          receivedBodyType: typeof rawBody,
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

    // Extract imageBase64 from body
    const { imageBase64 } = body;

    if (!imageBase64) {
      console.error('❌ Missing imageBase64 in request body');
      console.error('Available keys:', Object.keys(body));
      console.error('Body sample:', JSON.stringify(body).substring(0, 1000));
      
      return new Response(
        JSON.stringify({
          error: 'Missing imageBase64 in request body',
          receivedKeys: Object.keys(body),
          bodySample: JSON.stringify(body).substring(0, 500),
          hint: 'Make sure you are sending { imageBase64: "your-base64-string" }',
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

    console.log('✅ Received imageBase64 field');
    console.log('📊 imageBase64 type:', typeof imageBase64);
    console.log('📊 imageBase64 length:', imageBase64.length);
    console.log('📊 imageBase64 first 100 chars:', imageBase64.substring(0, 100));

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    console.log('✅ Cleaned base64 data, length:', base64Data.length);

    // Validate base64 data
    if (base64Data.length < 100) {
      console.error('❌ Base64 data too short, likely invalid');
      return new Response(
        JSON.stringify({
          error: 'Invalid image data - too short',
          receivedLength: base64Data.length,
          minimumLength: 100,
          preview: base64Data.substring(0, 100),
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

    // Check if base64 is too large (Gemini has limits)
    const maxSize = 20 * 1024 * 1024; // 20MB in base64
    if (base64Data.length > maxSize) {
      console.error('❌ Base64 data too large:', base64Data.length);
      return new Response(
        JSON.stringify({
          error: 'Image too large. Please use a smaller image or reduce quality.',
          size: base64Data.length,
          maxSize: maxSize,
          sizeMB: (base64Data.length / (1024 * 1024)).toFixed(2),
          maxSizeMB: (maxSize / (1024 * 1024)).toFixed(2),
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

    console.log('✅ Base64 validation passed');
    console.log('📊 Image size:', (base64Data.length / (1024 * 1024)).toFixed(2), 'MB');

    // Call Gemini API
    console.log('🤖 Preparing Gemini API request...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: 'Analyze this image and identify all tools visible. Return ONLY a JSON array of tool names, nothing else. Format: ["tool1", "tool2", "tool3"]. Be specific with tool names (e.g., "Phillips screwdriver" instead of just "screwdriver"). If you see multiple of the same tool, list each one separately.',
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

    console.log('📤 Sending request to Gemini API');
    console.log('📦 Payload structure prepared (image data omitted from log)');
    
    let geminiResponse;
    try {
      console.log('🌐 Calling Gemini API...');
      geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiPayload),
      });
      console.log('✅ Gemini API responded');
    } catch (fetchError) {
      console.error('❌ Network error calling Gemini API');
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({
          error: 'Network error calling Gemini API',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown network error',
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('📡 Gemini API response status:', geminiResponse.status);
    console.log('📡 Gemini API response statusText:', geminiResponse.statusText);

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('❌ Gemini API error response');
      console.error('Status:', geminiResponse.status);
      console.error('Response:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Gemini API request failed',
          status: geminiResponse.status,
          statusText: geminiResponse.statusText,
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

    let geminiData;
    try {
      const responseText = await geminiResponse.text();
      console.log('📥 Gemini response text length:', responseText.length);
      console.log('📥 Gemini response preview:', responseText.substring(0, 500));
      geminiData = JSON.parse(responseText);
      console.log('✅ Gemini response parsed successfully');
    } catch (jsonError) {
      console.error('❌ Failed to parse Gemini response as JSON');
      console.error('JSON parse error:', jsonError);
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON response from Gemini',
          details: jsonError instanceof Error ? jsonError.message : 'Unknown JSON parse error',
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('📊 Gemini response structure:', JSON.stringify(geminiData, null, 2).substring(0, 1000));

    // Extract the text response
    const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      console.error('❌ No text response from Gemini');
      console.error('Full response:', JSON.stringify(geminiData));
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

    console.log('📝 Text response from Gemini:', textResponse);

    // Parse the JSON array from the response
    let tools: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = textResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        tools = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed tools from JSON:', tools);
      } else {
        console.log('⚠️ No JSON array found, using fallback parsing');
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
        console.log('✅ Parsed tools from fallback:', tools);
      }
    } catch (parseError) {
      console.error('❌ Error parsing tools:', parseError);
      // Fallback to splitting by common delimiters
      tools = textResponse
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      console.log('✅ Parsed tools from final fallback:', tools);
    }

    console.log('🎉 Returning', tools.length, 'tools');

    return new Response(
      JSON.stringify({
        success: true,
        tools,
        rawResponse: textResponse,
        metadata: {
          toolCount: tools.length,
          processingTime: Date.now(),
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
    console.error('❌ Error in analyze-tools-image function');
    console.error('Error:', error);
    console.error('Error type:', typeof error);
    console.error('Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('Error message:', error instanceof Error ? error.message : 'unknown');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
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
