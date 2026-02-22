import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that validates the Authorization header against the MCP_API_KEY
 * environment variable. Requests without a valid Bearer token receive a 401.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const apiKey = process.env.MCP_API_KEY;

  if (!apiKey) {
    // If no API key is configured the server is misconfigured – reject all.
    res.status(500).json({ error: "Server misconfigured: MCP_API_KEY not set" });
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice(7);
  if (token !== apiKey) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  next();
}
