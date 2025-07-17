import 'dotenv/config';
import { createElasticsearchService } from '../src/configs/elasticsearch.config';
import { ApiLogData } from '../src/types/elasticsearch';

async function testElasticsearch() {
    console.log('\ud83d\udd27 Testing Elasticsearch connection...');    
    const elasticsearchService = createElasticsearchService();    
    if (!elasticsearchService.isEnabled()) {    
        console.log('\u26a0\ufe0f  Elasticsearch is disabled in configuration');    
        return;  
    }    
    try {    
        // Test connection    
        const isConnected = await elasticsearchService.testConnection();        
        if (!isConnected) {      
            console.log('\u274c Connection failed');      
            return;    
        }        
        // Create index template    
        await elasticsearchService.createIndexTemplate();       
         // Test logging    
         const testLog: ApiLogData = {      
            timestamp: new Date().toISOString(),      
            method: 'GET',      
            url: '/test-endpoint',      
            ip: '127.0.0.1',      
            statusCode: 200,      
            responseTime: 100,      
            userAgent: 'Test-Agent/1.0',      
            appName: 'MongoRest API Test',      
            environment: 'test',      
            traceId: 'test-trace-id-' + Date.now(),      
            queryParams: { test: 'true' },      
            headers: { 'content-type': 'application/json' },      
            requestBody: { message: 'This is a test log entry' }    
        };        
        console.log('\ud83d\udcdd Sending test log entry...');    
        await elasticsearchService.indexLog(testLog);        
        console.log('\u2705 Test completed successfully!');    
        console.log('\ud83d\udcc4 Check your Elasticsearch cluster for the test log entry');      
    } catch (error) {    
        console.error('\u274c Test failed:', error);  
    }
}

// Run test
testElasticsearch();