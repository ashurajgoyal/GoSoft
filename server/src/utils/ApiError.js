export class ApiError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} message human readable message
   * @param {string} [code] stable machine-readable code the frontend can switch on
   * @param {object} [details]
   */
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg, details) { return new ApiError(400, msg, 'BAD_REQUEST', details); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, msg, 'UNAUTHORIZED'); }
  static forbidden(msg = 'You do not have permission to perform this action', code = 'FORBIDDEN', details) {
    return new ApiError(403, msg, code, details);
  }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg, 'NOT_FOUND'); }
  static conflict(msg) { return new ApiError(409, msg, 'CONFLICT'); }
  static paymentRequired(msg, code = 'SUBSCRIPTION_REQUIRED', details) { return new ApiError(402, msg, code, details); }
}
