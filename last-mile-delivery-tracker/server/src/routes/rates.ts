import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate, authorize } from "../middleware/auth";
import { rateCardSchema, rateCardUpdateSchema, codSurchargeSchema } from "../utils/schemas";

const router = Router();
router.use(authenticate);

// GET /api/rates — list rate cards (admin-configurable, DB-driven).
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { orderType, rateType } = req.query as Record<string, string>;
    const rates = await prisma.rateCard.findMany({
      where: {
        ...(orderType ? { orderType: orderType as any } : {}),
        ...(rateType ? { rateType: rateType as any } : {}),
      },
      include: { zone: true, fromZone: true, toZone: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(rates);
  })
);

router.post(
  "/",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = rateCardSchema.parse(req.body);
    const rate = await prisma.rateCard.create({ data });
    res.status(201).json(rate);
  })
);

router.patch(
  "/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = rateCardUpdateSchema.parse(req.body);
    const rate = await prisma.rateCard.update({ where: { id: req.params.id }, data });
    res.json(rate);
  })
);

// --- COD surcharge configuration (separate sub-resource) ---

router.get(
  "/cod-surcharge",
  asyncHandler(async (_req, res) => {
    const configs = await prisma.codSurchargeConfig.findMany();
    res.json(configs);
  })
);

router.post(
  "/cod-surcharge",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = codSurchargeSchema.parse(req.body);
    const config = await prisma.codSurchargeConfig.upsert({
      where: { orderType: data.orderType },
      create: data,
      update: data,
    });
    res.status(201).json(config);
  })
);

export default router;
