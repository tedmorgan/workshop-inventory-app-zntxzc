
/**
 * Simple Test Script for Gemini Integration
 * 
 * This script tests the Gemini API integration by sending a sample base64 image
 * to the Supabase Edge Function and logging the results.
 * 
 * Usage:
 * 1. Replace SAMPLE_BASE64_IMAGE with your own base64 encoded image
 * 2. Run this in your app to test the integration
 * 3. Check console logs for detailed output
 */

import { supabase } from '@integrations/supabase/client';

// Sample small base64 image (1x1 red pixel PNG)
// Replace this with your actual test image base64
const SAMPLE_BASE64_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

/**
 * Test the Gemini integration with a sample image
 */
export async function testGeminiIntegration(imageBase64?: string) {
  console.log('🧪 Starting Gemini Integration Test');
  console.log('=' .repeat(50));
  
  const testImage = imageBase64 || SAMPLE_BASE64_IMAGE;
  const startTime = Date.now();
  
  try {
    // Log test details
    console.log('📊 Test Details:');
    console.log(`  - Image size: ${testImage.length} characters`);
    console.log(`  - Image size (MB): ${((testImage.length * 0.75) / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`  - Timestamp: ${new Date().toISOString()}`);
    console.log('');
    
    // Check authentication status
    const { data: { session } } = await supabase.auth.getSession();
    console.log('🔐 Authentication Status:');
    console.log(`  - Logged in: ${session ? 'Yes' : 'No'}`);
    if (session) {
      console.log(`  - User ID: ${session.user.id}`);
    } else {
      console.log('  ⚠️  Warning: Not authenticated. Edge Function may require authentication.');
      console.log('  ℹ️  If you get a 401 error, the Edge Function has JWT verification enabled.');
      console.log('  ℹ️  Solution: Disable JWT verification in Supabase Dashboard or sign in.');
    }
    console.log('');
    
    // Call the Edge Function
    console.log('🌐 Calling Supabase Edge Function: analyze-tools-image');
    const { data, error } = await supabase.functions.invoke('analyze-tools-image', {
      body: { imageBase64: testImage },
    });
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  Request completed in ${duration}ms`);
    console.log('');
    
    // Check for errors
    if (error) {
      console.error('❌ Edge Function Error:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('');
      
      // Provide helpful error messages
      if (error.message && error.message.includes('401')) {
        console.error('💡 This is a 401 Unauthorized error.');
        console.error('   The Edge Function requires authentication (JWT verification is enabled).');
        console.error('');
        console.error('   Solutions:');
        console.error('   1. Sign in to the app before running this test');
        console.error('   2. Disable JWT verification in Supabase Dashboard:');
        console.error('      - Go to Edge Functions > analyze-tools-image > Settings');
        console.error('      - Disable "Verify JWT"');
        console.error('   3. Or manually set verify_jwt = false in config.toml and redeploy');
      } else if (error.message && error.message.includes('400')) {
        console.error('💡 This is a 400 Bad Request error.');
        console.error('   The request body may be malformed or missing required fields.');
        console.error('   Check the Edge Function logs for more details.');
      } else if (error.message && error.message.includes('500')) {
        console.error('💡 This is a 500 Internal Server Error.');
        console.error('   The Edge Function encountered an error while processing.');
        console.error('   Check the Edge Function logs for more details.');
      }
      
      return { success: false, error, duration };
    }
    
    // Log response
    console.log('✅ Response received successfully!');
    console.log('');
    console.log('📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // Parse and display tools
    if (data.tools && Array.isArray(data.tools)) {
      console.log(`🔧 Tools Identified (${data.tools.length}):`);
      data.tools.forEach((tool: string, index: number) => {
        console.log(`  ${index + 1}. ${tool}`);
      });
    } else {
      console.log('⚠️  No tools array in response');
    }
    
    // Display raw response if available
    if (data.rawResponse) {
      console.log('');
      console.log('📝 Raw Gemini Response:');
      console.log(data.rawResponse);
    }
    
    console.log('');
    console.log('=' .repeat(50));
    console.log('✅ Test completed successfully!');
    
    return { success: true, data, duration };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('');
    console.error('❌ Test Failed!');
    console.error('=' .repeat(50));
    console.error('Error details:');
    console.error(error);
    console.error('');
    console.error(`Duration: ${duration}ms`);
    
    return { success: false, error, duration };
  }
}

/**
 * Test with a custom base64 image
 * @param base64Image - Base64 encoded image string
 */
export async function testWithCustomImage(base64Image: string) {
  console.log('🖼️  Testing with custom image');
  return testGeminiIntegration(base64Image);
}

/**
 * Run multiple tests to check consistency
 * @param iterations - Number of test iterations
 * @param imageBase64 - Optional custom image
 */
export async function runMultipleTests(iterations: number = 3, imageBase64?: string) {
  console.log(`🔄 Running ${iterations} test iterations...`);
  console.log('');
  
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\n📍 Test ${i + 1}/${iterations}`);
    console.log('-'.repeat(50));
    const result = await testGeminiIntegration(imageBase64);
    results.push(result);
    
    // Wait 2 seconds between tests
    if (i < iterations - 1) {
      console.log('⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n\n📊 Test Summary');
  console.log('=' .repeat(50));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`✅ Successful: ${successful}/${iterations}`);
  console.log(`❌ Failed: ${failed}/${iterations}`);
  console.log(`⏱️  Average duration: ${avgDuration.toFixed(0)}ms`);
  console.log('');
  
  if (failed > 0) {
    console.log('⚠️  Some tests failed. Common issues:');
    console.log('   - JWT verification is enabled (401 errors)');
    console.log('   - Invalid request format (400 errors)');
    console.log('   - Edge Function errors (500 errors)');
    console.log('   - Network issues or timeouts');
    console.log('');
    console.log('💡 Check the detailed logs above for specific error messages.');
  }
  
  console.log('✅ All tests completed! Check console for detailed logs.');
  console.log('');
  
  return results;
}

// Export default test function
export default testGeminiIntegration;
