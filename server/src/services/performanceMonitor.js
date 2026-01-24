/**
 * Performance Monitoring Service
 * 
 * Tracks and monitors:
 * - Request timing per endpoint
 * - Database query performance
 * - Response time distribution
 * - Error rates by endpoint
 * - Slow query detection (>500ms)
 * - Performance alerts (threshold breaches)
 * 
 * Stores metrics to: server/logs/performance.log
 * 
 * Usage:
 * const perfMonitor = require('./performanceMonitor');
 * 
 * // As middleware:
 * app.use(perfMonitor.middleware());
 * 
 * // Get metrics:
 * const stats = await perfMonitor.getEndpointStats('GET /api/v1/services');
 */

const fs = require('fs');
const path = require('path');
const logger = require('./productionLogger');

class PerformanceMonitor {
    constructor() {
        this.logsDir = path.join(__dirname, '../../logs');
        this.metricsFile = path.join(this.logsDir, 'performance.log');
        this.metrics = new Map(); // In-memory metrics storage
        this.ensureLogsDir();
        this.initializeMetrics();
    }

    /**
     * Ensure logs directory exists
     * @private
     */
    ensureLogsDir() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    /**
     * Initialize metrics structure
     * @private
     */
    initializeMetrics() {
        this.globalMetrics = {
            totalRequests: 0,
            totalErrors: 0,
            averageResponseTime: 0,
            slowRequests: 0,
            startTime: new Date()
        };

        this.endpointMetrics = new Map();
        this.errorRates = new Map();
    }

    /**
     * Express middleware for request timing
     * 
     * Tracks:
     * - Request start time
     * - Response time on completion
     * - HTTP status code
     * - Request size
     * - Response size
     * 
     * @returns {Function} Middleware function
     */
    middleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            const startMemory = process.memoryUsage().heapUsed;

            // Capture the original send function
            const originalSend = res.send;

            res.send = function(data) {
                const responseTime = performance.now() - startTime;
                const memoryUsed = process.memoryUsage().heapUsed - startMemory;
                const statusCode = res.statusCode;

                // Track metrics
                this.recordMetric(req, res, responseTime, statusCode, memoryUsed);

                // Log slow requests
                if (responseTime > 500) {
                    this.recordSlowRequest(req, res, responseTime);
                }

                // Call original send
                return originalSend.call(this, data);
            }.bind(this);

            next();
        };
    }

    /**
     * Record a single request metric
     * @private
     */
    recordMetric(req, res, responseTime, statusCode, memoryUsed) {
        const endpoint = `${req.method} ${req.path}`;
        
        // Update global metrics
        this.globalMetrics.totalRequests++;
        if (statusCode >= 400) {
            this.globalMetrics.totalErrors++;
        }
        
        // Update endpoint metrics
        if (!this.endpointMetrics.has(endpoint)) {
            this.endpointMetrics.set(endpoint, {
                method: req.method,
                path: req.path,
                requests: 0,
                errors: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                avgTime: 0,
                lastRequest: new Date()
            });
        }

        const metrics = this.endpointMetrics.get(endpoint);
        metrics.requests++;
        metrics.totalTime += responseTime;
        metrics.minTime = Math.min(metrics.minTime, responseTime);
        metrics.maxTime = Math.max(metrics.maxTime, responseTime);
        metrics.avgTime = metrics.totalTime / metrics.requests;
        metrics.lastRequest = new Date();

        if (statusCode >= 400) {
            metrics.errors++;
        }

        // Update error rate
        if (statusCode >= 400) {
            const errorRate = (metrics.errors / metrics.requests) * 100;
            this.errorRates.set(endpoint, errorRate);
        }

        // Write to log
        this.writeMetric({
            timestamp: new Date().toISOString(),
            endpoint,
            method: req.method,
            path: req.path,
            statusCode,
            responseTime: Math.round(responseTime),
            memoryUsed: Math.round(memoryUsed / 1024), // KB
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
            userId: req.user?.id || req.tenant?.id
        });
    }

    /**
     * Record a slow request (>500ms)
     * @private
     */
    recordSlowRequest(req, res, responseTime) {
        this.globalMetrics.slowRequests++;

        const slowRequest = {
            timestamp: new Date().toISOString(),
            severity: 'SLOW_REQUEST',
            endpoint: `${req.method} ${req.path}`,
            responseTime: Math.round(responseTime),
            statusCode: res.statusCode,
            userId: req.user?.id || req.tenant?.id,
            query: req.query
        };

        logger.performance(`🐢 SLOW REQUEST: ${slowRequest.endpoint} took ${slowRequest.responseTime}ms`);

        // Write to performance log
        const logEntry = JSON.stringify(slowRequest);
        fs.appendFileSync(this.metricsFile, logEntry + '\n', 'utf8');

        // Alert if extremely slow (>2000ms)
        if (responseTime > 2000) {
            logger.security(`🚨 VERY SLOW REQUEST: ${slowRequest.endpoint} took ${responseTime}ms`);
        }
    }

    /**
     * Write metric to performance log
     * @private
     */
    writeMetric(metric) {
        const logEntry = JSON.stringify(metric);
        fs.appendFileSync(this.metricsFile, logEntry + '\n', 'utf8');
    }

    /**
     * Track database query performance
     * 
     * @param {string} query - SQL query string
     * @param {number} executionTime - Query execution time in ms
     * @param {boolean} isSlowQuery - Whether query exceeded threshold
     */
    recordDatabaseQuery(query, executionTime, isSlowQuery = false) {
        if (isSlowQuery || executionTime > 300) {
            const logEntry = JSON.stringify({
                timestamp: new Date().toISOString(),
                type: 'DATABASE_QUERY',
                severity: isSlowQuery ? 'SLOW' : 'NORMAL',
                executionTime: Math.round(executionTime),
                queryPreview: query.substring(0, 100)
            });

            fs.appendFileSync(this.metricsFile, logEntry + '\n', 'utf8');

            if (executionTime > 1000) {
                logger.performance(`🐢 SLOW DB QUERY: ${executionTime}ms - ${query.substring(0, 80)}`);
            }
        }
    }

    /**
     * Get statistics for a specific endpoint
     * 
     * @param {string} endpoint - Endpoint path (e.g., "GET /api/v1/services")
     * @returns {Object} Endpoint statistics
     */
    getEndpointStats(endpoint) {
        return this.endpointMetrics.get(endpoint) || {
            error: `No metrics for ${endpoint}`
        };
    }

    /**
     * Get all endpoint statistics sorted by response time
     * 
     * @returns {Array} Sorted array of endpoint metrics
     */
    getAllEndpointStats() {
        const stats = Array.from(this.endpointMetrics.values());
        return stats.sort((a, b) => b.avgTime - a.avgTime);
    }

    /**
     * Get slowest endpoints
     * 
     * @param {number} limit - Number of slowest endpoints to return
     * @returns {Array} Array of slowest endpoints
     */
    getSlowestEndpoints(limit = 10) {
        return this.getAllEndpointStats().slice(0, limit);
    }

    /**
     * Get endpoints with highest error rates
     * 
     * @param {number} limit - Number to return
     * @returns {Array} Array of endpoints with error stats
     */
    getHighestErrorRates(limit = 10) {
        const sorted = Array.from(this.errorRates.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);

        return sorted.map(([endpoint, errorRate]) => ({
            endpoint,
            errorRate: errorRate.toFixed(2) + '%',
            metrics: this.endpointMetrics.get(endpoint)
        }));
    }

    /**
     * Get overall system statistics
     * 
     * @returns {Object} Global system metrics
     */
    getOverallStats() {
        const uptime = new Date() - this.globalMetrics.startTime;
        const avgErrorRate = (this.globalMetrics.totalErrors / this.globalMetrics.totalRequests * 100).toFixed(2);

        return {
            uptime: {
                ms: uptime,
                seconds: Math.round(uptime / 1000),
                minutes: Math.round(uptime / 1000 / 60),
                hours: Math.round(uptime / 1000 / 60 / 60)
            },
            totalRequests: this.globalMetrics.totalRequests,
            totalErrors: this.globalMetrics.totalErrors,
            errorRate: avgErrorRate + '%',
            slowRequests: this.globalMetrics.slowRequests,
            slowRequestPercentage: ((this.globalMetrics.slowRequests / this.globalMetrics.totalRequests) * 100).toFixed(2) + '%',
            averageResponseTime: Math.round(this.globalMetrics.averageResponseTime),
            endpointCount: this.endpointMetrics.size,
            startTime: this.globalMetrics.startTime.toISOString()
        };
    }

    /**
     * Generate performance report
     * 
     * @returns {Object} Detailed performance report
     */
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            summary: this.getOverallStats(),
            slowestEndpoints: this.getSlowestEndpoints(5),
            highestErrorRates: this.getHighestErrorRates(5),
            allEndpoints: this.getAllEndpointStats()
        };
    }

    /**
     * Export metrics to JSON file
     * 
     * @param {string} filename - Output filename
     * @returns {Promise<void>}
     */
    async exportMetrics(filename = 'performance-metrics.json') {
        try {
            const report = this.generateReport();
            const filepath = path.join(this.logsDir, filename);
            fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');
            logger.info(`Performance metrics exported to ${filepath}`);
        } catch (error) {
            logger.error(`Failed to export metrics: ${error.message}`);
        }
    }

    /**
     * Reset all metrics (use with caution)
     */
    resetMetrics() {
        this.initializeMetrics();
        logger.security('🚨 Performance metrics RESET');
    }
}

module.exports = new PerformanceMonitor();
