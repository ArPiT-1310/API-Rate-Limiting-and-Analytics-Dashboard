import RequestLog from '../models/RequestLog.js';

/**
 * Creates and saves a RequestLog document in the database.
 * Designed to be run with fire-and-forget semantics.
 * 
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.projectId - The project ID reference
 * @param {string} params.endpoint - The requested path (e.g. "/posts/1")
 * @param {string} params.method - The HTTP method (GET, POST, etc.)
 * @param {number} params.statusCode - The HTTP response status code
 * @param {number} params.responseTimeMs - Elapsed response time in milliseconds
 * @param {boolean} [params.wasRateLimited=false] - Whether the request was blocked by the rate limiter
 * @param {string} [params.ipAddress] - Client's IP address
 * @param {boolean} [params.testDelayLogging=false] - Simulate artificial logging delay for tests
 * @param {boolean} [params.testFailLogging=false] - Simulate a database/logging failure for tests
 * @returns {Promise<object>} The saved RequestLog document
 */
export async function logRequest({
  projectId,
  endpoint,
  method,
  statusCode,
  responseTimeMs,
  wasRateLimited = false,
  ipAddress,
  testDelayLogging = false,
  testFailLogging = false,
}) {
  if (testDelayLogging) {
    // Artificial delay to verify non-blocking fire-and-forget logic
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (testFailLogging) {
    // Artificial failure to verify error handling doesn't crash the proxy
    throw new Error('Simulated database write failure in logRequest');
  }

  const log = new RequestLog({
    projectId,
    endpoint,
    method,
    statusCode,
    responseTimeMs,
    wasRateLimited,
    ipAddress,
  });
  return await log.save();
}
