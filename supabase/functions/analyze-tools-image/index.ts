
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.24.0";

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
    
    const { imageBase64, previousResponse, userFeedback, apiVersion } = body;
    
    // API Versioning for backward compatibility
    // apiVersion 1 (default): Legacy mode - no code execution, simpler prompts
    // apiVersion 2: Agentic Vision - code execution enabled for improved accuracy
    // NOTE: gemini-3.6-flash currently mishandles agentic code-execution for this
    // task (returns Python crops + empty [] instead of tool names). Force vision-only.
    const clientApiVersion = typeof apiVersion === 'number' ? apiVersion : 1;
    const modelName = 'gemini-3.6-flash';
    const useAgenticVision = clientApiVersion >= 2 && !modelName.startsWith('gemini-3.6');
    console.log(`[${requestId}] 📱 Client API Version: ${clientApiVersion} (Agentic Vision: ${useAgenticVision ? 'ENABLED' : 'DISABLED'})`);
    if (clientApiVersion >= 2 && !useAgenticVision) {
      console.log(`[${requestId}] ℹ️ Agentic Vision requested but disabled for ${modelName} (vision-only mode)`);
    }

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

    // Initialize Google Generative AI with API key
    console.log(`[${requestId}] 🔧 Initializing Google Generative AI SDK...`);
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Use Gemini 3.6 Flash (GA) for photo tool identification
    // For API v2+: Enable Agentic Vision code execution for improved accuracy
    // For API v1 (legacy): No code execution for simpler, predictable responses
    // (modelName declared above so Agentic Vision can be gated per-model)
    console.log(`[${requestId}] 🎯 Getting model: ${modelName}`);
    
    let model;
    if (useAgenticVision) {
      console.log(`[${requestId}] ⚙️ Configuration: thinking_level=low, media_resolution=ultra_high, code_execution=ENABLED`);
      model = genAI.getGenerativeModel({ 
        model: modelName,
        tools: [
          {
            codeExecution: {},
          },
        ],
      });
    } else {
      console.log(`[${requestId}] ⚙️ Configuration: thinking_level=medium, media_resolution=ultra_high, code_execution=DISABLED (legacy mode)`);
      model = genAI.getGenerativeModel({ model: modelName });
    }
    
    // Prepare the prompt based on API version and whether this is a re-analysis
    let promptText: string;
    
    if (isReanalysis) {
      if (useAgenticVision) {
        // API v2+: Re-analysis with Agentic Vision
        promptText = `You previously analyzed this image and identified these tools:
${JSON.stringify(previousResponse, null, 2)}

However, the user has provided this feedback:
"${userFeedback}"

Please re-analyze the image taking the user's feedback into account. Use code execution internally to zoom in on specific areas, annotate the image with bounding boxes or labels to track your analysis, and carefully inspect fine-grained details that may have been missed. 

IMPORTANT: Use code execution internally for analysis, but DO NOT include any code blocks, Python code, or explanations in your response. Return ONLY a valid JSON array of tool names.

Correct any mistakes, add any missed tools, or adjust tool names as requested. Return ONLY a JSON array of tool names, nothing else. Format: ["tool1", "tool2", "tool3"]. Be as specific as possible with tool names (e.g., "Phillips screwdriver" instead of just "screwdriver") and make sure to capture every tool in the image based on the user's feedback.

Your response must be ONLY the JSON array, no code blocks, no explanations, no markdown formatting.`;
      } else {
        // Vision-only re-analysis
        promptText = `You previously analyzed this image and identified these tools:
${JSON.stringify(previousResponse, null, 2)}

However, the user has provided this feedback:
"${userFeedback}"

Please re-analyze the image taking the user's feedback into account. Correct any mistakes, add any missed tools, or adjust tool names as requested.

COUNTING RULES:
- For groups of similar tools (e.g. screwdrivers on a rack), use a single entry with a count in parentheses, like "Phillips screwdrivers (8)" or "flathead screwdrivers (6)".
- Count carefully — look at the full rack/pegboard and include every visible item of that type.
- Keep clearly different tools as separate entries (e.g. respirator, spirit level, picture hanging kit).
- Include packaged kits, fasteners, brushes, levels, respirators, wire, and other workshop materials.
- Scan systematically top-to-bottom and left-to-right so nothing is skipped.

Return ONLY a JSON array of tool names, nothing else. Format: ["tool1", "tool2 (3)", "tool3"]. Be as specific as possible with tool names. Do not include furniture, walls, outlets, or the work surface itself.`;
      }
    } else {
      if (useAgenticVision) {
        // API v2+: Initial analysis with Agentic Vision
        promptText = `Analyze this image and identify all tools and materials visible. 

You have access to code execution capabilities. Use Python code INTERNALLY to:
- Zoom in on small or distant tools to inspect fine-grained details (brand names, sizes, specific features)
- Annotate the image with bounding boxes and labels to visually track which tools you've identified
- Crop specific regions to focus on individual tools for better identification
- Count items systematically to ensure nothing is missed

Be thorough and systematic. Inspect the entire image carefully, paying special attention to:
- Small tools that might be partially obscured
- Tools with text or labels that require zooming to read
- Similar-looking tools that need careful differentiation
- Tools that might be grouped together or overlapping

COUNTING RULES:
- For groups of similar tools (e.g. screwdrivers on a rack), use a single entry with a count in parentheses, like "Phillips screwdrivers (8)" or "flathead screwdrivers (6)".
- Count carefully — look at the full rack/pegboard and include every visible item of that type.
- Keep clearly different tools as separate entries.

IMPORTANT: Use code execution internally for analysis, but DO NOT include any code blocks, Python code, or explanations in your response. Return ONLY a valid JSON array of tool names.

Return ONLY a JSON array of tool names and materials, nothing else. Format: ["tool1", "tool2 (3)", "tool3"]. Be specific with tool names (e.g., "Phillips screwdriver" instead of just "screwdriver") and make sure to capture every tool and material item in the image but do not include the table or items not associated with building tools.

Your response must be ONLY the JSON array, no code blocks, no explanations, no markdown formatting.`;
      } else {
        // Vision-only (used for gemini-3.6-flash): group similar tools with counts
        promptText = `Analyze this workshop/tool image and identify every tool and material visible.

COUNTING RULES:
- For groups of similar tools (especially screwdrivers, files, clamps, etc.), return ONE entry with a quantity in parentheses, e.g. "screwdrivers (12)", "Phillips screwdrivers (8)", "flathead screwdrivers (6)".
- Count carefully across the whole image — racks and pegboards often have many of the same type.
- If tip types are clearly different, split into separate counted groups (Phillips vs flathead). If tip type is unclear, use a single "screwdrivers (N)".
- Keep unique/different items as separate single entries (respirator, spirit level, picture hanging kit, Velcro fasteners, wire spool, etc.).
- Scan systematically: top row left-to-right, then middle, then bottom racks/pegboard hooks.
- Include packaged kits, fasteners, brushes, levels, respirators, wire spools, turnbuckles, pry bars, files, bits, and other workshop materials.
- Be specific with names. Do NOT include furniture, walls, electrical outlets, notepads, or the work surface itself.

Return ONLY a JSON array of tool/material names, nothing else. Format: ["tool1", "tool2 (3)", "tool3"]. No markdown, no explanations.`;
      }
    }
    
    console.log(`\n[${requestId}] ${'═'.repeat(80)}`);
    console.log(`[${requestId}] 🚀 GEMINI API REQUEST - COMPLETE DETAILS`);
    console.log(`[${requestId}] ${'═'.repeat(80)}`);
    console.log(`[${requestId}] Model: ${modelName}`);
    console.log(`[${requestId}] Is Re-analysis: ${isReanalysis}`);
    console.log(`[${requestId}] Image Size: ${sizeInMB.toFixed(2)}MB`);
    console.log(`[${requestId}] Base64 Length: ${base64Data.length} chars`);
    console.log(`[${requestId}] API Key (first 10 chars): ${GEMINI_API_KEY.substring(0, 10)}...`);
    console.log(`[${requestId}] ${'─'.repeat(80)}`);
    console.log(`[${requestId}] 📝 COMPLETE PROMPT TEXT:`);
    console.log(`[${requestId}] ${'─'.repeat(80)}`);
    console.log(promptText);
    console.log(`[${requestId}] ${'─'.repeat(80)}`);
    
    if (isReanalysis) {
      console.log(`[${requestId}] 🔄 RE-ANALYSIS CONTEXT DETAILS:`);
      console.log(`[${requestId}]   - Previous Response: ${JSON.stringify(previousResponse, null, 2)}`);
      console.log(`[${requestId}]   - User Feedback: "${userFeedback}"`);
      console.log(`[${requestId}] ${'─'.repeat(80)}`);
    }
    
    console.log(`[${requestId}] ${'═'.repeat(80)}\n`);

    console.log(`[${requestId}] 📤 Sending request to Gemini API NOW...`);
    const startTime = Date.now();
    
    // Call Gemini API using the official SDK
    let result;
    try {
      result = await model.generateContent(
        [
          promptText,
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
        ],
        {
          generationConfig: {
            // 3.6 Flash defaults to medium; low under-thinks on multi-tool photos
            thinking_level: modelName.startsWith('gemini-3.6') ? 'medium' : 'low',
            media_resolution: 'media_resolution_ultra_high',
          },
        }
      );
    } catch (apiError) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.error(`[${requestId}] ❌ GEMINI API ERROR after ${duration}ms:`);
      console.error(`[${requestId}] Error type: ${apiError?.constructor?.name}`);
      console.error(`[${requestId}] Error message: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      console.error(`[${requestId}] Error stack: ${apiError instanceof Error ? apiError.stack : 'No stack trace'}`);
      
      let errorMessage = 'Failed to call Gemini API';
      let errorHint = 'Please try again later';
      let statusCode = 500;
      
      if (apiError instanceof Error) {
        const errorStr = apiError.message.toLowerCase();
        
        if (errorStr.includes('api key') || errorStr.includes('401') || errorStr.includes('unauthorized')) {
          errorMessage = 'Invalid or missing Gemini API key';
          errorHint = 'The GEMINI_API_KEY environment variable is not set correctly. Please contact the administrator to set it using: supabase secrets set GEMINI_API_KEY=your_key_here';
          statusCode = 401;
        } else if (errorStr.includes('403') || errorStr.includes('forbidden')) {
          errorMessage = 'API key does not have permission';
          errorHint = 'The Gemini API key does not have the required permissions. Please check the API key settings in Google AI Studio.';
          statusCode = 403;
        } else if (errorStr.includes('429') || errorStr.includes('rate limit')) {
          errorMessage = 'API rate limit exceeded';
          errorHint = 'Too many requests. Please wait a moment and try again.';
          statusCode = 429;
        } else if (errorStr.includes('400') || errorStr.includes('bad request')) {
          errorMessage = 'Bad request to Gemini API';
          errorHint = 'The request format may be incorrect. Please check the image format and size.';
          statusCode = 400;
        } else if (errorStr.includes('network')) {
          errorMessage = 'Network error';
          errorHint = 'Could not connect to Gemini API. Please check your internet connection.';
        } else if (errorStr.includes('timeout')) {
          errorMessage = 'Request timeout';
          errorHint = 'The Gemini API took too long to respond. Please try again.';
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
          status: statusCode,
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

    // Check for code execution usage (Agentic Vision)
    const response = result.response;
    const candidates = result.response.candidates || [];
    let codeExecutionUsed = false;
    let codeExecutionCount = 0;
    if (candidates.length > 0) {
      const contentParts = candidates[0].content?.parts || [];
      // Check for both executableCode (code that was generated) and codeExecutionResult (execution output)
      const codeExecutionParts = contentParts.filter((part: any) => 
        part.codeExecutionResult || part.executableCode
      );
      codeExecutionUsed = codeExecutionParts.length > 0;
      codeExecutionCount = codeExecutionParts.length;
      
      if (codeExecutionUsed) {
        console.log(`[${requestId}] 🤖 Agentic Vision: Code execution was used (${codeExecutionCount} execution(s))`);
        codeExecutionParts.forEach((part: any, index: number) => {
          if (part.executableCode) {
            console.log(`[${requestId}]   Code ${index + 1}: ${part.executableCode.code?.substring(0, 100) || 'N/A'}...`);
          }
          if (part.codeExecutionResult) {
            console.log(`[${requestId}]   Result ${index + 1}: ${part.codeExecutionResult.output ? 'Output received' : 'No output'}`);
          }
        });
      } else {
        console.log(`[${requestId}] 📸 Standard vision analysis (no code execution needed)`);
      }
    }

    // Extract the text response
    const textResponse = response.text();

    if (!textResponse) {
      console.error(`[${requestId}] ❌ No text response from Gemini`);
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
    // First, remove code blocks that might interfere with parsing
    let cleanedResponse = textResponse;
    
    // Remove code blocks (```PYTHON ... ```, ```python ... ```, etc.)
    cleanedResponse = cleanedResponse.replace(/```[\w]*\n[\s\S]*?```/g, '');
    console.log(`[${requestId}] 🧹 Removed code blocks, cleaned length: ${cleanedResponse.length} chars`);

    let tools: string[] = [];
    try {
      // Try to find all JSON arrays in the response
      const jsonArrayMatches = cleanedResponse.match(/\[[\s\S]*?\]/g);
      
      if (jsonArrayMatches && jsonArrayMatches.length > 0) {
        // Try each JSON array, starting from the last one (most likely to be the final answer)
        let parsedSuccessfully = false;
        for (let i = jsonArrayMatches.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(jsonArrayMatches[i]);
            // Validate it's an array of strings
            if (Array.isArray(parsed) && parsed.every((item: any) => typeof item === 'string')) {
              tools = parsed;
              parsedSuccessfully = true;
              console.log(`[${requestId}] ✅ Successfully parsed JSON array (match ${i + 1}/${jsonArrayMatches.length}): ${JSON.stringify(tools)}`);
              break;
            }
          } catch (e) {
            // Try next match
            continue;
          }
        }
        
        if (!parsedSuccessfully) {
          console.log(`[${requestId}] ⚠️ Found JSON arrays but none were valid string arrays, trying fallback`);
          throw new Error('No valid JSON array found');
        }
      } else {
        console.log(`[${requestId}] ⚠️ No JSON array found in response, using fallback parsing`);
        throw new Error('No JSON array found');
      }
    } catch (parseError) {
      console.error(`[${requestId}] ❌ Error parsing tools: ${parseError}`);
      // Fallback: look for quoted strings that look like tool names
      // Extract strings that are quoted and appear to be tool names
      const quotedStrings = cleanedResponse.match(/"([^"]+)"/g) || [];
      tools = quotedStrings
        .map((str: string) => str.replace(/^"|"$/g, ''))
        .filter((str: string) => {
          // Filter out common code-related strings
          const lowerStr = str.toLowerCase();
          return !lowerStr.includes('import') && 
                 !lowerStr.includes('pil.') && 
                 !lowerStr.includes('image') &&
                 !lowerStr.includes('crop') &&
                 !lowerStr.includes('box_2d') &&
                 !lowerStr.includes('label') &&
                 !lowerStr.includes('width') &&
                 !lowerStr.includes('height') &&
                 str.length > 2; // Reasonable tool name length
        });
      console.log(`[${requestId}] ✅ Fallback parsed tools: ${JSON.stringify(tools)}`);
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
        apiVersion: clientApiVersion,
        toolCount: tools.length,
        imageSizeMB: sizeInMB.toFixed(2),
        model: modelName,
        hadPreviousResponse: !!previousResponse,
        hadUserFeedback: !!userFeedback,
        processingTimeMs: duration,
        agenticVision: {
          enabled: useAgenticVision,
          codeExecutionUsed: useAgenticVision ? codeExecutionUsed : false,
          codeExecutionCount: useAgenticVision ? codeExecutionCount : 0,
        },
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
