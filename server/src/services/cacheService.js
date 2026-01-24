/**
 * Redis Caching Service
 * 
 * Provides easy-to-use caching methods for high-read, low-write data:
 * - Service catalogs (5 min TTL)
 * - Staff availability (5 min TTL)
 * - Tenant settings (30 min TTL)
 * - User permissions (5 min TTL)
 * - Availability slots (5 min TTL, recomputed on demand)
 * 
 * Automatic cache invalidation on data changes via middleware hooks
 * 
 * Usage:
 * const cacheService = require('./cacheService');
 * 
 * // Get or compute with auto-cache
 * const services = await cacheService.getOrSet(
 *   'services:tenant:1',
 *   () => db.Service.findAll({ where: { tenantId: 1 } }),
 *   300 // 5 min TTL
 * );
 * 
 * // Invalidate on update
 * await cacheService.invalidate('services:tenant:1');
 */

const redisService = require('./redisService');
const logger = require('./productionLogger');

class CacheService {
    /**
     * Get value from cache or compute it
     * 
     * If key exists in cache, returns cached value
     * Otherwise, calls getter function, caches result, and returns it
     * 
     * Algorithm:
     * 1. Check Redis for key
     * 2. If exists, parse JSON and return
     * 3. If not, call getter function
     * 4. Serialize result to JSON
     * 5. Store in Redis with TTL
     * 6. Return result
     * 
     * @param {string} key - Cache key
     * @param {Function} getter - Async function that returns value to cache
     * @param {number} ttlSeconds - Cache TTL in seconds
     * @returns {Promise<any>} Cached or computed value
     */
    async getOrSet(key, getter, ttlSeconds = 300) {
        try {
            // Try to get from Redis
            const cached = await this.get(key);
            if (cached !== null) {
                logger.debug(`Cache HIT: ${key}`);
                return cached;
            }

            // Cache miss - compute value
            logger.debug(`Cache MISS: ${key}`);
            const value = await getter();

            // Store in cache
            await this.set(key, value, ttlSeconds);

            return value;
        } catch (error) {
            logger.warn(`Cache error for ${key}: ${error.message}`);
            // Fall back to getter without caching
            return await getter();
        }
    }

    /**
     * Get value from cache
     * 
     * @param {string} key - Cache key
     * @returns {Promise<any|null>} Cached value or null if not found/expired
     */
    async get(key) {
        try {
            const client = redisService.getRedisClient();
            if (!client) return null;

            const cached = await client.get(key);
            if (!cached) return null;

            return JSON.parse(cached);
        } catch (error) {
            logger.warn(`Cache get error for ${key}: ${error.message}`);
            return null;
        }
    }

    /**
     * Set value in cache
     * 
     * @param {string} key - Cache key
     * @param {any} value - Value to cache (will be JSON stringified)
     * @param {number} ttlSeconds - TTL in seconds (default: 300 = 5 min)
     * @returns {Promise<void>}
     */
    async set(key, value, ttlSeconds = 300) {
        try {
            const client = redisService.getRedisClient();
            if (!client) return;

            const serialized = JSON.stringify(value);
            await client.setex(key, ttlSeconds, serialized);
        } catch (error) {
            logger.warn(`Cache set error for ${key}: ${error.message}`);
        }
    }

    /**
     * Delete from cache
     * 
     * @param {string} key - Cache key to delete
     * @returns {Promise<void>}
     */
    async invalidate(key) {
        try {
            const client = redisService.getRedisClient();
            if (!client) return;

            await client.del(key);
            logger.debug(`Cache invalidated: ${key}`);
        } catch (error) {
            logger.warn(`Cache invalidate error for ${key}: ${error.message}`);
        }
    }

    /**
     * Delete multiple cache keys by pattern
     * 
     * Useful for invalidating related cache entries
     * Example: invalidatePattern('services:tenant:1:*')
     * 
     * WARNING: This can be slow on large Redis instances!
     * Use with pattern specificity for best performance
     * 
     * @param {string} pattern - Key pattern to match (supports * wildcard)
     * @returns {Promise<number>} Number of keys deleted
     */
    async invalidatePattern(pattern) {
        try {
            const client = redisService.getRedisClient();
            if (!client) return 0;

            const keys = await client.keys(pattern);
            if (keys.length === 0) return 0;

            const deleted = await client.del(...keys);
            logger.debug(`Cache pattern invalidated: ${pattern} (${deleted} keys)`);
            return deleted;
        } catch (error) {
            logger.warn(`Cache pattern invalidate error for ${pattern}: ${error.message}`);
            return 0;
        }
    }

    /**
     * Cache list items efficiently
     * 
     * Caches array of objects with individual key generation
     * Useful for caching database lists where items may be accessed individually
     * 
     * Example:
     * services = [{ id: 1, name: 'Haircut' }, { id: 2, name: 'Color' }]
     * cacheService.setList('services:tenant:1', services, (s) => `service:${s.id}`)
     * 
     * @param {string} groupKey - Group cache key (for batch invalidation)
     * @param {Array} items - Items to cache
     * @param {Function} keyGenerator - Function that generates key for each item
     * @param {number} ttlSeconds - TTL in seconds
     * @returns {Promise<void>}
     */
    async setList(groupKey, items, keyGenerator, ttlSeconds = 300) {
        try {
            const client = redisService.getRedisClient();
            if (!client) return;

            // Cache individual items
            for (const item of items) {
                const key = keyGenerator(item);
                const serialized = JSON.stringify(item);
                await client.setex(key, ttlSeconds, serialized);
            }

            // Also cache the list itself for bulk retrieval
            const listSerialized = JSON.stringify(items);
            await client.setex(groupKey, ttlSeconds, listSerialized);

            logger.debug(`Cached list: ${groupKey} (${items.length} items)`);
        } catch (error) {
            logger.warn(`Cache setList error for ${groupKey}: ${error.message}`);
        }
    }

    /**
     * Get list from cache or compute it
     * 
     * @param {string} groupKey - Group cache key
     * @param {Function} getter - Function that returns items array
     * @param {number} ttlSeconds - TTL in seconds
     * @returns {Promise<Array>} Cached or computed array
     */
    async getOrSetList(groupKey, getter, ttlSeconds = 300) {
        try {
            const cached = await this.get(groupKey);
            if (cached && Array.isArray(cached)) {
                logger.debug(`Cache HIT (list): ${groupKey}`);
                return cached;
            }

            logger.debug(`Cache MISS (list): ${groupKey}`);
            const items = await getter();

            const serialized = JSON.stringify(items);
            const client = redisService.getRedisClient();
            if (client) {
                await client.setex(groupKey, ttlSeconds, serialized);
            }

            return items;
        } catch (error) {
            logger.warn(`Cache getOrSetList error for ${groupKey}: ${error.message}`);
            return await getter();
        }
    }

    /**
     * Clear all cache (use with caution!)
     * 
     * Only clears cache keys, not user sessions
     * 
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            const client = redisService.getRedisClient();
            if (!client) return;

            await client.flushdb();
            logger.security('🚨 ALL CACHE CLEARED');
        } catch (error) {
            logger.warn(`Cache clearAll error: ${error.message}`);
        }
    }

    /**
     * Get cache statistics
     * 
     * @returns {Promise<Object>} Cache stats
     */
    async getStats() {
        try {
            const client = redisService.getRedisClient();
            if (!client) return { error: 'Redis not available' };

            const info = await client.info('stats');
            const keys = await client.keys('*');

            return {
                totalKeys: keys.length,
                info: info,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.warn(`Cache getStats error: ${error.message}`);
            return { error: error.message };
        }
    }
}

// Predefined cache key generators and invalidation helpers

const cacheKeys = {
    /**
     * Services for tenant
     * @param {string|number} tenantId
     */
    services: (tenantId) => `services:tenant:${tenantId}`,

    /**
     * Staff for tenant
     * @param {string|number} tenantId
     */
    staff: (tenantId) => `staff:tenant:${tenantId}`,

    /**
     * Individual service
     * @param {string|number} serviceId
     */
    service: (serviceId) => `service:${serviceId}`,

    /**
     * Individual staff member
     * @param {string|number} staffId
     */
    staffMember: (staffId) => `staff:${staffId}`,

    /**
     * Tenant settings
     * @param {string|number} tenantId
     */
    tenantSettings: (tenantId) => `settings:tenant:${tenantId}`,

    /**
     * Availability slots for date
     * @param {string|number} tenantId
     * @param {string} date YYYY-MM-DD
     */
    availability: (tenantId, date) => `availability:tenant:${tenantId}:date:${date}`,

    /**
     * User permissions
     * @param {string|number} userId
     */
    userPermissions: (userId) => `permissions:user:${userId}`,

    /**
     * Tenant global settings
     */
    globalSettings: () => 'settings:global'
};

module.exports = new CacheService();
module.exports.cacheKeys = cacheKeys;
