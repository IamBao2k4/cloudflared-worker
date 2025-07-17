import ElasticsearchService from '../services/elasticsearch.service';
import { ElasticsearchConfig } from '../types/elasticsearch';

export function createElasticsearchService(): ElasticsearchService {
  const config: ElasticsearchConfig = {
    node: process.env.ELASTICSEARCH_NODE || '',
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    index: process.env.ELASTICSEARCH_INDEX || 'mongorest-api-logs',
    enabled: process.env.ELASTICSEARCH_ENABLED === 'true'
  };

  // Validate config if enabled
  if (config.enabled) {
    if (!config.node) {
      console.warn('⚠️  Elasticsearch is enabled but missing ELASTICSEARCH_NODE. Disabling...');
      config.enabled = false;
    }
    // Username and password are optional now
  }

  return new ElasticsearchService(config);
}

export default createElasticsearchService;
