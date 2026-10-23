import CircuitBreaker from 'opossum';
import { openaiClient } from './openai.client';
import { withRetry } from './retry';

async function callOpenAI(path: string, body: any) {
  return withRetry(() => openaiClient.post(path, body));
}

// After enough failures, the breaker "opens" and fails instantly without
// even calling OpenAI — protects your worker pool from piling up on a
// dependency that's down.
export const openaiBreaker = new CircuitBreaker(callOpenAI, {
  timeout: 35000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 60000,
  rollingCountBuckets: 10,
});

openaiBreaker.fallback(() => {
  throw new Error('OpenAI is temporarily unavailable. Please try again shortly.');
});

openaiBreaker.on('open', () => console.warn('⚠️ OpenAI breaker OPENED — failing fast'));
openaiBreaker.on('halfOpen', () => console.warn('⚠️ OpenAI breaker HALF-OPEN — testing recovery'));
openaiBreaker.on('close', () => console.log('✅ OpenAI breaker CLOSED — normal operation'));