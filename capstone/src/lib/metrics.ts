import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'docuchat_' });

export const httpRequestsTotal = new client.Counter({
  name: 'docuchat_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
});

export const httpRequestDuration = new client.Histogram({
  name: 'docuchat_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const documentsProcessed = new client.Counter({
  name: 'docuchat_documents_processed_total',
  help: 'Documents processed by the queue worker',
  labelNames: ['status'],
});

export const activeQueueJobs = new client.Gauge({
  name: 'docuchat_active_queue_jobs',
  help: 'Currently active queue jobs',
  labelNames: ['queue'],
});

export const cacheOperations = new client.Counter({
  name: 'docuchat_cache_operations_total',
  help: 'Cache operations',
  labelNames: ['operation', 'result'],
});

export const metricsRegistry = client.register;