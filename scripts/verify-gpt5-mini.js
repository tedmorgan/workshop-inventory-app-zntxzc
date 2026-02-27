#!/usr/bin/env node
/**
 * Verifies that gpt-5-mini works with max_completion_tokens (not max_tokens).
 * Run: OPENAI_API_KEY=your_key node scripts/verify-gpt5-mini.js
 */
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Set OPENAI_API_KEY environment variable');
  process.exit(1);
}

async function test() {
  console.log('🧪 Testing gpt-5-mini with max_completion_tokens...');
  
  const body = {
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Reply with just: OK' }
    ],
    max_completion_tokens: 6000  // gpt-5-mini: no temperature param, no max_tokens
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.error('❌ API Error:', res.status, JSON.stringify(data, null, 2));
      process.exit(1);
    }

    const text = data.choices?.[0]?.message?.content || '';
    console.log('✅ Success! Response:', text.trim());
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
