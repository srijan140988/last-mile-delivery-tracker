import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { JwtPayload, verifyToken } from "../utils/auth";
import { ApiError } from "../utils/apiError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Verifies the Bearer token and attaches the decoded payload to req.user.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or invalid Authorization header"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired token"));
  }
}

// Restricts a route to one or more roles.
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}
