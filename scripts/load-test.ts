import 'dotenv/config';
import axios from 'axios';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  responseTime: number;
  traceId?: string;
  success: boolean;
  error?: string;
}

async function loadTest() {
  console.log('🚀 Starting API load test to generate logs...\n');
  
  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
  const prefix = process.env.PREFIX_API || '';
  
  const testEndpoints = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/test-log' },
    { method: 'GET', path: '/test-error' },
    { method: 'GET', path: `${prefix}/` },
  ];
  
  const results: TestResult[] = [];
  const totalRequests = 20;
  const concurrency = 5;
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Concurrency: ${concurrency}\n`);
  
  async function makeRequest(endpoint: { method: string; path: string }): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${baseUrl}${endpoint.path}`;
    
    try {
      const response = await axios({
        method: endpoint.method as any,
        url,
        timeout: 5000,
        validateStatus: () => true // Accept all status codes
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: endpoint.path,
        method: endpoint.method,
        status: response.status,
        responseTime,
        traceId: response.headers['x-trace-id'],
        success: true
      };
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint: endpoint.path,
        method: endpoint.method,
        status: 0,
        responseTime,
        success: false,
        error: error.message
      };
    }
  }
  
  // Generate requests
  const requestPromises: Promise<TestResult>[] = [];
  
  for (let i = 0; i < totalRequests; i++) {
    const endpoint = testEndpoints[i % testEndpoints.length];
    requestPromises.push(makeRequest(endpoint));
    
    // Add delay between batches for concurrency control
    if ((i + 1) % concurrency === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('📡 Sending requests...');
  
  // Execute all requests
  const allResults = await Promise.all(requestPromises);
  results.push(...allResults);
  
  // Analyze results
  console.log('\n📊 Test Results:');
  console.log('================');
  
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  
  console.log(`Total requests: ${results.length}`);
  console.log(`Successful: ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${errorCount} (${((errorCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`Average response time: ${avgResponseTime.toFixed(0)}ms`);
  
  // Group by endpoint
  const byEndpoint = results.reduce((acc, result) => {
    const key = `${result.method} ${result.endpoint}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);
  
  console.log('\n📋 By Endpoint:');
  Object.entries(byEndpoint).forEach(([endpoint, endpointResults]) => {
    const success = endpointResults.filter(r => r.success).length;
    const total = endpointResults.length;
    const avgTime = endpointResults.reduce((sum, r) => sum + r.responseTime, 0) / total;
    const statusCodes = [...new Set(endpointResults.map(r => r.status))].join(', ');
    
    console.log(`  ${endpoint}:`);
    console.log(`    Success rate: ${success}/${total} (${((success/total)*100).toFixed(1)}%)`);
    console.log(`    Avg time: ${avgTime.toFixed(0)}ms`);
    console.log(`    Status codes: ${statusCodes}`);
  });
  
  // Show trace IDs for debugging
  console.log('\n🔍 Trace IDs (for log correlation):');
  const traceIds = results.filter(r => r.traceId).map(r => r.traceId).slice(0, 5);
  traceIds.forEach((traceId, index) => {
    console.log(`  ${index + 1}. ${traceId}`);
  });
  
  console.log('\n✅ Load test completed!');
  console.log('💡 Now run "npm run check:logs" to see if logs were sent to Elasticsearch');
  console.log('💡 Or run "npm run monitor:logs" for real-time monitoring');
}

// Run load test
loadTest().catch(console.error);
