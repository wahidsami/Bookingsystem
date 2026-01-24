/**
 * Audit Logger Utility
 * 
 * Logs critical operations for compliance and debugging:
 * - User authentication events (login, logout, registration)
 * - Payment processing attempts (success/failure)
 * - Appointment management (creation, cancellation, modifications)
 * - Administrative changes (settings, permissions, data updates)
 * - Security events (failed auth attempts, rate limit hits)
 * 
 * All events are logged to: server/logs/audit.log
 */

const fs = require('fs');
const path = require('path');
const logger = require('./productionLogger');

class AuditLogger {
    constructor() {
        this.logsDir = path.join(__dirname, '../../logs');
        this.ensureLogsDir();
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
     * Format audit log entry
     * @private
     * @param {string} eventType - Type of event (USER_LOGIN, PAYMENT_SUCCESS, etc)
     * @param {Object} details - Event details
     * @returns {string} Formatted log line
     */
    formatEntry(eventType, details) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            eventType,
            ...details
        };
        return JSON.stringify(entry);
    }

    /**
     * Write to audit log file
     * @private
     * @param {string} entry - Formatted log entry
     */
    writeToFile(entry) {
        const logFile = path.join(this.logsDir, 'audit.log');
        fs.appendFileSync(logFile, entry + '\n', 'utf8');
    }

    /**
     * Log user registration event
     * @param {string} userId - Platform user ID
     * @param {string} email - User email
     * @param {string} userType - 'end_user' or 'tenant'
     * @param {Object} metadata - Additional metadata
     */
    logUserRegistration(userId, email, userType, metadata = {}) {
        const entry = this.formatEntry('USER_REGISTRATION', {
            userId,
            email,
            userType,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            status: 'success'
        });
        
        logger.security(`User registered: ${email} (${userType})`);
        this.writeToFile(entry);
    }

    /**
     * Log user login event
     * @param {string} userId - Platform user ID
     * @param {string} email - User email
     * @param {string} userType - 'end_user' or 'tenant' or 'admin'
     * @param {Object} metadata - Additional metadata
     */
    logUserLogin(userId, email, userType, metadata = {}) {
        const entry = this.formatEntry('USER_LOGIN', {
            userId,
            email,
            userType,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            status: 'success'
        });
        
        logger.security(`User logged in: ${email} (${userType})`);
        this.writeToFile(entry);
    }

    /**
     * Log user logout event
     * @param {string} userId - Platform user ID
     * @param {string} userType - 'end_user' or 'tenant' or 'admin'
     * @param {Object} metadata - Additional metadata
     */
    logUserLogout(userId, userType, metadata = {}) {
        const entry = this.formatEntry('USER_LOGOUT', {
            userId,
            userType,
            ipAddress: metadata.ipAddress,
            status: 'success'
        });
        
        logger.info(`User logged out: ${userId} (${userType})`);
        this.writeToFile(entry);
    }

    /**
     * Log failed authentication attempt
     * @param {string} email - Email attempted
     * @param {string} userType - Type of user
     * @param {string} reason - Failure reason (invalid_credentials, not_found, etc)
     * @param {Object} metadata - Additional metadata
     */
    logAuthFailure(email, userType, reason, metadata = {}) {
        const entry = this.formatEntry('AUTH_FAILURE', {
            email,
            userType,
            reason,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            status: 'failed'
        });
        
        logger.security(`Auth failed: ${email} - ${reason}`);
        this.writeToFile(entry);
    }

    /**
     * Log payment processing attempt
     * @param {string} transactionId - Transaction ID
     * @param {string} userId - User ID (PlatformUser)
     * @param {number} amount - Payment amount
     * @param {string} currency - Currency code (SAR, USD, etc)
     * @param {string} status - 'success', 'failed', 'pending'
     * @param {Object} details - Additional details
     */
    logPaymentAttempt(transactionId, userId, amount, currency, status, details = {}) {
        const entry = this.formatEntry('PAYMENT_ATTEMPT', {
            transactionId,
            userId,
            amount,
            currency,
            status,
            paymentMethod: details.paymentMethod,
            ipAddress: details.ipAddress,
            errorCode: details.errorCode,
            description: details.description
        });
        
        if (status === 'success') {
            logger.security(`Payment processed: ${transactionId} - ${amount} ${currency}`);
        } else {
            logger.security(`Payment failed: ${transactionId} - ${details.description || 'Unknown error'}`);
        }
        this.writeToFile(entry);
    }

    /**
     * Log appointment creation
     * @param {string} appointmentId - Appointment ID
     * @param {string} userId - Customer user ID
     * @param {string} tenantId - Tenant ID
     * @param {string} serviceId - Service ID
     * @param {string} staffId - Staff ID
     * @param {Object} metadata - Additional metadata (date, time, etc)
     */
    logAppointmentCreation(appointmentId, userId, tenantId, serviceId, staffId, metadata = {}) {
        const entry = this.formatEntry('APPOINTMENT_CREATED', {
            appointmentId,
            userId,
            tenantId,
            serviceId,
            staffId,
            appointmentDate: metadata.appointmentDate,
            appointmentTime: metadata.appointmentTime,
            status: 'success'
        });
        
        logger.info(`Appointment created: ${appointmentId} for user ${userId}`);
        this.writeToFile(entry);
    }

    /**
     * Log appointment cancellation
     * @param {string} appointmentId - Appointment ID
     * @param {string} cancelledBy - User ID who cancelled
     * @param {string} reason - Cancellation reason
     * @param {Object} metadata - Additional metadata
     */
    logAppointmentCancellation(appointmentId, cancelledBy, reason, metadata = {}) {
        const entry = this.formatEntry('APPOINTMENT_CANCELLED', {
            appointmentId,
            cancelledBy,
            reason,
            refundIssued: metadata.refundIssued || false,
            refundAmount: metadata.refundAmount,
            status: 'success'
        });
        
        logger.info(`Appointment cancelled: ${appointmentId} - ${reason}`);
        this.writeToFile(entry);
    }

    /**
     * Log appointment modification
     * @param {string} appointmentId - Appointment ID
     * @param {string} modifiedBy - User ID who modified
     * @param {Object} changes - What was changed {field: {old, new}}
     */
    logAppointmentModification(appointmentId, modifiedBy, changes = {}) {
        const entry = this.formatEntry('APPOINTMENT_MODIFIED', {
            appointmentId,
            modifiedBy,
            changes,
            status: 'success'
        });
        
        logger.info(`Appointment modified: ${appointmentId}`);
        this.writeToFile(entry);
    }

    /**
     * Log admin settings change
     * @param {string} adminId - Admin user ID
     * @param {string} setting - Setting name/key
     * @param {any} oldValue - Previous value
     * @param {any} newValue - New value
     * @param {Object} metadata - Additional metadata
     */
    logSettingChange(adminId, setting, oldValue, newValue, metadata = {}) {
        const entry = this.formatEntry('SETTING_CHANGED', {
            adminId,
            setting,
            oldValue,
            newValue,
            changeType: metadata.changeType || 'config',
            status: 'success'
        });
        
        logger.security(`Setting changed: ${setting} by admin ${adminId}`);
        this.writeToFile(entry);
    }

    /**
     * Log permission/role change
     * @param {string} adminId - Admin who made change
     * @param {string} targetUserId - User whose permissions changed
     * @param {Object} oldPermissions - Previous permissions
     * @param {Object} newPermissions - New permissions
     * @param {string} reason - Reason for change
     */
    logPermissionChange(adminId, targetUserId, oldPermissions, newPermissions, reason = '') {
        const entry = this.formatEntry('PERMISSION_CHANGED', {
            adminId,
            targetUserId,
            oldPermissions,
            newPermissions,
            reason,
            status: 'success'
        });
        
        logger.security(`Permissions changed for user ${targetUserId} by admin ${adminId}`);
        this.writeToFile(entry);
    }

    /**
     * Log data export
     * @param {string} userId - User ID who exported
     * @param {string} dataType - Type of data (reports, customers, transactions)
     * @param {number} recordCount - Number of records exported
     * @param {Object} filters - Export filters applied
     */
    logDataExport(userId, dataType, recordCount, filters = {}) {
        const entry = this.formatEntry('DATA_EXPORTED', {
            userId,
            dataType,
            recordCount,
            filters,
            status: 'success'
        });
        
        logger.security(`Data exported: ${dataType} (${recordCount} records) by user ${userId}`);
        this.writeToFile(entry);
    }

    /**
     * Log rate limit trigger (security event)
     * @param {string} ipAddress - IP that triggered limit
     * @param {string} endpoint - Endpoint path
     * @param {number} requests - Number of requests in window
     * @param {number} limit - Rate limit threshold
     */
    logRateLimitExceeded(ipAddress, endpoint, requests, limit) {
        const entry = this.formatEntry('RATE_LIMIT_EXCEEDED', {
            ipAddress,
            endpoint,
            requests,
            limit,
            status: 'blocked'
        });
        
        logger.security(`Rate limit exceeded: ${endpoint} from ${ipAddress} (${requests}/${limit})`);
        this.writeToFile(entry);
    }

    /**
     * Log suspicious activity
     * @param {string} eventType - Type of suspicious activity
     * @param {string} userId - User ID (if known)
     * @param {Object} details - Event details
     */
    logSuspiciousActivity(eventType, userId, details = {}) {
        const entry = this.formatEntry('SUSPICIOUS_ACTIVITY', {
            eventType,
            userId,
            ...details,
            status: 'alert'
        });
        
        logger.security(`🚨 Suspicious activity: ${eventType}` + (userId ? ` (User: ${userId})` : ''));
        this.writeToFile(entry);
    }

    /**
     * Get audit logs for a specific date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Array of log entries matching date range
     */
    getAuditLogs(startDate, endDate) {
        const logFile = path.join(this.logsDir, 'audit.log');
        
        if (!fs.existsSync(logFile)) {
            return [];
        }

        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        return lines
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(entry => {
                if (!entry) return false;
                const entryDate = new Date(entry.timestamp);
                return entryDate >= startDate && entryDate <= endDate;
            });
    }

    /**
     * Get audit logs by event type
     * @param {string} eventType - Event type to filter
     * @param {number} limit - Max results to return
     * @returns {Array} Array of matching log entries
     */
    getLogsByEventType(eventType, limit = 100) {
        const logFile = path.join(this.logsDir, 'audit.log');
        
        if (!fs.existsSync(logFile)) {
            return [];
        }

        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        return lines
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(entry => entry && entry.eventType === eventType)
            .slice(-limit)
            .reverse();
    }
}

module.exports = new AuditLogger();
