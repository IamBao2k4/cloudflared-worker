import 'dotenv/config';
import { createElasticsearchService } from '../src/configs/elasticsearch.config';

async function checkElasticsearchLogs() {
  console.log('🔍 Checking Elasticsearch logs...\n');
  
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
  
  try {
    // 1. Check if index exists
    const indexName = process.env.ELASTICSEARCH_INDEX || 'mongorest-api-logs';
    console.log(`📋 Checking index: ${indexName}`);
    
    const indexExists = await client.indices.exists({ index: indexName });
    console.log(`Index exists: ${indexExists ? '✅' : '❌'}`);
    
    if (!indexExists) {
      console.log('💡 Index does not exist yet. This is normal if no logs have been sent.');
      return;
    }
    
    // 2. Get index stats
    const stats = await client.indices.stats({ index: indexName });
    const docCount = stats.body._all.total.docs.count;
    const indexSize = stats.body._all.total.store.size_in_bytes;
    
    console.log(`📊 Index Statistics:`);
    console.log(`   - Document count: ${docCount}`);
    console.log(`   - Index size: ${(indexSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (docCount === 0) {
      console.log('\n💡 No documents found. Possible reasons:');
      console.log('   - Server hasn\'t received any API calls yet');
      console.log('   - Logging is disabled');
      console.log('   - Network/authentication issues');
      return;
    }
    
    // 3. Get recent logs (last 10)
    console.log(`\n📝 Recent logs (last 10):`);
    const searchResult = await client.search({
      index: indexName,
      body: {
        query: { match_all: {} },
        sort: [{ timestamp: { order: 'desc' } }],
        size: 10,
        _source: ['timestamp', 'method', 'url', 'statusCode', 'responseTime', 'ip', 'traceId']
      }
    });
    
    if (searchResult.body.hits.total.value === 0) {
      console.log('   No logs found');
    } else {
      searchResult.body.hits.hits.forEach((hit: any, index: number) => {
        const log = hit._source;
        console.log(`   ${index + 1}. [${log.timestamp}] ${log.method} ${log.url} - ${log.statusCode} (${log.responseTime}ms) - ${log.ip}`);
        if (log.traceId) {
          console.log(`      Trace ID: ${log.traceId}`);
        }
      });
    }
    
    // 4. Get logs by time ranges
    console.log(`\n📈 Log distribution (last 24 hours):`);
    const last24h = await client.search({
      index: indexName,
      body: {
        query: {
          range: {
            timestamp: {
              gte: 'now-24h'
            }
          }
        },
        aggs: {
          logs_per_hour: {
            date_histogram: {
              field: 'timestamp',
              interval: '1h'
            }
          },
          status_codes: {
            terms: {
              field: 'statusCode',
              size: 10
            }
          }
        },
        size: 0
      }
    });
    
    const hourlyBuckets = last24h.body.aggregations.logs_per_hour.buckets;
    const statusBuckets = last24h.body.aggregations.status_codes.buckets;
    
    console.log(`   Total logs in last 24h: ${last24h.body.hits.total.value}`);
    
    if (hourlyBuckets.length > 0) {
      console.log(`   Hourly distribution:`);
      hourlyBuckets.slice(-6).forEach((bucket: any) => {
        const time = new Date(bucket.key_as_string).toLocaleTimeString();
        console.log(`     ${time}: ${bucket.doc_count} logs`);
      });
    }
    
    if (statusBuckets.length > 0) {
      console.log(`   Status code distribution:`);
      statusBuckets.forEach((bucket: any) => {
        console.log(`     ${bucket.key}: ${bucket.doc_count} requests`);
      });
    }
    
    // 5. Check for recent errors
    console.log(`\n🔴 Recent errors (last 5):`);
    const errorResult = await client.search({
      index: indexName,
      body: {
        query: {
          range: {
            statusCode: { gte: 400 }
          }
        },
        sort: [{ timestamp: { order: 'desc' } }],
        size: 5,
        _source: ['timestamp', 'method', 'url', 'statusCode', 'errorMessage', 'traceId']
      }
    });
    
    if (errorResult.body.hits.total.value === 0) {
      console.log('   ✅ No recent errors found');
    } else {
      errorResult.body.hits.hits.forEach((hit: any, index: number) => {
        const log = hit._source;
        console.log(`   ${index + 1}. [${log.timestamp}] ${log.method} ${log.url} - ${log.statusCode}`);
        if (log.errorMessage) {
          console.log(`      Error: ${log.errorMessage}`);
        }
        if (log.traceId) {
          console.log(`      Trace ID: ${log.traceId}`);
        }
      });
    }
    
    console.log('\n✅ Log check completed successfully!');
    
  } catch (error) {
    console.error('❌ Error checking logs:', error);
    
    if (error.meta?.statusCode === 401) {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   - ELASTICSEARCH_USERNAME');
      console.log('   - ELASTICSEARCH_PASSWORD');
    } else if (error.meta?.statusCode === 404) {
      console.log('\n💡 Index not found. This means no logs have been sent yet.');
    } else {
      console.log('\n💡 Please check your Elasticsearch configuration and network connectivity.');
    }
  }
}

// Run check
checkElasticsearchLogs();
