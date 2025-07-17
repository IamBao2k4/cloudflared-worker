import { Client } from '@elastic/elasticsearch';
import { ElasticsearchConfig, ApiLogData } from '../types/elasticsearch';

class ElasticsearchService {
  private client: Client | null = null;
  private config: ElasticsearchConfig;

  constructor(config: ElasticsearchConfig) {
    this.config = config;
    
    if (!config.enabled) {
      console.log('📊 Elasticsearch logging is disabled');
      return;
    }

    const clientConfig: any = {
      node: config.node,
      requestTimeout: 30000,
      pingTimeout: 3000,
      maxRetries: 3,
      sniffOnStart: false,
      sniffOnConnectionFault: false
    };

    // Add auth only if username and password are provided
    if (config.username && config.password) {
      clientConfig.auth = {
        username: config.username,
        password: config.password
      };
    }

    this.client = new Client(clientConfig);
  }

  async testConnection(): Promise<boolean> {
    if (!this.config.enabled || !this.client) {
      return false;
    }

    try {
      await this.client.ping();
      console.log('✅ Elasticsearch connection successful');
      return true;
    } catch (error) {
      console.error('❌ Elasticsearch connection failed:', error);
      return false;
    }
  }

  async createIndexTemplate(): Promise<void> {
    if (!this.config.enabled || !this.client) {
      return;
    }

    try {
      const templateName = `${this.config.index}-template`;
      
      await this.client.indices.putTemplate({
        name: templateName,
        body: {
          index_patterns: [`${this.config.index}*`],
          mappings: {
            properties: {
              timestamp: { type: 'date' },
              method: { type: 'keyword' },
              url: { 
                type: 'text', 
                analyzer: 'standard',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              statusCode: { type: 'integer' },
              responseTime: { type: 'integer' },
              ip: { type: 'ip' },
              userAgent: { 
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              userId: { type: 'keyword' },
              errorMessage: { 
                type: 'text',
                analyzer: 'standard'
              },
              appName: { type: 'keyword' },
              environment: { type: 'keyword' },
              traceId: { type: 'keyword' },
              requestBody: { type: 'object', enabled: false },
              responseBody: { type: 'object', enabled: false },
              queryParams: { type: 'object' },
              headers: { type: 'object' }
            }
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            index: {
              lifecycle: {
                name: 'api-logs-policy',
                rollover_alias: this.config.index
              }
            }
          }
        }
      });
      
      console.log(`✅ Elasticsearch index template '${templateName}' created successfully`);
    } catch (error) {
      console.error('❌ Failed to create Elasticsearch index template:', error);
    }
  }

  async indexLog(logData: ApiLogData): Promise<void> {
    if (!this.config.enabled || !this.client) {
      return;
    }

    try {
      await this.client.index({
        index: this.config.index,
        body: logData
      });
    } catch (error) {
      console.error('Failed to index log to Elasticsearch:', error);
      // Don't throw error to avoid breaking the API
    }
  }

  async bulkIndexLogs(logDataArray: ApiLogData[]): Promise<void> {
    if (!this.config.enabled || !this.client || logDataArray.length === 0) {
      return;
    }

    try {
      const body = logDataArray.flatMap(doc => [
        { index: { _index: this.config.index } },
        doc
      ]);

      await this.client.bulk({ body });
    } catch (error) {
      console.error('Failed to bulk index logs to Elasticsearch:', error);
    }
  }

  getClient(): Client | null {
    return this.client || null;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export default ElasticsearchService;
