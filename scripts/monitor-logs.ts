import 'dotenv/config';
import { createElasticsearchService } from '../src/configs/elasticsearch.config';

async function monitorLogs() {
  console.log('🔄 Starting real-time log monitoring...');
  console.log('Press Ctrl+C to stop\n');
  
  const elasticsearchService = createElasticsearchService();
  
  if (!elasticsearchService.isEnabled()) {
    console.log('⚠️  Elasticsearch is disabled in configuration');
    return;
  }
  
  const client = elasticsearchService.getClient();
  if (!client) {
    console.log('❌ Elasticsearch client not available');
    return;
  }
  
  const indexName = process.env.ELASTICSEARCH_INDEX || 'mongorest-api-logs';
  let lastTimestamp = new Date().toISOString();
  
  const pollInterval = 2000; // Check every 2 seconds
  
  console.log(`Monitoring index: ${indexName}`);
  console.log(`Poll interval: ${pollInterval}ms\n`);
  
  async function checkForNewLogs() {
    try {
      const result = await client!.search({
        index: indexName,
        body: {
          query: {
            range: {
              timestamp: {
                gt: lastTimestamp
              }
            }
          },
          sort: [{ timestamp: { order: 'asc' } }],
          size: 50
        }
      });
      
      const hits = result.hits.hits;
      
      if (hits.length > 0) {
        hits.forEach((hit: any) => {
          const log = hit._source;
          const time = new Date(log.timestamp).toLocaleTimeString();
          
          // Color code by status
          let statusColor = '';
          if (log.statusCode >= 500) statusColor = '\x1b[31m'; // Red
          else if (log.statusCode >= 400) statusColor = '\x1b[33m'; // Yellow
          else if (log.statusCode >= 200) statusColor = '\x1b[32m'; // Green
          const resetColor = '\x1b[0m';
          
          console.log(`${statusColor}[${time}] ${log.method} ${log.url} - ${log.statusCode} (${log.responseTime}ms)${resetColor}`);
          
          if (log.userId) {
            console.log(`         User: ${log.userId}`);
          }
          if (log.errorMessage) {
            console.log(`         Error: ${log.errorMessage}`);
          }
          if (log.traceId) {
            console.log(`         Trace: ${log.traceId}`);
          }
          console.log(''); // Empty line for readability
          
          lastTimestamp = log.timestamp;
        });
      } else {
        // Show a dot to indicate we're still monitoring
        process.stdout.write('.');
      }
      
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        console.log('⏳ Waiting for index to be created...');
      } else {
        console.error('❌ Error monitoring logs:', error.message);
      }
    }
  }
  
  // Initial check
  await checkForNewLogs();
  
  // Set up polling
  const interval = setInterval(checkForNewLogs, pollInterval);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping log monitoring...');
    clearInterval(interval);
    process.exit(0);
  });
}

// Run monitor
monitorLogs();
