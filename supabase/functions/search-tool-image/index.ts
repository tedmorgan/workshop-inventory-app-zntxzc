import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🖼️ Tool Image Search - Starting');
    
    // Get the Google API key from environment variables
    // Using GEMINI_API_KEY as specified by user (same key works for Google APIs)
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GEMINI_API_KEY');
    const googleCseId = Deno.env.get('GOOGLE_CSE_ID'); // Custom Search Engine ID - REQUIRED
    
    if (!googleApiKey) {
      console.error('❌ Google API key not configured');
      return new Response(JSON.stringify({
        error: 'Google API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!googleCseId) {
      console.error('❌ Google CSE ID not configured');
      return new Response(JSON.stringify({
        error: 'Google Custom Search Engine ID not configured. Please create a Custom Search Engine at https://programmablesearchengine.google.com/'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { toolName } = await req.json();
    console.log('🔍 Searching for image:', toolName);

    if (!toolName) {
      return new Response(JSON.stringify({
        error: 'Missing toolName'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Clean up tool name for search
    const searchQuery = toolName
      .toLowerCase()
      .replace(/^(drywall|woodworking|power|hand|electric)\s+/i, '')
      .replace(/\s+(tool|kit|set|bit|blade)$/i, '')
      .trim() + ' tool';

    // Call Google Custom Search API
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCseId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=1&safe=active`;
    
    console.log('📡 Calling Google Custom Search API...');
    console.log('🔑 API Key present:', !!googleApiKey);
    console.log('🆔 CSE ID present:', !!googleCseId);
    console.log('🔍 Search query:', searchQuery);
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      console.error('❌ Google API error:', errorText);
      console.error('Response status:', response.status);
      console.error('Error data:', JSON.stringify(errorData, null, 2));
      
      return new Response(JSON.stringify({
        error: 'Failed to search for images',
        details: errorData,
        status: response.status
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const imageUrl = data.items?.[0]?.link || null;

    console.log('✅ Image found:', imageUrl ? 'Yes' : 'No');

    return new Response(JSON.stringify({
      imageUrl: imageUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

