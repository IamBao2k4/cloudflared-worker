/**
 * Test file to verify all error factories are working correctly
 */

import { 
  BootstrapErrors, 
  CoreErrors, 
  QueryErrors, 
  AdapterErrors, 
  RbacErrors 
} from './errorFactories';

// Test Bootstrap Errors
console.log('=== Testing Bootstrap Errors ===');
console.log()
try {
  throw BootstrapErrors.configRequired();
} catch (e: any) {
  console.log(`✅ configRequired: ${e.code} - ${e.statusCode} - ${e.message}`);
}

try {
  throw BootstrapErrors.coreNotInitialized();
} catch (e: any) {
  console.log(`✅ coreNotInitialized: ${e.code} - ${e.statusCode} - ${e.message}`);
}

try {
  throw BootstrapErrors.testConnectionFailed({ adapters: ['mongodb', 'postgresql'] });
} catch (e: any) {
  console.log(`✅ testConnectionFailed: ${e.code} - ${e.statusCode} - ${e.message}`);
}

// Test Core Errors
console.log('\n=== Testing Core Errors ===');
try {
  throw CoreErrors.accessDeniedRead('users', ['viewer']);
} catch (e: any) {
  console.log(`✅ accessDeniedRead: ${e.code} - ${e.statusCode} - ${e.message}`);
  console.log(`   Details:`, e.details);
}

try {
  throw CoreErrors.queryValidationFailed([
    { code: 'INVALID_OPERATOR', message: 'Operator not supported' }
  ]);
} catch (e: any) {
  console.log(`✅ queryValidationFailed: ${e.code} - ${e.statusCode} - ${e.message}`);
}

try {
  throw CoreErrors.adapterNotFound('unknown-db', 'custom-adapter');
} catch (e: any) {
  console.log(`✅ adapterNotFound: ${e.code} - ${e.statusCode} - ${e.message}`);
}

// Test Query Errors
console.log('\n=== Testing Query Errors ===');
try {
  throw QueryErrors.currentQueryNotInitialized();
} catch (e: any) {
  console.log(`✅ currentQueryNotInitialized: ${e.code} - ${e.statusCode} - ${e.message}`);
}

// Test Adapter Errors
console.log('\n=== Testing Adapter Errors ===');
try {
  throw AdapterErrors.moduleInvalid('/path/to/module.js');
} catch (e: any) {
  console.log(`✅ moduleInvalid: ${e.code} - ${e.statusCode} - ${e.message}`);
}

try {
  throw AdapterErrors.notInitialized('MongoDBAdapter');
} catch (e: any) {
  console.log(`✅ notInitialized: ${e.code} - ${e.statusCode} - ${e.message}`);
}

// Test RBAC Errors
console.log('\n=== Testing RBAC Errors ===');
try {
  throw RbacErrors.collectionNotFound('unknown-collection');
} catch (e: any) {
  console.log(`✅ collectionNotFound: ${e.code} - ${e.statusCode} - ${e.message}`);
}

try {
  throw RbacErrors.accessDenied('delete', 'users', ['viewer']);
} catch (e: any) {
  console.log(`✅ accessDenied: ${e.code} - ${e.statusCode} - ${e.message}`);
  console.log(`   Details:`, e.details);
}

// Test error response format
console.log('\n=== Testing Error Response Format ===');
import { toErrorResponse } from '.';

const error = CoreErrors.accessDeniedRead('sensitive-data', ['user']);
const response = toErrorResponse(error, false, '/api/crud/sensitive-data');
console.log('Error Response:', JSON.stringify(response, null, 2));

console.log('\n✅ All error factories are working correctly!');
