/**
 * @module @formwork/core/exceptions
 * @description HTTP-facing exceptions.
 */
import { CarpenterError } from "./base.js";
/**
 * HTTP-facing error with a numeric `statusCode` for adapters to map to responses.
 */
export class HttpException extends CarpenterError {
    statusCode;
    constructor(statusCode, message, context = {}) {
        super(message, "HTTP_ERROR", context);
        this.statusCode = statusCode;
    }
}
/**
 * 404 response helper.
 */
export class NotFoundError extends HttpException {
    constructor(message = "Not Found") {
        super(404, message);
        this.code = "NOT_FOUND";
    }
}
/**
 * 422 validation response with field → messages map.
 */
export class ValidationError extends HttpException {
    errors;
    constructor(errors) {
        super(422, "Validation failed", { errors });
        this.code = "VALIDATION_ERROR";
        this.errors = errors;
    }
}
/**
 * 401 unauthenticated.
 */
export class AuthenticationError extends HttpException {
    constructor(message = "Unauthenticated") {
        super(401, message);
        this.code = "UNAUTHENTICATED";
    }
}
/**
 * 403 forbidden.
 */
export class AuthorizationError extends HttpException {
    constructor(message = "Forbidden") {
        super(403, message);
        this.code = "UNAUTHORIZED";
    }
}
/**
 * 405 with allowed methods in context.
 */
export class MethodNotAllowedError extends HttpException {
    constructor(method, allowedMethods) {
        super(405, `Method ${method} not allowed`, { method, allowedMethods });
        this.code = "METHOD_NOT_ALLOWED";
    }
}
/**
 * 429 rate limit with `retryAfter` seconds.
 */
export class TooManyRequestsError extends HttpException {
    retryAfter;
    constructor(retryAfter = 60) {
        super(429, "Too Many Requests", { retryAfter });
        this.code = "TOO_MANY_REQUESTS";
        this.retryAfter = retryAfter;
    }
}
//# sourceMappingURL=http.js.map