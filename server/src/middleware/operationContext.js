const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const operationStorage = new AsyncLocalStorage();

/**
 * Runs a function within an operation context.
 * If an operationId already exists in the context, it preserves it (for nested calls).
 * If no operationId exists (a new business operation boundary), it generates a new one.
 * 
 * @param {Function} fn - The callback to execute.
 * @param {String} [name] - Optional name of the operation.
 * @returns {Promise<any>}
 */
async function runWithOperation(fn, name = 'unknown_operation') {
    const existingOpId = getOperationId();
    
    if (existingOpId) {
        // We are already inside a business operation, preserve the existing ID.
        return await fn();
    }

    // New business operation boundary, create a new operationId
    const newOperationId = crypto.randomUUID();
    
    return await operationStorage.run(newOperationId, async () => {
        return await fn();
    });
}

/**
 * Retrieves the current operationId from the AsyncLocalStorage context.
 * @returns {String|undefined} The current operationId or undefined if not in an operation context.
 */
function getOperationId() {
    return operationStorage.getStore();
}

module.exports = {
    runWithOperation,
    getOperationId
};
