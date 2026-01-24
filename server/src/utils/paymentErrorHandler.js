/**
 * Payment Error Handler
 * Defines specific error types and handling for payment operations
 */

class PaymentError extends Error {
    constructor(message, code, statusCode = 400, details = {}) {
        super(message);
        this.name = 'PaymentError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
    }
}

class PaymentValidationError extends PaymentError {
    constructor(message, details = {}) {
        super(message, 'PAYMENT_VALIDATION_ERROR', 400, details);
        this.name = 'PaymentValidationError';
    }
}

class CardValidationError extends PaymentError {
    constructor(message, details = {}) {
        super(message, 'CARD_VALIDATION_ERROR', 400, details);
        this.name = 'CardValidationError';
    }
}

class PaymentDeclinedError extends PaymentError {
    constructor(message, reason, details = {}) {
        super(message, 'PAYMENT_DECLINED', 402, {
            reason,
            ...details
        });
        this.name = 'PaymentDeclinedError';
    }
}

class InsufficientFundsError extends PaymentError {
    constructor(required, available, details = {}) {
        super(
            `Insufficient funds. Required: $${required}, Available: $${available}`,
            'INSUFFICIENT_FUNDS',
            402,
            { required, available, ...details }
        );
        this.name = 'InsufficientFundsError';
    }
}

class PaymentProcessingError extends PaymentError {
    constructor(message, originalError, details = {}) {
        super(message, 'PAYMENT_PROCESSING_ERROR', 500, details);
        this.name = 'PaymentProcessingError';
        this.originalError = originalError;
    }
}

class DuplicateTransactionError extends PaymentError {
    constructor(transactionId, details = {}) {
        super(
            `Duplicate transaction detected for ID: ${transactionId}`,
            'DUPLICATE_TRANSACTION',
            409,
            { transactionId, ...details }
        );
        this.name = 'DuplicateTransactionError';
    }
}

class TransactionTimeoutError extends PaymentError {
    constructor(message, details = {}) {
        super(message, 'TRANSACTION_TIMEOUT', 504, details);
        this.name = 'TransactionTimeoutError';
    }
}

class PaymentMethodError extends PaymentError {
    constructor(message, details = {}) {
        super(message, 'PAYMENT_METHOD_ERROR', 400, details);
        this.name = 'PaymentMethodError';
    }
}

class CurrencyError extends PaymentError {
    constructor(message, details = {}) {
        super(message, 'CURRENCY_ERROR', 400, details);
        this.name = 'CurrencyError';
    }
}

/**
 * Payment Error Handler Middleware
 */
const handlePaymentError = (error, req, res, next) => {
    const logger = require('../utils/productionLogger');

    if (error instanceof PaymentError) {
        // Log the error with context
        logger.error(`Payment Error: ${error.name}`, error, {
            code: error.code,
            userId: req.userId,
            tenantId: req.tenantId,
            details: error.details
        });

        // Log security event for fraud attempts
        if (error instanceof PaymentDeclinedError) {
            logger.security('Payment declined', {
                reason: error.details.reason,
                userId: req.userId,
                amount: error.details.amount
            });
        }

        return res.status(error.statusCode).json({
            success: false,
            error: {
                type: error.code,
                message: error.message,
                details: error.details
            }
        });
    }

    // Handle generic errors
    logger.error('Unexpected payment error', error, {
        userId: req.userId,
        tenantId: req.tenantId
    });

    return res.status(500).json({
        success: false,
        error: {
            type: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred while processing your payment'
        }
    });
};

/**
 * Error Code Reference
 */
const ErrorCodes = {
    // Validation Errors (400)
    PAYMENT_VALIDATION_ERROR: {
        statusCode: 400,
        message: 'Payment validation failed',
        userMessage: 'The provided payment information is invalid'
    },
    CARD_VALIDATION_ERROR: {
        statusCode: 400,
        message: 'Card validation failed',
        userMessage: 'Please check your card details'
    },
    PAYMENT_METHOD_ERROR: {
        statusCode: 400,
        message: 'Payment method error',
        userMessage: 'The selected payment method is unavailable'
    },
    CURRENCY_ERROR: {
        statusCode: 400,
        message: 'Currency error',
        userMessage: 'The specified currency is not supported'
    },

    // Payment Declined (402)
    PAYMENT_DECLINED: {
        statusCode: 402,
        message: 'Payment declined',
        userMessage: 'Your payment was declined. Please try another card'
    },
    INSUFFICIENT_FUNDS: {
        statusCode: 402,
        message: 'Insufficient funds',
        userMessage: 'Your account does not have sufficient funds'
    },

    // Conflict (409)
    DUPLICATE_TRANSACTION: {
        statusCode: 409,
        message: 'Duplicate transaction',
        userMessage: 'This transaction appears to be a duplicate'
    },

    // Timeout (504)
    TRANSACTION_TIMEOUT: {
        statusCode: 504,
        message: 'Transaction timeout',
        userMessage: 'The payment processing took too long. Please try again'
    },

    // Server Error (500)
    PAYMENT_PROCESSING_ERROR: {
        statusCode: 500,
        message: 'Payment processing error',
        userMessage: 'An error occurred while processing your payment. Please try again'
    },
    UNKNOWN_ERROR: {
        statusCode: 500,
        message: 'Unknown error',
        userMessage: 'An unexpected error occurred'
    }
};

module.exports = {
    PaymentError,
    PaymentValidationError,
    CardValidationError,
    PaymentDeclinedError,
    InsufficientFundsError,
    PaymentProcessingError,
    DuplicateTransactionError,
    TransactionTimeoutError,
    PaymentMethodError,
    CurrencyError,
    handlePaymentError,
    ErrorCodes
};
