class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message    Human-readable message returned to the client
   * @param {Array<{field: string, message: string}>} [details] Optional per-field problems
   */
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = ApiError;
