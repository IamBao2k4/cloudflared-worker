import * as apm from 'elastic-apm-node';
 
apm.start({
  serviceName: 'mongorest-worker-service',
  secretToken: 'C1xPHEG03N1Xoe6l6gJCnqR808NVpBVzi1J0fEsgYHkj5brr7T',
  serverUrl: 'https://apm.mangoads.com.vn',
  environment: 'production',
  active: true,
  metricsInterval: '5s',
  centralConfig: false,
  captureSpanStackTraces: true,
});