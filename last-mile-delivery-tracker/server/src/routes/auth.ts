import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { registerSchema, loginSchema } from "../utils/schemas";
import { comparePassword, hashPassword, signToken } from "../utils/auth";

const router = Router();

// POST /api/auth/register — registers a CUSTOMER account. Agent/Admin
// accounts are provisioned by an existing admin (see /api/admin/users), not
// through public self-registration.
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw ApiError.conflict("An account with this email already exists");

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: Role.CUSTOMER,
        customer: { create: { companyName: data.companyName } },
      },
      include: { customer: true },
    });

    const token = signToken({ userId: user.id, role: user.role, email: user.email, profileId: user.customer!.id });
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

// POST /api/auth/login — shared login for all roles (customer/agent/admin).
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { customer: true, agent: true },
    });
    if (!user) throw ApiError.unauthorized("Invalid email or password");

    const valid = await comparePassword(data.password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized("Invalid email or password");

    const profileId = user.customer?.id ?? user.agent?.id;
    const token = signToken({ userId: user.id, role: user.role, email: user.email, profileId });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, profileId },
    });
  })
);

// GET /api/auth/me — returns the current authenticated user's profile.
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) throw ApiError.unauthorized();
    const { verifyToken } = await import("../utils/auth");
    const payload = verifyToken(authHeader.replace("Bearer ", ""));
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { customer: true, agent: true },
    });
    if (!user) throw ApiError.notFound("User not found");
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileId: user.customer?.id ?? user.agent?.id,
    });
  })
);

export default router;
