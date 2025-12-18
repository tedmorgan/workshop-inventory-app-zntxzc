import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🎤 Transcribe Audio - Starting');
    
    // Get the OpenAI API key from environment variables
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OPENAI_API_KEY not configured');
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { audioBase64, mimeType } = await req.json();
    
    if (!audioBase64) {
      return new Response(JSON.stringify({
        error: 'Missing audioBase64 in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📝 Audio received, size:', audioBase64.length, 'chars');
    console.log('📝 MIME type:', mimeType || 'audio/m4a');

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    // Start timing
    const startTime = performance.now();

    // Call OpenAI Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/m4a' });
    formData.append('file', audioBlob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Optional: specify language for better accuracy

    console.log('🤖 Calling OpenAI Whisper API...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: formData
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;
    console.log(`⏱️ Whisper API response time: ${responseTime.toFixed(2)}ms`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI Whisper API error:', errorData);
      return new Response(JSON.stringify({
        error: 'Failed to transcribe audio. Please try again.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const transcribedText = data.text || '';

    console.log('✅ Transcription successful:', transcribedText.substring(0, 100));

    return new Response(JSON.stringify({
      text: transcribedText,
      responseTime: responseTime
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

