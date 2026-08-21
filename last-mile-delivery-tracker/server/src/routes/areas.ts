import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate, authorize } from "../middleware/auth";
import { areaSchema } from "../utils/schemas";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { zoneId } = req.query as Record<string, string>;
    const areas = await prisma.area.findMany({
      where: zoneId ? { zoneId } : undefined,
      include: { zone: true },
      orderBy: { name: "asc" },
    });
    res.json(areas);
  })
);

router.post(
  "/",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = areaSchema.parse(req.body);
    const area = await prisma.area.create({ data });
    res.status(201).json(area);
  })
);

router.patch(
  "/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = areaSchema.partial().parse(req.body);
    const area = await prisma.area.update({ where: { id: req.params.id }, data });
    res.json(area);
  })
);

export default router;
