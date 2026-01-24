/**
 * Production Logger Utility
 * Use this for production logging instead of console.log
 * Logs are written to files or external services in production
 */

const fs = require('fs');
const path = require('path');

class ProductionLogger {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV !== 'production';
        this.logDir = path.join(__dirname, '../logs');
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Log errors (always logged)
     */
    error(message, error = null, context = {}) {
        const timestamp = new Date().toISOString();
        const logMessage = {
            timestamp,
            level: 'ERROR',
            message,
            error: error ? error.message : null,
            stack: error ? error.stack : null,
            context
        };

        if (this.isDevelopment) {
            console.error('\n❌ [ERROR]', message, error || '');
        } else {
            this.writeToFile('error.log', logMessage);
        }
    }

    /**
     * Log warnings (always logged)
     */
    warn(message, context = {}) {
        const timestamp = new Date().toISOString();
        const logMessage = {
            timestamp,
            level: 'WARN',
            message,
            context
        };

        if (this.isDevelopment) {
            console.warn('\n⚠️  [WARN]', message);
        } else {
            this.writeToFile('warn.log', logMessage);
        }
    }

    /**
     * Log info messages (development only)
     * In production, these are filtered out
     */
    info(message, context = {}) {
        if (this.isDevelopment) {
            console.info('ℹ️  [INFO]', message, context);
        }
        // Silently ignored in production
    }

    /**
     * Log debug messages (development only)
     * In production, these are completely ignored
     */
    debug(message, context = {}) {
        if (this.isDevelopment) {
            console.log('🔍 [DEBUG]', message, context);
        }
        // Silently ignored in production
    }

    /**
     * Log security-related events (always logged)
     */
    security(message, event = {}, context = {}) {
        const timestamp = new Date().toISOString();
        const logMessage = {
            timestamp,
            level: 'SECURITY',
            message,
            event,
            context
        };

        if (this.isDevelopment) {
            console.warn('\n🔒 [SECURITY]', message, event);
        } else {
            this.writeToFile('security.log', logMessage);
        }
    }

    /**
     * Log performance metrics (always logged)
     */
    performance(message, metrics = {}, context = {}) {
        const timestamp = new Date().toISOString();
        const logMessage = {
            timestamp,
            level: 'PERFORMANCE',
            message,
            metrics,
            context
        };

        if (this.isDevelopment) {
            console.log('⚡ [PERF]', message, metrics);
        } else {
            this.writeToFile('performance.log', logMessage);
        }
    }

    /**
     * Write log to file (production only)
     */
    writeToFile(filename, logMessage) {
        const filepath = path.join(this.logDir, filename);
        const logLine = JSON.stringify(logMessage) + '\n';

        fs.appendFile(filepath, logLine, (err) => {
            if (err) {
                console.error('Failed to write to log file:', err);
            }
        });
    }
}

// Export singleton instance
module.exports = new ProductionLogger();
