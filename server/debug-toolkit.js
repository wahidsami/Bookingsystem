/**
 * Debugging Toolkit
 * 
 * Collection of utility scripts for debugging the system
 * 
 * Usage:
 * - Put this file in server/debug-toolkit.js
 * - Import: const debugKit = require('./debug-toolkit');
 * - Use in tests or directly in code
 */

const fs = require('fs');
const path = require('path');

class DebugToolkit {
    /**
     * Get comprehensive system status
     */
    static async systemStatus() {
        console.log('\n========== SYSTEM STATUS ==========\n');
        
        // Environment
        console.log('📝 ENVIRONMENT:');
        console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
        console.log('  PORT:', process.env.PORT || 5000);
        console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ MISSING');
        console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET' : '❌ MISSING');
        console.log('  REDIS_URL:', process.env.REDIS_URL ? '✅ SET' : 'Default (localhost:6379)');
        
        // Process
        console.log('\n⚙️ PROCESS:');
        console.log('  PID:', process.pid);
        console.log('  Uptime:', (process.uptime() / 60).toFixed(2), 'minutes');
        
        // Memory
        const mem = process.memoryUsage();
        console.log('\n💾 MEMORY:');
        console.log('  Heap Used:', (mem.heapUsed / 1024 / 1024).toFixed(2), 'MB');
        console.log('  Heap Total:', (mem.heapTotal / 1024 / 1024).toFixed(2), 'MB');
        console.log('  RSS:', (mem.rss / 1024 / 1024).toFixed(2), 'MB');
        
        // Node Version
        console.log('\n📦 VERSIONS:');
        console.log('  Node:', process.version);
    }

    /**
     * Test database connection
     */
    static async testDatabase() {
        try {
            console.log('\n========== DATABASE TEST ==========\n');
            const db = require('./src/models');
            
            // Test connection
            await db.sequelize.authenticate();
            console.log('✅ Database connection successful');
            
            // Count tables
            const result = await db.sequelize.query(
                "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
            );
            console.log('📊 Tables:', result[0][0].count);
            
            // Test queries
            const counts = {};
            const models = ['PlatformUser', 'Tenant', 'Service', 'Staff', 'Appointment'];
            for (const model of models) {
                if (db[model]) {
                    counts[model] = await db[model].count();
                }
            }
            
            console.log('📋 Records:');
            Object.entries(counts).forEach(([model, count]) => {
                console.log(`  ${model}: ${count}`);
            });
            
            return true;
        } catch (error) {
            console.error('❌ Database error:', error.message);
            return false;
        }
    }

    /**
     * Test Redis connection
     */
    static async testRedis() {
        try {
            console.log('\n========== REDIS TEST ==========\n');
            const redisService = require('./src/services/redisService');
            const client = redisService.getRedisClient();
            
            if (!client) {
                console.log('⚠️ Redis not initialized');
                return false;
            }
            
            const response = await client.ping();
            console.log('✅ Redis ping:', response);
            
            // Test set/get
            await client.set('test-key', 'test-value', 'EX', 10);
            const value = await client.get('test-key');
            console.log('✅ Test key set/get:', value === 'test-value' ? '✅' : '❌');
            
            // Get info
            const info = await client.info('stats');
            console.log('✅ Redis info available');
            
            return true;
        } catch (error) {
            console.error('❌ Redis error:', error.message);
            return false;
        }
    }

    /**
     * View recent audit logs
     */
    static viewAuditLogs(count = 10) {
        try {
            console.log(`\n========== RECENT AUDIT LOGS (Last ${count}) ==========\n`);
            const logFile = path.join(__dirname, '../logs/audit.log');
            
            if (!fs.existsSync(logFile)) {
                console.log('No audit log file');
                return;
            }
            
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            const recent = lines.slice(-count);
            
            recent.forEach(line => {
                try {
                    const entry = JSON.parse(line);
                    console.log(`[${entry.eventType}] ${entry.timestamp}`);
                    if (entry.email) console.log(`  Email: ${entry.email}`);
                    if (entry.userId) console.log(`  User: ${entry.userId}`);
                    if (entry.status) console.log(`  Status: ${entry.status}`);
                } catch {
                    console.log(line);
                }
            });
        } catch (error) {
            console.error('Error reading audit logs:', error.message);
        }
    }

    /**
     * View recent error logs
     */
    static viewErrorLogs(count = 10) {
        try {
            console.log(`\n========== RECENT ERRORS (Last ${count}) ==========\n`);
            const logFile = path.join(__dirname, '../logs/error.log');
            
            if (!fs.existsSync(logFile)) {
                console.log('No error log file');
                return;
            }
            
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            const recent = lines.slice(-count);
            
            recent.forEach(line => console.log(line));
        } catch (error) {
            console.error('Error reading error logs:', error.message);
        }
    }

    /**
     * Check API endpoints
     */
    static async checkEndpoints() {
        console.log('\n========== API HEALTH CHECK ==========\n');
        
        const endpoints = [
            'GET http://localhost:5000/',
            'GET http://localhost:5000/api/v1/settings/global',
            'GET http://localhost:5000/api/v1/tenants'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const [method, url] = endpoint.split(' ');
                console.log(`Testing ${method} ${url}...`);
                // Note: Requires fetch or axios
            } catch (error) {
                console.error('Error:', error.message);
            }
        }
    }

    /**
     * Generate debug report
     */
    static async generateReport() {
        console.log('\n\n╔════════════════════════════════════════╗');
        console.log('║       SYSTEM DEBUG REPORT              ║');
        console.log('╚════════════════════════════════════════╝\n');
        
        await this.systemStatus();
        await this.testDatabase();
        await this.testRedis();
        this.viewAuditLogs(5);
        this.viewErrorLogs(5);
        
        console.log('\n\n✅ Debug report complete!\n');
    }

    /**
     * Check specific issue
     */
    static async diagnose(issue) {
        console.log(`\n========== DIAGNOSING: ${issue.toUpperCase()} ==========\n`);
        
        const diagnostics = {
            'jwt': async () => {
                const jwt = require('jsonwebtoken');
                console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ MISSING');
                if (process.env.JWT_SECRET) {
                    try {
                        const token = jwt.sign({test: true}, process.env.JWT_SECRET);
                        jwt.verify(token, process.env.JWT_SECRET);
                        console.log('✅ JWT working correctly');
                    } catch (e) {
                        console.log('❌ JWT error:', e.message);
                    }
                }
            },
            'database': () => this.testDatabase(),
            'redis': () => this.testRedis(),
            'cors': () => {
                console.log('CORS_ORIGINS:', process.env.CORS_ORIGINS || 'default (localhost)');
                console.log('Allowed origins configured in index.js getCorsOrigins()');
            },
            'logs': () => {
                const logsDir = path.join(__dirname, '../logs');
                if (fs.existsSync(logsDir)) {
                    const files = fs.readdirSync(logsDir);
                    console.log('Log files:', files);
                } else {
                    console.log('❌ No logs directory');
                }
            }
        };
        
        if (diagnostics[issue]) {
            await diagnostics[issue]();
        } else {
            console.log('Available diagnostics:', Object.keys(diagnostics).join(', '));
        }
    }

    /**
     * Performance snapshot
     */
    static performanceSnapshot() {
        try {
            console.log('\n========== PERFORMANCE SNAPSHOT ==========\n');
            const perfMonitor = require('./src/services/performanceMonitor');
            
            const stats = perfMonitor.getOverallStats();
            console.log('Overall Stats:', stats);
            
            const slowest = perfMonitor.getSlowestEndpoints(3);
            console.log('\nSlowest Endpoints:');
            slowest.forEach(ep => {
                console.log(`  ${ep.method} ${ep.path}: ${ep.avgTime.toFixed(0)}ms avg`);
            });
            
            const errors = perfMonitor.getHighestErrorRates(3);
            console.log('\nHighest Error Rates:');
            errors.forEach(({endpoint, errorRate}) => {
                console.log(`  ${endpoint}: ${errorRate}`);
            });
        } catch (error) {
            console.error('Performance monitoring not available:', error.message);
        }
    }
}

// Export for use
module.exports = DebugToolkit;

// Allow direct execution
if (require.main === module) {
    const command = process.argv[2];
    
    (async () => {
        switch (command) {
            case 'status':
                await DebugToolkit.systemStatus();
                break;
            case 'db':
                await DebugToolkit.testDatabase();
                break;
            case 'redis':
                await DebugToolkit.testRedis();
                break;
            case 'report':
                await DebugToolkit.generateReport();
                break;
            case 'audit':
                DebugToolkit.viewAuditLogs(20);
                break;
            case 'errors':
                DebugToolkit.viewErrorLogs(20);
                break;
            case 'perf':
                DebugToolkit.performanceSnapshot();
                break;
            case 'diagnose':
                await DebugToolkit.diagnose(process.argv[3] || 'jwt');
                break;
            default:
                console.log(`Usage: node debug-toolkit.js [command]
Commands:
  status      - System status
  db          - Test database
  redis       - Test Redis
  report      - Full debug report
  audit       - View audit logs
  errors      - View error logs
  perf        - Performance snapshot
  diagnose    - Diagnose issue (jwt, database, redis, cors, logs)`);
        }
        process.exit(0);
    })().catch(error => {
        console.error(error);
        process.exit(1);
    });
}
