import 'dotenv/config';

console.log('🔍 Debugging Elasticsearch Configuration\n');

console.log('📋 Environment Variables:');
console.log('========================');
console.log(`ELASTICSEARCH_NODE: "${process.env.ELASTICSEARCH_NODE}"`);
console.log(`ELASTICSEARCH_USERNAME: "${process.env.ELASTICSEARCH_USERNAME}"`);
console.log(`ELASTICSEARCH_PASSWORD: "${process.env.ELASTICSEARCH_PASSWORD ? '[SET]' : '[NOT SET]'}"`);
console.log(`ELASTICSEARCH_INDEX: "${process.env.ELASTICSEARCH_INDEX}"`);
console.log(`ELASTICSEARCH_ENABLED: "${process.env.ELASTICSEARCH_ENABLED}"`);
console.log(`NODE_ENV: "${process.env.NODE_ENV}"`);

console.log('\n🔧 Validation:');
console.log('==============');

const node = process.env.ELASTICSEARCH_NODE;
const username = process.env.ELASTICSEARCH_USERNAME;
const password = process.env.ELASTICSEARCH_PASSWORD;
const enabled = process.env.ELASTICSEARCH_ENABLED;

console.log(`✅ Node URL: ${node ? '✓' : '❌ Missing'}`);
console.log(`✅ Username: ${username ? '✓ (Optional)' : '❌ Not set (Optional for this cluster)'}`);
console.log(`✅ Password: ${password ? '✓ (Optional)' : '❌ Not set (Optional for this cluster)'}`);
console.log(`✅ Enabled: ${enabled === 'true' ? '✓' : `❌ ${enabled}`}`);

console.log('\n💡 Configuration Status:');
console.log('========================');

if (!enabled || enabled !== 'true') {
  console.log('❌ Elasticsearch is DISABLED');
  console.log('   → Set ELASTICSEARCH_ENABLED=true in .env');
} else if (!node) {
  console.log('❌ Elasticsearch is ENABLED but missing required configuration');
  console.log('   → Missing ELASTICSEARCH_NODE');
} else {
  console.log('✅ Elasticsearch configuration is COMPLETE');
  console.log('   → Node URL is present');
  console.log('   → Authentication is not required for this cluster');
}

console.log('\n🔄 Next Steps:');
console.log('==============');
console.log('1. Test connection (no auth required):');
console.log('   npm run test:elasticsearch');
console.log('');
console.log('2. Start monitoring:');
console.log('   npm run monitor:logs');
console.log('');
console.log('3. Generate test traffic:');
console.log('   npm run load:test');
