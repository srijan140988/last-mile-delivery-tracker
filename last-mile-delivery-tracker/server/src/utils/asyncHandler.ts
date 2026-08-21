import { NextFunction, Request, Response } from "express";

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Wraps an async route handler so rejected promises are forwarded to
// Express's centralized error handler instead of crashing the process.
export const asyncHandler = (fn: AsyncFn) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
