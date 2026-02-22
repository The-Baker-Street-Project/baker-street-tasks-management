import rateLimit from "express-rate-limit";

/**
 * Rate limiter: 120 requests per minute on the /mcp endpoint.
 */
export const mcpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Max 120 requests per minute." },
});
