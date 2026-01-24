/**
 * Redis Service
 * Handles Redis operations for locking and caching
 */

let redisClient = null;

/**
 * Initialize Redis client
 */
function initRedis() {
    try {
        const redis = require('redis');
        const client = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        client.on('connect', () => {
            console.log('✅ Redis connected');
        });

        client.connect().catch(console.error);
        redisClient = client;
        return client;
    } catch (error) {
        console.warn('Redis not available:', error.message);
        return null;
    }
}

/**
 * Get Redis client (lazy initialization)
 */
function getRedisClient() {
    if (!redisClient) {
        redisClient = initRedis();
    }
    return redisClient;
}

/**
 * Acquire a lock for a booking slot
 * @param {string} key - Lock key (e.g., "booking:staffId:startTime")
 * @param {number} ttl - Time to live in seconds (default 300 = 5 minutes)
 * @returns {Promise<boolean>} - true if lock acquired, false if already locked
 */
async function acquireLock(key, ttl = 300) {
    const client = getRedisClient();
    if (!client) {
        // If Redis not available, skip locking (not ideal but allows system to work)
        return true;
    }

    try {
        const lockKey = `lock:${key}`;
        const result = await client.setNX(lockKey, '1');
        if (result) {
            await client.expire(lockKey, ttl);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Redis lock error:', error);
        // On error, allow operation (fail open)
        return true;
    }
}

/**
 * Release a lock
 * @param {string} key - Lock key
 */
async function releaseLock(key) {
    const client = getRedisClient();
    if (!client) return;

    try {
        const lockKey = `lock:${key}`;
        await client.del(lockKey);
    } catch (error) {
        console.error('Redis unlock error:', error);
    }
}

/**
 * Get lock status
 * @param {string} key - Lock key
 * @returns {Promise<boolean>} - true if locked, false if available
 */
async function isLocked(key) {
    const client = getRedisClient();
    if (!client) return false;

    try {
        const lockKey = `lock:${key}`;
        const exists = await client.exists(lockKey);
        return exists === 1;
    } catch (error) {
        console.error('Redis check lock error:', error);
        return false;
    }
}

module.exports = {
    initRedis,
    getRedisClient,
    acquireLock,
    releaseLock,
    isLocked
};

