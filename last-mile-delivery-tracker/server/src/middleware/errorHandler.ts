import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/apiError";

// Centralized error handler — every route funnels errors here via asyncHandler.
// Response shape is always: { error: { message, details? } }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: { message: `A record with this ${(err.meta?.target as string[])?.join(", ") ?? "value"} already exists` },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: { message: "Record not found" } });
    }
    return res.status(400).json({ error: { message: "Database request error", details: err.code } });
  }

  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return res.status(500).json({ error: { message: process.env.NODE_ENV === "production" ? "Internal server error" : message } });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}
