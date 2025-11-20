import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
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

SECTION 1 - Tools in Your Inventory:
- List ALL tools from the inventory that are relevant to the user's question
- For each tool, you MUST include:
  - The tool name
  - The bin ID (CRITICAL: Copy the EXACT bin_id value from the inventory data - DO NOT generate or invent bin IDs)
  - The bin name where it is located
  - The bin location
  - Brief explanation of why this tool is suitable

CRITICAL BIN ID RULES:
1. You MUST copy the exact bin_id value from the inventory JSON data provided below
2. DO NOT generate, invent, or create new bin IDs - only use bin_ids that exist in the inventory data
3. DO NOT modify or change any characters in the bin_id - copy it exactly as shown
4. Each bin_id is a UUID format like: "b3b014b1-540e-4c65-93c4-11f03c4cd2c9"
5. If a tool is in a bin, find that bin's bin_id in the inventory data and copy it EXACTLY
6. The bin_id must match exactly - character for character - what appears in the inventory JSON

EXAMPLE:
If the inventory shows:
  {
    "bin_id": "b3b014b1-540e-4c65-93c4-11f03c4cd2c9",
    "bin_name": "2nd Drawer",
    "bin_location": "Dropsaw Cabinet",
    "tools": ["Hammer", "Screwdriver"]
  }

Then for the tool "Hammer", you MUST write:
  1. Hammer
     - Bin ID: b3b014b1-540e-4c65-93c4-11f03c4cd2c9
     - Bin Name: 2nd Drawer
     - Bin Location: Dropsaw Cabinet
     - Explanation: [why this tool is suitable]

Format each tool EXACTLY as shown above. The Bin ID must be copied exactly from the inventory data.
- Do not limit yourself to just 3 tools - include all matching tools from the inventory

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

VALID BIN IDs (these are the ONLY valid bin_ids - use ONLY these):
${binIds.slice(0, 20).map(id => `- ${id}`).join('\n')}
${binIds.length > 20 ? `... and ${binIds.length - 20} more (see full list in inventory data above)` : ''}

Please help the user by:
1. Finding ALL tools from their inventory that address their question - do not limit the number of tools, include every relevant tool from their inventory
2. For EACH tool you list, you MUST include the Bin ID field with the EXACT bin_id from the inventory data above. Use ONLY the bin_ids listed in the "VALID BIN IDs" section above.
3. Recommending exactly 3 tools NOT in their inventory that would be helpful, with Amazon search links

REMEMBER: Only use bin_ids from the "VALID BIN IDs" list above. Do not create new ones. Copy them exactly.

Write your response in plain text without using asterisks (**) or any markdown formatting. Use numbered lists and bullet points for structure, but no asterisks. Include the "---" separator between the inventory section and the recommended tools section. List ALL matching tools from the inventory, not just a few.`;
    console.log('🤖 Calling OpenAI API...');
    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
        max_tokens: 3000
      })
    });
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
    
    // Validate and fix bin IDs in the response
    const validBinIds = new Set(inventory?.map(item => item.id.toLowerCase()) || []);
    const binIdMap = new Map<string, string>(); // Map bin_name+location to bin_id
    inventory?.forEach(item => {
      const key = `${item.bin_name?.toLowerCase().trim()}|${item.bin_location?.toLowerCase().trim()}`;
      binIdMap.set(key, item.id);
    });
    
    // Extract and validate bin IDs from response
    const lines = aiResponse.split('\n');
    let fixedResponse = '';
    let invalidBinIdCount = 0;
    let fixedBinIdCount = 0;
    
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
            // Try to find correct bin ID by matching bin name and location
            let fixed = false;
            
            // Look ahead for bin name and location
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              const binNameMatch = lines[j].match(/^[-]?\s*Bin [Nn]ame:\s*(.+)$/i);
              const binLocationMatch = lines[j].match(/^[-]?\s*Bin [Ll]ocation:\s*(.+)$/i);
              
              if (binNameMatch || binLocationMatch) {
                const binName = binNameMatch ? binNameMatch[1].trim().toLowerCase() : '';
                const binLocation = binLocationMatch ? binLocationMatch[1].trim().toLowerCase() : '';
                
                // Try to find matching bin
                for (const [key, correctBinId] of binIdMap.entries()) {
                  const [name, location] = key.split('|');
                  if ((!binName || name.includes(binName) || binName.includes(name)) &&
                      (!binLocation || location.includes(binLocation) || binLocation.includes(location))) {
                    // Replace with correct bin ID (replace the entire value after "Bin ID:")
                    fixedResponse += line.replace(/Bin [Ii][Dd]:\s*.+/i, `Bin ID: ${correctBinId}`) + '\n';
                    fixedBinIdCount++;
                    fixed = true;
                    console.log(`🔧 Fixed invalid bin ID: ${binId} -> ${correctBinId} (${binNameMatch?.[1] || 'unknown'})`);
                    break;
                  }
                }
                
                if (fixed) break;
              }
            }
            
            if (!fixed) {
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
    
    if (invalidBinIdCount > 0) {
      console.warn(`⚠️ Found ${invalidBinIdCount} invalid bin IDs that could not be auto-fixed`);
    }
    if (fixedBinIdCount > 0) {
      console.log(`✅ Auto-fixed ${fixedBinIdCount} invalid bin IDs`);
    }
    
    aiResponse = fixedResponse;
    
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
