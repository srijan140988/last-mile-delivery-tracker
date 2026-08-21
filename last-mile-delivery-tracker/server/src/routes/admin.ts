import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { authenticate, authorize } from "../middleware/auth";
import { hashPassword } from "../utils/auth";
import { z } from "zod";

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

// GET /api/admin/customers
router.get(
  "/customers",
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      include: { user: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(customers);
  })
);

const createAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  currentZoneId: z.string().uuid().optional(),
});

// POST /api/admin/agents — admin provisions a new delivery agent account.
router.post(
  "/agents",
  asyncHandler(async (req, res) => {
    const data = createAgentSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw ApiError.conflict("An account with this email already exists");

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: Role.AGENT,
        agent: { create: { currentZoneId: data.currentZoneId } },
      },
      include: { agent: true },
    });
    res.status(201).json(user);
  })
);

export default router;
