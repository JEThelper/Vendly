import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that records the duration of each API request and logs it.
 * Logs are emitted via console.debug with a consistent tag for easy filtering.
 */
export default function latencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // When the response finishes, calculate and log the latency.
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.debug('[LATENCY]', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
    });
  });

  next();
}
