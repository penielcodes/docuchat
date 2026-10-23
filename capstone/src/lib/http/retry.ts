import { AxiosError } from 'axios';

// Only retry failures that might succeed on a second try — a 400 will
// still be a 400 in 5 seconds, so retrying it just wastes time.
function isRetryable(error: AxiosError): boolean {
  if (!error.response) return true; // no response = network error/timeout
  const status = error.response.status;
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = options;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!(error instanceof AxiosError) || !isRetryable(error)) throw error;
      if (attempt === maxAttempts) throw error;

      // Honor the server's own Retry-After header if it sent one —
      // ignoring it and using your own backoff is rude and often wrong.
      const retryAfter = error.response?.headers['retry-after'];
      const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : baseDelayMs * 2 ** (attempt - 1);

      console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms:`, error.message);
      await delay(delayMs);
    }
  }
  throw lastError;
}