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
    // Format inventory for the AI prompt
    const formattedInventory = inventory?.map((item, index)=>({
        entry: index + 1,
        bin_name: item.bin_name,
        bin_location: item.bin_location,
        tools: item.tools
      })) || [];
    // Construct the prompt for OpenAI
    const systemPrompt = `You are a helpful workshop tool assistant. Your job is to help users find tools in their workshop inventory based on their needs, and also recommend tools they don't have.

When a user asks a question:
1. First, analyze their tool inventory and recommend the most relevant tools and their locations from their existing inventory.
2. Then, recommend exactly 3 tools that would be helpful but are NOT in their current inventory.

Format your response in two sections:

SECTION 1 - Tools in Your Inventory:
- The specific tools that would be useful
- The bin name where each tool is located
- The bin location
- Brief explanation of why these tools are suitable

SECTION 2 - Recommended Tools to Purchase:
After the inventory section, add a separator line: "---"
Then list exactly 3 recommended tools that are NOT in their inventory, formatted as:
1. [Tool Name]
   - Description: [Brief description of why this tool would be helpful]
   - Amazon Search: [Create an Amazon search URL using the format: https://www.amazon.com/s?k=TOOL+NAME+SEARCH+TERMS]
   
   Format the Amazon URL by replacing spaces with + signs and making it search-friendly. For example, "circular saw" becomes "circular+saw".

Be conversational and helpful. If no suitable tools are found in inventory, still recommend 3 tools they should acquire.

CRITICAL FORMATTING RULE: You must write in plain text only. Never use asterisks (**) or any markdown formatting characters. Do not use ** for bold text. Write tool names, bin names, and bin locations in plain text without any asterisks. You can use numbered lists (1., 2., 3.) and bullet points (-) for structure, but absolutely no asterisks anywhere in your response.`;
    const userPrompt = `User Question: ${searchQuery}

Tool Inventory:
${JSON.stringify(formattedInventory, null, 2)}

Please help the user by:
1. Finding tools from their inventory that address their question
2. Recommending exactly 3 tools NOT in their inventory that would be helpful, with Amazon search links

Remember: Write your response in plain text without using asterisks (**) or any markdown formatting. Use numbered lists and bullet points for structure, but no asterisks. Include the "---" separator between the inventory section and the recommended tools section.`;
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
        max_tokens: 1000
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
    
    console.log('✅ AI response received');
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
