import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper function to extract complete JSON object using balanced brace matching
function extractCompleteJsonObject(text: string, startIndex: number): string {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let jsonEnd = -1;
  
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
  }
  
  if (jsonEnd === -1) {
    // JSON is incomplete - return what we have
    return text.substring(startIndex);
  }
  
  return text.substring(startIndex, jsonEnd);
}
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  // Start timing the entire function execution
  const functionStartTime = performance.now();
  
  try {
    console.log('🔍 Advanced Tool Search - Starting');
    // Get the OpenAI API key from environment variables
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured. Please add your API key to the Supabase Edge Function secrets.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse request body
    const { searchQuery, deviceId } = await req.json();
    console.log('📝 Search query:', searchQuery);
    console.log('📱 Device ID:', deviceId?.substring(0, 8) + '...');
    if (!searchQuery || !deviceId) {
      return new Response(JSON.stringify({
        error: 'Missing searchQuery or deviceId'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Fetch all tools for this device
    console.log('📦 Fetching tool inventory...');
    const { data: inventory, error: dbError } = await supabase.from('tool_inventory').select('*').eq('device_id', deviceId).order('created_at', {
      ascending: false
    });
    if (dbError) {
      console.error('❌ Database error:', dbError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch inventory'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`✅ Found ${inventory?.length || 0} inventory items`);
    // Log bin IDs for debugging
    const binIds = inventory?.map(item => item.id) || [];
    console.log(`📋 Bin IDs in inventory (first 10):`, binIds.slice(0, 10));
    
    // Format inventory for the AI prompt
    // IMPORTANT: bin_id is the first field so GPT sees it prominently
    const formattedInventory = inventory?.map((item, index)=>({
        bin_id: item.id, // CRITICAL: This is the bin ID - must be included in response
        entry: index + 1,
        bin_name: item.bin_name,
        bin_location: item.bin_location,
        tools: item.tools
      })) || [];
    // Construct the prompt for OpenAI
    const systemPrompt = `You are a helpful workshop tool assistant. Your job is to help users find tools in their workshop inventory based on their needs, and also recommend tools they don't have.

When a user asks a question:
1. First, analyze their tool inventory and list ALL relevant tools and their locations from their existing inventory. Do not limit the number of tools - include every tool that matches or could be useful for the user's question.
2. Then, recommend exactly 3 tools that would be helpful but are NOT in their current inventory.

Format your response in two sections:

SECTION 1 - Tools in Your Inventory (JSON FORMAT):
You MUST return the inventory tools in JSON format for maximum accuracy. Format as a JSON array:

{
  "inventory_tools": [
    {
      "tool_name": "Hammer",
      "bin_id": "b3b014b1-540e-4c65-93c4-11f03c4cd2c9",
      "bin_name": "2nd Drawer",
      "bin_location": "Dropsaw Cabinet",
      "explanation": "Brief explanation of why this tool is suitable"
    }
  ]
}

CRITICAL REQUIREMENTS FOR JSON:
1. The "bin_id" field MUST be copied EXACTLY from the inventory JSON data provided below
2. DO NOT generate, invent, or create new bin IDs - only use bin_ids that exist in the inventory data
3. DO NOT modify or change any characters in the bin_id - copy it exactly as shown
4. Each bin_id is a UUID format like: "b3b014b1-540e-4c65-93c4-11f03c4cd2c9"
5. If a tool is in a bin, find that bin's bin_id in the inventory data and copy it EXACTLY
6. The bin_id must match exactly - character for character - what appears in the inventory JSON
7. WARNING: Generating incorrect bin IDs will break the application - users will not be able to find their tools
8. Every bin_id you use MUST appear in the "VALID BIN IDs" list provided in the user prompt
9. Include ALL relevant tools from the inventory - do not limit to just 3 tools
10. The JSON must be valid and parseable

After the JSON, add a plain text section for readability (optional but helpful):

SECTION 2 - Recommended Tools to Purchase:
After the inventory section, add a separator line: "---"
Then list exactly 3 recommended tools that are NOT in their inventory, formatted as:
1. [Tool Name]
   - Description: [Brief description of why this tool would be helpful]
   - Amazon Search: [Create an Amazon search URL using the format: https://www.amazon.com/s?k=TOOL+NAME+SEARCH+TERMS]
   - Image URL: [Provide a direct image URL for this product. IMPORTANT: Use actual Amazon product image URLs from Amazon product pages, or manufacturer product images. Do NOT use placeholder services. The URL must be a direct link to a JPG/PNG image file that will load in a web browser. If you cannot find a real product image URL, leave this field empty.]
   
   Format the Amazon URL by replacing spaces with + signs and making it search-friendly. For example, "circular saw" becomes "circular+saw".
   For Image URL, search for the actual product on Amazon and use the product image URL from the Amazon product page. The image URL should look like: https://m.media-amazon.com/images/I/... or https://images-na.ssl-images-amazon.com/images/I/...

Be conversational and helpful. If no suitable tools are found in inventory, still recommend 3 tools they should acquire.

CRITICAL FORMATTING RULE: You must write in plain text only. Never use asterisks (**) or any markdown formatting characters. Do not use ** for bold text. Write tool names, bin names, and bin locations in plain text without any asterisks. You can use numbered lists (1., 2., 3.) and bullet points (-) for structure, but absolutely no asterisks anywhere in your response.`;
    const userPrompt = `User Question: ${searchQuery}

Tool Inventory (JSON format - each entry has a "bin_id" field that you MUST copy EXACTLY):
${JSON.stringify(formattedInventory, null, 2)}

CRITICAL INSTRUCTIONS FOR BIN IDs:
1. Look at the inventory data above - each entry has a "bin_id" field as the FIRST field
2. When you list a tool in SECTION 1, you MUST find which inventory entry contains that tool
3. Copy the EXACT "bin_id" value from that inventory entry
4. Paste it into the "Bin ID:" field - DO NOT change any characters
5. DO NOT generate, invent, or create new bin IDs - only use bin_ids from the inventory data above
6. DO NOT modify the bin_id in any way - copy it character-for-character exactly as shown

EXAMPLE:
If you want to list "Hammer" and the inventory shows:
  {
    "bin_id": "b3b014b1-540e-4c65-93c4-11f03c4cd2c9",
    "bin_name": "2nd Drawer",
    "tools": ["Hammer", "Screwdriver"]
  }
Then write: "Bin ID: b3b014b1-540e-4c65-93c4-11f03c4cd2c9" (copy exactly, no changes)

VALID BIN IDs (these are the ONLY valid bin_ids - use ONLY these - DO NOT create new ones):
${binIds.map(id => `- ${id}`).join('\n')}

IMPORTANT: The above list contains ALL valid bin_ids. You MUST use ONLY these bin_ids. If a tool is in a bin, find that bin's bin_id in this list and copy it exactly. Do not generate, invent, or create any new bin_ids.

Please help the user by:
1. Finding ALL tools from their inventory that address their question - do not limit the number of tools, include every relevant tool from their inventory
2. For EACH tool you list, you MUST include the Bin ID field with the EXACT bin_id from the inventory data above. Use ONLY the bin_ids listed in the "VALID BIN IDs" section above.
3. Recommending exactly 3 tools NOT in their inventory that would be helpful, with Amazon search links

REMEMBER: Only use bin_ids from the "VALID BIN IDs" list above. Do not create new ones. Copy them exactly.

Write your response in plain text without using asterisks (**) or any markdown formatting. Use numbered lists and bullet points for structure, but no asterisks. Include the "---" separator between the inventory section and the recommended tools section. List ALL matching tools from the inventory, not just a few.`;
    console.log('🤖 Calling OpenAI API...');
    // Start timing the API call
    const apiStartTime = performance.now();
    
    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 6000
      })
    });
    
    // Calculate and log API response time
    const apiEndTime = performance.now();
    const apiResponseTime = apiEndTime - apiStartTime;
    console.log(`⏱️ OpenAI API response time: ${apiResponseTime.toFixed(2)}ms`);
    
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('❌ OpenAI API error:', errorData);
      return new Response(JSON.stringify({
        error: 'Failed to get AI response. Please check your OpenAI API key and try again.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const openaiData = await openaiResponse.json();
    let aiResponse = openaiData.choices[0]?.message?.content || 'No response from AI';
    
    // Remove asterisks from the response as a fallback
    aiResponse = aiResponse.replace(/\*\*/g, '');
    
    // Try to parse JSON format first (more accurate)
    const validBinIds = new Set(inventory?.map(item => item.id.toLowerCase()) || []);
    let parsedFromJson = false;
    const originalResponse = aiResponse; // Preserve original in case of errors
    
    // Look for JSON in the response - improved extraction to handle truncation
    let jsonStr: string | null = null;
    
    // First try to find JSON in code blocks
    const codeBlockStart = aiResponse.indexOf('```json');
    if (codeBlockStart !== -1) {
      const jsonStartInBlock = aiResponse.indexOf('{', codeBlockStart);
      if (jsonStartInBlock !== -1) {
        jsonStr = extractCompleteJsonObject(aiResponse, jsonStartInBlock);
      }
    } else {
      // Find JSON object by locating the opening brace and using balanced matching
      const jsonStart = aiResponse.indexOf('{"inventory_tools"');
      if (jsonStart === -1) {
        // Try alternative pattern
        const altStart = aiResponse.indexOf('{\n  "inventory_tools"');
        if (altStart !== -1) {
          jsonStr = extractCompleteJsonObject(aiResponse, altStart);
        }
      } else {
        jsonStr = extractCompleteJsonObject(aiResponse, jsonStart);
      }
    }
    
    if (jsonStr) {
      try {
        // Check if JSON appears complete (ends with closing braces)
        const trimmedJson = jsonStr.trim();
        const isLikelyComplete = trimmedJson.endsWith('}') && 
                                 (trimmedJson.match(/\{/g) || []).length === (trimmedJson.match(/\}/g) || []).length;
        
        if (!isLikelyComplete) {
          console.log('⚠️ JSON appears truncated, using extraction method');
          // Don't parse yet, let the catch block handle extraction
          throw new Error('JSON appears incomplete');
        }
        
        const jsonData = JSON.parse(jsonStr);
        
        if (jsonData && jsonData.inventory_tools && Array.isArray(jsonData.inventory_tools) && jsonData.inventory_tools.length > 0) {
          console.log('📦 Found JSON format, parsing and validating...');
          
          // Validate and fix bin IDs in JSON
          const fixedTools = jsonData.inventory_tools.map((tool: any) => {
            if (!tool || typeof tool !== 'object') {
              console.warn('⚠️ Invalid tool object in JSON:', tool);
              return null;
            }
            
            const originalBinId = tool.bin_id ? String(tool.bin_id).toLowerCase().trim() : null;
            
            if (!originalBinId) {
              // Try to find bin ID by name/location
              const binName = tool.bin_name ? String(tool.bin_name).toLowerCase().trim() : '';
              const binLocation = tool.bin_location ? String(tool.bin_location).toLowerCase().trim() : '';
              
              // Find matching bin
              if (inventory && inventory.length > 0) {
                for (const item of inventory) {
                  if (!item || !item.id) continue;
                  const itemName = item.bin_name ? String(item.bin_name).toLowerCase().trim() : '';
                  const itemLocation = item.bin_location ? String(item.bin_location).toLowerCase().trim() : '';
                  
                  if ((!binName || itemName.includes(binName) || binName.includes(itemName)) &&
                      (!binLocation || itemLocation.includes(binLocation) || binLocation.includes(itemLocation))) {
                    tool.bin_id = item.id;
                    console.log(`➕ Added missing bin ID for ${tool.tool_name || 'unknown'}: ${item.id}`);
                    return tool;
                  }
                }
              }
              return tool;
            }
            
            // Validate bin ID
            if (validBinIds.has(originalBinId)) {
              return tool; // Valid, keep as is
            }
            
            // Try fuzzy matching for typos
            let bestMatch: { id: string; distance: number } | null = null;
            for (const validId of Array.from(validBinIds) as string[]) {
              let differences = 0;
              for (let k = 0; k < Math.min(originalBinId.length, validId.length); k++) {
                if (originalBinId[k] !== validId[k]) differences++;
              }
              differences += Math.abs(originalBinId.length - validId.length);
              
              if (differences <= 2 && (!bestMatch || differences < bestMatch.distance)) {
                bestMatch = { id: validId, distance: differences };
              }
            }
            
            if (bestMatch && bestMatch.distance <= 2) {
              console.log(`🔧 Fixed invalid bin ID in JSON: ${originalBinId} -> ${bestMatch.id} (${bestMatch.distance} char difference)`);
              tool.bin_id = bestMatch.id;
            } else {
              // Try to find by bin name/location
              const binName = tool.bin_name ? String(tool.bin_name).toLowerCase().trim() : '';
              const binLocation = tool.bin_location ? String(tool.bin_location).toLowerCase().trim() : '';
              
              if (inventory && inventory.length > 0) {
                for (const item of inventory) {
                  if (!item || !item.id) continue;
                  const itemName = item.bin_name ? String(item.bin_name).toLowerCase().trim() : '';
                  const itemLocation = item.bin_location ? String(item.bin_location).toLowerCase().trim() : '';
                  
                  if ((!binName || itemName.includes(binName) || binName.includes(itemName)) &&
                      (!binLocation || itemLocation.includes(binLocation) || binLocation.includes(itemLocation))) {
                    console.log(`🔧 Fixed invalid bin ID in JSON by name match: ${originalBinId} -> ${item.id}`);
                    tool.bin_id = item.id;
                    break;
                  }
                }
              }
            }
            
            return tool;
          }).filter((tool: any) => tool !== null); // Remove any null entries
          
          if (fixedTools.length === 0) {
            console.warn('⚠️ No valid tools found in JSON, falling back to text parsing');
            throw new Error('No valid tools in JSON');
          }
          
          // Convert JSON back to text format (for client compatibility)
          let textFormat = 'SECTION 1 - Tools in Your Inventory:\n\n';
          fixedTools.forEach((tool: any, index: number) => {
            if (!tool || !tool.tool_name) {
              console.warn('⚠️ Skipping invalid tool:', tool);
              return;
            }
            textFormat += `${index + 1}. ${String(tool.tool_name || 'Unknown Tool')}\n`;
            textFormat += `   - Bin ID: ${tool.bin_id || 'MISSING'}\n`;
            textFormat += `   - Bin Name: ${String(tool.bin_name || '')}\n`;
            textFormat += `   - Bin Location: ${String(tool.bin_location || '')}\n`;
            if (tool.explanation) {
              textFormat += `   - Explanation: ${String(tool.explanation)}\n`;
            }
            textFormat += '\n';
          });
          
          // Replace JSON section with text format, keep recommended tools section
          const recommendedToolsSection = aiResponse.split('---').slice(1).join('---');
          aiResponse = textFormat + (recommendedToolsSection ? '---' + recommendedToolsSection : '');
          parsedFromJson = true;
          console.log(`✅ Parsed ${fixedTools.length} tools from JSON format`);
        }
      } catch (error) {
        // JSON parsing failed - this is expected for truncated responses
        // Silently fall through to incomplete JSON extraction
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('incomplete') || errorMsg.includes('truncated')) {
          console.log('📝 JSON appears incomplete, extracting partial data...');
        } else {
          console.log('📝 JSON parse failed, attempting extraction:', errorMsg.substring(0, 100));
        }
        
        // Try to extract incomplete JSON if it was truncated
        try {
          const jsonStart = aiResponse.indexOf('{');
          if (jsonStart !== -1) {
            const jsonSection = aiResponse.substring(jsonStart);
            const tools: any[] = [];
            
            // Extract individual tool objects
            let searchIndex = 0;
            while (true) {
              const toolStart = jsonSection.indexOf('{"tool_name"', searchIndex);
              if (toolStart === -1) break;
              
              // Find matching closing brace
              let braceCount = 0;
              let inString = false;
              let escapeNext = false;
              let toolEnd = -1;
              
              for (let i = toolStart; i < jsonSection.length; i++) {
                const char = jsonSection[i];
                if (escapeNext) {
                  escapeNext = false;
                  continue;
                }
                if (char === '\\') {
                  escapeNext = true;
                  continue;
                }
                if (char === '"') {
                  inString = !inString;
                  continue;
                }
                if (!inString) {
                  if (char === '{') braceCount++;
                  if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                      toolEnd = i + 1;
                      break;
                    }
                  }
                }
              }
              
              if (toolEnd === -1) {
                // Incomplete - extract fields individually
                const partialJson = jsonSection.substring(toolStart);
                const toolNameMatch = partialJson.match(/"tool_name"\s*:\s*"([^"]+)"/);
                const binIdMatch = partialJson.match(/"bin_id"\s*:\s*"([^"]+)"/);
                const binNameMatch = partialJson.match(/"bin_name"\s*:\s*"([^"]+)"/);
                const binLocationMatch = partialJson.match(/"bin_location"\s*:\s*"([^"]+)"/);
                const explanationMatch = partialJson.match(/"explanation"\s*:\s*"([^"]*)"/);
                
                if (toolNameMatch && binIdMatch && binNameMatch && binLocationMatch) {
                  tools.push({
                    tool_name: toolNameMatch[1],
                    bin_id: binIdMatch[1],
                    bin_name: binNameMatch[1],
                    bin_location: binLocationMatch[1],
                    explanation: explanationMatch ? explanationMatch[1] : undefined
                  });
                }
                break;
              } else {
                try {
                  const toolJson = jsonSection.substring(toolStart, toolEnd);
                  const tool = JSON.parse(toolJson);
                  if (tool.tool_name && tool.bin_id) {
                    tools.push(tool);
                  }
                } catch (e) {
                  // Skip invalid tool
                }
                searchIndex = toolEnd;
              }
            }
            
            if (tools.length > 0) {
              console.log(`📦 Extracted ${tools.length} tools from incomplete JSON`);
              
              // Validate and fix bin IDs (reuse validation logic)
              const fixedTools = tools.map((tool: any) => {
                const originalBinId = tool.bin_id ? String(tool.bin_id).toLowerCase().trim() : null;
                
                if (!originalBinId) {
                  // Try to find bin ID by name/location
                  const binName = tool.bin_name ? String(tool.bin_name).toLowerCase().trim() : '';
                  const binLocation = tool.bin_location ? String(tool.bin_location).toLowerCase().trim() : '';
                  
                  if (inventory && inventory.length > 0) {
                    for (const item of inventory) {
                      if (!item || !item.id) continue;
                      const itemName = item.bin_name ? String(item.bin_name).toLowerCase().trim() : '';
                      const itemLocation = item.bin_location ? String(item.bin_location).toLowerCase().trim() : '';
                      
                      if ((!binName || itemName.includes(binName) || binName.includes(itemName)) &&
                          (!binLocation || itemLocation.includes(binLocation) || binLocation.includes(itemLocation))) {
                        tool.bin_id = item.id;
                        return tool;
                      }
                    }
                  }
                  return tool;
                }
                
                // Validate bin ID
                if (validBinIds.has(originalBinId)) {
                  return tool;
                }
                
                // Try fuzzy matching
                let bestMatch: { id: string; distance: number } | null = null;
                for (const validId of Array.from(validBinIds) as string[]) {
                  let differences = 0;
                  for (let k = 0; k < Math.min(originalBinId.length, validId.length); k++) {
                    if (originalBinId[k] !== validId[k]) differences++;
                  }
                  differences += Math.abs(originalBinId.length - validId.length);
                  
                  if (differences <= 2 && (!bestMatch || differences < bestMatch.distance)) {
                    bestMatch = { id: validId, distance: differences };
                  }
                }
                
                if (bestMatch && bestMatch.distance <= 2) {
                  if (bestMatch.distance === 1) {
                    tool.bin_id = bestMatch.id;
                    console.log(`🔧 Fixed truncated JSON bin ID: ${originalBinId} -> ${bestMatch.id}`);
                  } else {
                    // For 2-char differences, verify by name
                    const binName = tool.bin_name ? String(tool.bin_name).toLowerCase().trim() : '';
                    const binLocation = tool.bin_location ? String(tool.bin_location).toLowerCase().trim() : '';
                    
                    if (inventory && inventory.length > 0) {
                      for (const item of inventory) {
                        if (item.id.toLowerCase() === bestMatch.id) {
                          const itemName = item.bin_name ? String(item.bin_name).toLowerCase().trim() : '';
                          const itemLocation = item.bin_location ? String(item.bin_location).toLowerCase().trim() : '';
                          
                          if ((!binName || itemName.includes(binName) || binName.includes(itemName)) &&
                              (!binLocation || itemLocation.includes(binLocation) || binLocation.includes(itemLocation))) {
                            tool.bin_id = bestMatch.id;
                            console.log(`🔧 Fixed truncated JSON bin ID: ${originalBinId} -> ${bestMatch.id}`);
                            break;
                          }
                        }
                      }
                    }
                  }
                } else {
                  // Try name-based lookup
                  const binName = tool.bin_name ? String(tool.bin_name).toLowerCase().trim() : '';
                  const binLocation = tool.bin_location ? String(tool.bin_location).toLowerCase().trim() : '';
                  
                  if (inventory && inventory.length > 0) {
                    for (const item of inventory) {
                      if (!item || !item.id) continue;
                      const itemName = item.bin_name ? String(item.bin_name).toLowerCase().trim() : '';
                      const itemLocation = item.bin_location ? String(item.bin_location).toLowerCase().trim() : '';
                      
                      if ((!binName || itemName.includes(binName) || binName.includes(itemName)) &&
                          (!binLocation || itemLocation.includes(binLocation) || binLocation.includes(itemLocation))) {
                        tool.bin_id = item.id;
                        console.log(`🔧 Fixed truncated JSON bin ID by name: ${originalBinId} -> ${item.id}`);
                        break;
                      }
                    }
                  }
                }
                
                return tool;
              });
              
              // Convert to text format
              let textFormat = 'SECTION 1 - Tools in Your Inventory:\n\n';
              fixedTools.forEach((tool: any, index: number) => {
                if (!tool || !tool.tool_name) return;
                textFormat += `${index + 1}. ${String(tool.tool_name || 'Unknown Tool')}\n`;
                textFormat += `   - Bin ID: ${tool.bin_id || 'MISSING'}\n`;
                textFormat += `   - Bin Name: ${String(tool.bin_name || '')}\n`;
                textFormat += `   - Bin Location: ${String(tool.bin_location || '')}\n`;
                if (tool.explanation) {
                  textFormat += `   - Explanation: ${String(tool.explanation)}\n`;
                }
                textFormat += '\n';
              });
              
              // Replace JSON section
              const recommendedToolsSection = aiResponse.split('---').slice(1).join('---');
              aiResponse = textFormat + (recommendedToolsSection ? '---' + recommendedToolsSection : '');
              parsedFromJson = true;
              console.log(`✅ Converted incomplete JSON to text format`);
            }
          }
        } catch (extractError) {
          console.warn('⚠️ Failed to extract incomplete JSON, falling back to text parsing:', extractError);
        }
        
        // Restore original response if we didn't successfully extract
        if (!parsedFromJson) {
          aiResponse = originalResponse;
        }
      }
    }
    
    // Initialize counters (used for both JSON and text parsing)
    let invalidBinIdCount = 0;
    let fixedBinIdCount = 0;
    let addedBinIdCount = 0;
    
    // If JSON parsing didn't work, use text-based validation
    if (!parsedFromJson) {
      console.log('📝 Using text-based parsing (no JSON found)');
      
      // Validate and fix bin IDs in the response (text-based fallback)
      // Create multiple lookup maps for better matching
      const binIdMap = new Map<string, string>(); // Map bin_name+location to bin_id
      const binNameMap = new Map<string, string>(); // Map bin_name to bin_id (for partial matches)
      const toolToBinMap = new Map<string, string>(); // Map tool name to bin_id
      
      inventory?.forEach(item => {
      const key = `${item.bin_name?.toLowerCase().trim()}|${item.bin_location?.toLowerCase().trim()}`;
      binIdMap.set(key, item.id);
      
      // Also map just bin name (for partial matching)
      const binNameKey = item.bin_name?.toLowerCase().trim() || '';
      if (binNameKey && !binNameMap.has(binNameKey)) {
        binNameMap.set(binNameKey, item.id);
      }
      
      // Map each tool to its bin ID
      item.tools?.forEach((tool: string) => {
        const toolKey = tool.toLowerCase().trim();
        toolToBinMap.set(toolKey, item.id);
      });
    });
    
      // Extract and validate bin IDs from response
      const lines = aiResponse.split('\n');
      let fixedResponse = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const binIdMatch = line.match(/^[-]?\s*Bin [Ii][Dd]:\s*(.+)$/i);
      
      if (binIdMatch) {
        const rawBinId = binIdMatch[1].trim();
        const uuidMatch = rawBinId.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        
        if (uuidMatch) {
          const binId = uuidMatch[1].toLowerCase();
          
          // Check if bin ID is valid
          if (validBinIds.has(binId)) {
            fixedResponse += line + '\n';
          } else {
            // Try multiple strategies to find correct bin ID
            let fixed = false;
            let correctBinId: string | null = null;
            let fixMethod = '';
            
            // Strategy 1: Look ahead for bin name and location (exact match)
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              const binNameMatch = lines[j].match(/^[-]?\s*Bin [Nn]ame:\s*(.+)$/i);
              const binLocationMatch = lines[j].match(/^[-]?\s*Bin [Ll]ocation:\s*(.+)$/i);
              
              if (binNameMatch || binLocationMatch) {
                const binName = binNameMatch ? binNameMatch[1].trim().toLowerCase() : '';
                const binLocation = binLocationMatch ? binLocationMatch[1].trim().toLowerCase() : '';
                
                // Try exact match first
                const exactKey = `${binName}|${binLocation}`;
                if (binIdMap.has(exactKey)) {
                  correctBinId = binIdMap.get(exactKey)!;
                  fixMethod = `exact match (${binNameMatch?.[1] || 'unknown'})`;
                  break;
                }
                
                // Try partial matches
                for (const [key, id] of binIdMap.entries()) {
                  const [name, location] = key.split('|');
                  if ((!binName || name.includes(binName) || binName.includes(name)) &&
                      (!binLocation || location.includes(binLocation) || binLocation.includes(location))) {
                    correctBinId = id;
                    fixMethod = `partial match (${binNameMatch?.[1] || 'unknown'})`;
                    break;
                  }
                }
                
                // Strategy 2: Try bin name only (if location doesn't match)
                if (!correctBinId && binName) {
                  // Try exact bin name match
                  if (binNameMap.has(binName)) {
                    correctBinId = binNameMap.get(binName)!;
                    fixMethod = `bin name match (${binNameMatch?.[1]})`;
                  } else {
                    // Try partial bin name match
                    for (const [name, id] of binNameMap.entries()) {
                      if (name.includes(binName) || binName.includes(name)) {
                        correctBinId = id;
                        fixMethod = `partial bin name match (${binNameMatch?.[1]})`;
                        break;
                      }
                    }
                  }
                }
                
                if (correctBinId) break;
              }
            }
            
            // Strategy 3: Look back for tool name and match to bin
            if (!correctBinId) {
              for (let j = Math.max(0, i - 10); j < i; j++) {
                const toolMatch = lines[j].match(/^\s*(\d+)\.\s*(.+)$/);
                if (toolMatch) {
                  const toolName = toolMatch[2].trim().toLowerCase();
                  // Try exact tool name match
                  if (toolToBinMap.has(toolName)) {
                    correctBinId = toolToBinMap.get(toolName)!;
                    fixMethod = `tool name match (${toolMatch[2]})`;
                    break;
                  }
                  // Try partial tool name match
                  for (const [tool, id] of toolToBinMap.entries()) {
                    if (tool.includes(toolName) || toolName.includes(tool)) {
                      correctBinId = id;
                      fixMethod = `partial tool name match (${toolMatch[2]})`;
                      break;
                    }
                  }
                  if (correctBinId) break;
                }
              }
            }
            
            // Strategy 4: If we have bin name from context, try fuzzy matching
            if (!correctBinId) {
              // Look for any bin name mentioned nearby
              for (let j = Math.max(0, i - 5); j < Math.min(i + 10, lines.length); j++) {
                const binNameMatch = lines[j].match(/^[-]?\s*Bin [Nn]ame:\s*(.+)$/i);
                if (binNameMatch) {
                  const binName = binNameMatch[1].trim().toLowerCase();
                  // Try all matching strategies again with this bin name
                  if (binNameMap.has(binName)) {
                    correctBinId = binNameMap.get(binName)!;
                    fixMethod = `fuzzy bin name match (${binNameMatch[1]})`;
                    break;
                  }
                }
              }
            }
            
            // Strategy 5: Fuzzy UUID matching - catch single-character typos
            // Always run this as final fallback to catch typos
            if (!correctBinId) {
              // Calculate edit distance (Levenshtein-like) for UUIDs
              // For UUIDs, we'll check if they differ by only 1-2 characters
              const invalidId = binId;
              let bestMatch: { id: string; distance: number } | null = null;
              
              // Convert Set to Array for iteration
              const validBinIdsArray = Array.from(validBinIds) as string[];
              
              for (const validId of validBinIdsArray) {
                // Count character differences
                let differences = 0;
                for (let k = 0; k < Math.min(invalidId.length, validId.length); k++) {
                  if (invalidId[k] !== validId[k]) {
                    differences++;
                  }
                }
                differences += Math.abs(invalidId.length - validId.length);
                
                // If very close (1-2 character difference), it's likely a typo
                if (differences <= 2 && (!bestMatch || differences < bestMatch.distance)) {
                  bestMatch = { id: validId, distance: differences };
                }
              }
              
              // Apply fuzzy match if found
              if (bestMatch && bestMatch.distance <= 2) {
                // For 1-character differences, auto-fix immediately (very likely a typo)
                if (bestMatch.distance === 1) {
                  correctBinId = bestMatch.id;
                  fixMethod = `fuzzy UUID match (1 char typo: ${binId.substring(0, 8)}... -> ${bestMatch.id.substring(0, 8)}...)`;
                } else if (bestMatch.distance === 2) {
                  // For 2-character differences, verify bin name matches
                  let binNameMatches = false;
                  let contextBinName = '';
                  
                  for (let j = Math.max(0, i - 5); j < Math.min(i + 10, lines.length); j++) {
                    const binNameMatch = lines[j].match(/^[-]?\s*Bin [Nn]ame:\s*(.+)$/i);
                    if (binNameMatch) {
                      contextBinName = binNameMatch[1].trim().toLowerCase();
                      // Find which bin this ID belongs to
                      for (const [name, id] of binNameMap.entries()) {
                        if (id.toLowerCase() === bestMatch.id) {
                          // Check if names are similar (lenient for 2-char differences)
                          if (name.includes(contextBinName) || contextBinName.includes(name) || 
                              name === contextBinName || 
                              Math.abs(name.length - contextBinName.length) <= 5) {
                            binNameMatches = true;
                            break;
                          }
                        }
                      }
                      if (binNameMatches) break;
                    }
                  }
                  
                  if (binNameMatches) {
                    correctBinId = bestMatch.id;
                    fixMethod = `fuzzy UUID match (2 char difference, bin: ${contextBinName})`;
                  }
                }
              }
            }
            
            if (correctBinId) {
              fixedResponse += line.replace(/Bin [Ii][Dd]:\s*.+/i, `Bin ID: ${correctBinId}`) + '\n';
              fixedBinIdCount++;
              fixed = true;
              console.log(`🔧 Fixed invalid bin ID: ${binId} -> ${correctBinId} via ${fixMethod}`);
            } else {
              invalidBinIdCount++;
              console.warn(`⚠️ Invalid bin ID found but could not fix: ${binId}`);
              fixedResponse += line + '\n'; // Keep original (will be handled by client-side fallback)
            }
          }
        } else {
          fixedResponse += line + '\n';
        }
      } else {
        fixedResponse += line + '\n';
      }
    }
    
      // Second pass: Add missing bin IDs for tools that have bin names but no bin IDs
      const lines2 = fixedResponse.split('\n');
      let finalResponse = '';
      let currentToolHasBinId = false;
    let currentBinName = '';
    let currentBinLocation = '';
    
    for (let i = 0; i < lines2.length; i++) {
      const line = lines2[i];
      
      // Check if this is a tool name (numbered list)
      const toolMatch = line.match(/^\s*(\d+)\.\s*(.+)$/);
      if (toolMatch) {
        // Reset state for new tool
        currentToolHasBinId = false;
        currentBinName = '';
        currentBinLocation = '';
        finalResponse += line + '\n';
        continue;
      }
      
      // Check for bin ID
      const binIdMatch = line.match(/^[-]?\s*Bin [Ii][Dd]:\s*(.+)$/i);
      if (binIdMatch) {
        currentToolHasBinId = true;
        finalResponse += line + '\n';
        continue;
      }
      
      // Check for bin name
      const binNameMatch = line.match(/^[-]?\s*Bin [Nn]ame:\s*(.+)$/i);
      if (binNameMatch) {
        currentBinName = binNameMatch[1].trim().toLowerCase();
        finalResponse += line + '\n';
        
        // If we don't have a bin ID yet, check if we should add one
        if (!currentToolHasBinId) {
          // Look ahead to see if bin ID comes next
          let hasBinIdAhead = false;
          for (let j = i + 1; j < Math.min(i + 5, lines2.length); j++) {
            if (lines2[j].match(/^[-]?\s*Bin [Ii][Dd]:/i)) {
              hasBinIdAhead = true;
              break;
            }
            // Stop if we hit next tool or section
            if (lines2[j].match(/^\s*\d+\./) || lines2[j].trim() === '---') break;
          }
          
          // If no bin ID ahead, add one based on bin name
          if (!hasBinIdAhead && currentBinName) {
            let binIdToAdd: string | null = null;
            
            // Try to find bin ID by name
            if (binNameMap.has(currentBinName)) {
              binIdToAdd = binNameMap.get(currentBinName)!;
            } else {
              // Try partial match
              for (const [name, id] of binNameMap.entries()) {
                if (name.includes(currentBinName) || currentBinName.includes(name)) {
                  binIdToAdd = id;
                  break;
                }
              }
            }
            
            if (binIdToAdd) {
              finalResponse += `  - Bin ID: ${binIdToAdd}\n`;
              addedBinIdCount++;
              currentToolHasBinId = true;
              console.log(`➕ Added missing bin ID: ${binIdToAdd} for bin "${binNameMatch[1]}"`);
            }
          }
        }
        continue;
      }
      
      // Check for bin location
      const binLocationMatch = line.match(/^[-]?\s*Bin [Ll]ocation:\s*(.+)$/i);
      if (binLocationMatch) {
        currentBinLocation = binLocationMatch[1].trim().toLowerCase();
        finalResponse += line + '\n';
        continue;
      }
      
      finalResponse += line + '\n';
    }
    
      if (invalidBinIdCount > 0) {
        console.warn(`⚠️ Found ${invalidBinIdCount} invalid bin IDs that could not be auto-fixed`);
      }
      if (fixedBinIdCount > 0) {
        console.log(`✅ Auto-fixed ${fixedBinIdCount} invalid bin IDs`);
      }
      if (addedBinIdCount > 0) {
        console.log(`➕ Added ${addedBinIdCount} missing bin IDs`);
      }
      
      aiResponse = finalResponse;
    } // End of text-based validation (if JSON parsing failed)
    
    // Calculate and log total function execution time
    const functionEndTime = performance.now();
    const totalResponseTime = functionEndTime - functionStartTime;
    console.log(`⏱️ Total function execution time: ${totalResponseTime.toFixed(2)}ms`);
    console.log('✅ AI response received and validated');
    
    return new Response(JSON.stringify({
      response: aiResponse,
      inventoryCount: inventory?.length || 0
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
