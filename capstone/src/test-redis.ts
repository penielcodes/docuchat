import IORedis from 'ioredis';
import 'dotenv/config';

// Parse the URL ourselves so we can be explicit about every TLS option —
// Upstash's TLS handshake needs the hostname set in `servername` for SNI,
// which isn't always inferred correctly from a plain rediss:// string.
const url = new URL(process.env.REDIS_URL!);

const redis = new IORedis({
  host: url.hostname,
  port: Number(url.port),
  password: url.password,
  tls: {
    servername: url.hostname,
  },
});

redis.on('error', (err) => console.error('Redis error:', err.message));
redis.on('connect', () => console.log('Connected (TCP+TLS handshake succeeded)'));
redis.on('ready', () => console.log('Ready (authenticated)'));

async function main() {
  const pong = await redis.ping();
  console.log('PING response:', pong);
  await redis.quit();
}

main();