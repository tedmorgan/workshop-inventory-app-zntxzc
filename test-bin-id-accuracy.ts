#!/usr/bin/env ts-node

/**
 * Test script to validate GPT bin ID accuracy
 * 
 * This script:
 * 1. Fetches the user's inventory from Supabase
 * 2. Makes 30 different queries to the advanced-tool-search Edge Function
 * 3. Parses the AI responses to extract bin IDs
 * 4. Validates that the bin IDs exist in the actual inventory
 * 5. Reports statistics on accuracy
 * 
 * Usage:
 *   ts-node test-bin-id-accuracy.ts [deviceId]
 * 
 * Or set DEVICE_ID environment variable:
 *   DEVICE_ID=your-device-id ts-node test-bin-id-accuracy.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnyyfypaudhisookytoq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJueXlmeXBhdWRoaXNvb2t5dG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjgzMzYsImV4cCI6MjA3NjgwNDMzNn0.hVohhc8A5JppFVXC2ztZtj1sxmio34q5VYB6XG1N4cw';

// Test queries - diverse set of tool-related questions
const TEST_QUERIES = [
  'I need to install a ceiling fan',
  'What tools can help me remove old paint?',
  'I want to build a bookshelf',
  'What do I have for working with PVC pipes?',
  'Tools for hanging pictures on the wall',
  'I need to sharpen a blade',
  'What can I use to join two pieces of metal?',
  'Tools for working with sheetrock',
  'I need to clean up after a project',
  'What do I have for marking measurements?',
  'Tools for working with wire and cables',
  'I need to apply adhesive or glue',
  'What can I use to break apart concrete?',
  'Tools for installing flooring',
  'I need to clamp something together',
  'What do I have for working with screws and bolts?',
  'Tools for smoothing rough edges',
  'I need to create a straight line',
  'What can I use to remove old caulk?',
  'Tools for working with wood joints',
  'I need to protect my hands while working',
  'What do I have for applying sealant?',
  'Tools for cutting through thick materials',
  'I need to level something perfectly',
  'What can I use to polish a surface?',
  'Tools for working with electrical connections',
  'I need to remove old grout',
  'What do I have for mixing compounds?',
  'Tools for precision cutting',
  'I need to secure something to a wall',
];

interface ToolItem {
  id: string;
  bin_name: string;
  bin_location: string;
  tools: string[];
}

interface ParsedTool {
  name: string;
  binId: string | null;
  binName: string;
  binLocation: string;
}

interface TestResult {
  query: string;
  success: boolean;
  totalTools: number;
  toolsWithValidBinIds: number;
  toolsWithInvalidBinIds: number;
  toolsWithoutBinIds: number;
  invalidBinIds: string[];
  missingBinIds: string[];
}

/**
 * Parse bin IDs from AI response text
 */
function parseBinIds(responseText: string): ParsedTool[] {
  const tools: ParsedTool[] = [];
  const lines = responseText.split('\n');
  let currentTool: Partial<ParsedTool> | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for tool name (numbered list)
    const toolMatch = trimmed.match(/^(\d+)\.\s*(.+)$/);
    if (toolMatch) {
      if (currentTool && currentTool.binName) {
        tools.push(currentTool as ParsedTool);
      }
      currentTool = {
        name: toolMatch[2].trim(),
        binId: null,
        binName: '',
        binLocation: '',
      };
      continue;
    }
    
    if (!currentTool) continue;
    
    // Check for bin ID
    const binIdMatch = trimmed.match(/^[-]?\s*Bin [Ii][Dd]:\s*(.+)$/i);
    if (binIdMatch) {
      const rawBinId = binIdMatch[1].trim();
      const uuidMatch = rawBinId.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uuidMatch) {
        currentTool.binId = uuidMatch[1].toLowerCase();
      }
      continue;
    }
    
    // Check for bin name
    const binNameMatch = trimmed.match(/^[-]?\s*Bin [Nn]ame:\s*(.+)$/i);
    if (binNameMatch) {
      currentTool.binName = binNameMatch[1].trim();
      continue;
    }
    
    // Check for bin location
    const binLocationMatch = trimmed.match(/^[-]?\s*Bin [Ll]ocation:\s*(.+)$/i);
    if (binLocationMatch) {
      currentTool.binLocation = binLocationMatch[1].trim();
      continue;
    }
  }
  
  // Add last tool if exists
  if (currentTool && currentTool.binName) {
    tools.push(currentTool as ParsedTool);
  }
  
  return tools;
}

/**
 * Call the advanced-tool-search Edge Function
 */
async function callAdvancedSearch(
  supabase: any,
  deviceId: string,
  query: string
): Promise<string> {
  const functionUrl = `${SUPABASE_URL}/functions/v1/advanced-tool-search`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      searchQuery: query,
      deviceId: deviceId,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Edge Function error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.response || '';
}

/**
 * Run a single test query
 */
async function runTest(
  supabase: any,
  deviceId: string,
  inventory: ToolItem[],
  query: string,
  index: number
): Promise<TestResult> {
  console.log(`\n[${index + 1}/30] Testing: "${query}"`);
  
  try {
    const responseText = await callAdvancedSearch(supabase, deviceId, query);
    const parsedTools = parseBinIds(responseText);
    
    const validBinIds = new Set(inventory.map(item => item.id.toLowerCase()));
    
    let toolsWithValidBinIds = 0;
    let toolsWithInvalidBinIds = 0;
    let toolsWithoutBinIds = 0;
    const invalidBinIds: string[] = [];
    const missingBinIds: string[] = [];
    
    for (const tool of parsedTools) {
      if (!tool.binId) {
        toolsWithoutBinIds++;
        continue;
      }
      
      if (validBinIds.has(tool.binId.toLowerCase())) {
        toolsWithValidBinIds++;
      } else {
        toolsWithInvalidBinIds++;
        invalidBinIds.push(tool.binId);
        missingBinIds.push(`${tool.name} -> ${tool.binId} (${tool.binName})`);
      }
    }
    
    const success = toolsWithInvalidBinIds === 0 && toolsWithoutBinIds === 0;
    
    return {
      query,
      success,
      totalTools: parsedTools.length,
      toolsWithValidBinIds,
      toolsWithInvalidBinIds,
      toolsWithoutBinIds,
      invalidBinIds,
      missingBinIds,
    };
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    return {
      query,
      success: false,
      totalTools: 0,
      toolsWithValidBinIds: 0,
      toolsWithInvalidBinIds: 0,
      toolsWithoutBinIds: 0,
      invalidBinIds: [],
      missingBinIds: [],
    };
  }
}

/**
 * Main test function
 */
async function main() {
  const deviceId = process.argv[2] || process.env.DEVICE_ID;
  
  if (!deviceId) {
    console.error('❌ Error: Device ID required');
    console.error('Usage: ts-node test-bin-id-accuracy.ts <deviceId>');
    console.error('   or: DEVICE_ID=<deviceId> ts-node test-bin-id-accuracy.ts');
    process.exit(1);
  }
  
  console.log('🚀 Starting Bin ID Accuracy Test');
  console.log(`📱 Device ID: ${deviceId.substring(0, 8)}...`);
  console.log(`📊 Testing ${TEST_QUERIES.length} queries\n`);
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Fetch inventory
  console.log('📦 Fetching inventory...');
  const { data: inventory, error } = await supabase
    .from('tool_inventory')
    .select('id, bin_name, bin_location, tools')
    .eq('device_id', deviceId);
  
  if (error) {
    console.error('❌ Error fetching inventory:', error);
    process.exit(1);
  }
  
  if (!inventory || inventory.length === 0) {
    console.error('❌ No inventory found for this device');
    process.exit(1);
  }
  
  console.log(`✅ Found ${inventory.length} inventory items`);
  console.log(`📋 Bin IDs in inventory: ${inventory.map(i => i.id).slice(0, 5).join(', ')}...\n`);
  
  // Run tests
  const results: TestResult[] = [];
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const result = await runTest(supabase, deviceId, inventory, TEST_QUERIES[i], i);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Calculate statistics
  const totalQueries = results.length;
  const successfulQueries = results.filter(r => r.success).length;
  const totalTools = results.reduce((sum, r) => sum + r.totalTools, 0);
  const totalValidBinIds = results.reduce((sum, r) => sum + r.toolsWithValidBinIds, 0);
  const totalInvalidBinIds = results.reduce((sum, r) => sum + r.toolsWithInvalidBinIds, 0);
  const totalMissingBinIds = results.reduce((sum, r) => sum + r.toolsWithoutBinIds, 0);
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Queries: ${totalQueries}`);
  console.log(`Successful Queries (100% valid bin IDs): ${successfulQueries} (${(successfulQueries / totalQueries * 100).toFixed(1)}%)`);
  console.log(`Failed Queries: ${totalQueries - successfulQueries} (${((totalQueries - successfulQueries) / totalQueries * 100).toFixed(1)}%)`);
  console.log(`\nTotal Tools Parsed: ${totalTools}`);
  console.log(`Tools with Valid Bin IDs: ${totalValidBinIds} (${totalTools > 0 ? (totalValidBinIds / totalTools * 100).toFixed(1) : 0}%)`);
  console.log(`Tools with Invalid Bin IDs: ${totalInvalidBinIds} (${totalTools > 0 ? (totalInvalidBinIds / totalTools * 100).toFixed(1) : 0}%)`);
  console.log(`Tools without Bin IDs: ${totalMissingBinIds} (${totalTools > 0 ? (totalMissingBinIds / totalTools * 100).toFixed(1) : 0}%)`);
  
  // Print failed queries
  const failedQueries = results.filter(r => !r.success);
  if (failedQueries.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('❌ FAILED QUERIES:');
    console.log('-'.repeat(80));
    for (const result of failedQueries) {
      console.log(`\nQuery: "${result.query}"`);
      console.log(`  Total tools: ${result.totalTools}`);
      console.log(`  Valid bin IDs: ${result.toolsWithValidBinIds}`);
      console.log(`  Invalid bin IDs: ${result.toolsWithInvalidBinIds}`);
      console.log(`  Missing bin IDs: ${result.toolsWithoutBinIds}`);
      if (result.missingBinIds.length > 0) {
        console.log(`  Invalid bin IDs found:`);
        result.missingBinIds.forEach(missing => console.log(`    - ${missing}`));
      }
    }
  }
  
  // Print unique invalid bin IDs
  const allInvalidBinIds = new Set<string>();
  results.forEach(r => r.invalidBinIds.forEach(id => allInvalidBinIds.add(id)));
  if (allInvalidBinIds.size > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('🔍 UNIQUE INVALID BIN IDs:');
    console.log('-'.repeat(80));
    Array.from(allInvalidBinIds).forEach(id => console.log(`  - ${id}`));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test completed!');
  console.log('='.repeat(80));
}

// Run the test
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

