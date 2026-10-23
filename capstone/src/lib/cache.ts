import IORedis from 'ioredis';
import crypto from 'crypto';

// Separate connection from the BullMQ one in queues/connection.ts —
// BullMQ needs maxRetriesPerRequest: null for its blocking commands,
// but a plain cache connection doesn't, and shouldn't carry that setting.
const url = new URL(process.env.REDIS_URL!);

export const cacheRedis = new IORedis({
  host: url.hostname,
  port: Number(url.port),
  password: url.password,
  tls: { servername: url.hostname }, // same Upstash SNI fix as queues/connection.ts
  keyPrefix: 'docuchat:',
});

export const CACHE_TTL = {
  PERMISSIONS: 300,
  DOCUMENT: 600,
  CONVERSATION_LIST: 120,
  EMBEDDING: 604800,
  RAG_RESULT: 3600,
} as const;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await cacheRedis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  await cacheRedis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await cacheRedis.del(key);
}

// SCAN instead of KEYS — KEYS blocks the whole Redis server while it scans
// every key; SCAN does the same job in small non-blocking batches.
export async function cacheDelPattern(pattern: string): Promise<void> {
  const stream = cacheRedis.scanStream({ match: pattern, count: 100 });
  const pipeline = cacheRedis.pipeline();
  for await (const keys of stream) {
    for (const key of keys) pipeline.del(key);
  }
  await pipeline.exec();
}

export function hashKey(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').substring(0, 16);
}

// Cache-aside with stampede protection: if 200 requests see a cache miss
// at the same moment, only ONE of them actually hits the database — the
// rest wait briefly and read the freshly-populated cache instead.
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const lockKey = `lock:${key}`;
  // NX = only set if the key doesn't already exist — this is how only
  // one concurrent request "wins" the right to hit the database.
  const acquired = await cacheRedis.set(lockKey, '1', 'EX', 5, 'NX');

  if (acquired) {
    try {
      const value = await fetchFn();
      await cacheSet(key, value, ttlSeconds);
      return value;
    } finally {
      await cacheRedis.del(lockKey);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 100));
  const retried = await cacheGet<T>(key);
  if (retried !== null) return retried;

  return fetchFn(); // lock holder crashed or was slow — just fetch directly
}