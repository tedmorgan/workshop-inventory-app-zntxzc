
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
      console.error(JSON.stringify(error, null, 2));
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
  console.log(`🔄 Running ${iterations} test iterations`);
  console.log('=' .repeat(50));
  
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    console.log(`\n📍 Test ${i + 1}/${iterations}`);
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
  
  return results;
}

// Export default test function
export default testGeminiIntegration;
