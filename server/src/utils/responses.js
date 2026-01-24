/**
 * Standard Response Formatters
 */

const successResponse = (message, data = null, statusCode = 200) => {
  return {
    success: true,
    message,
    data,
    statusCode,
    timestamp: new Date().toISOString(),
  };
};

const errorResponse = (message, error = null, statusCode = 400) => {
  return {
    success: false,
    message,
    error: error instanceof Error ? error.message : error,
    statusCode,
    timestamp: new Date().toISOString(),
  };
};

const paginatedResponse = (data, total, page, limit) => {
  return {
    success: true,
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
};
