import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { authenticate, authorize } from "../middleware/auth";
import { zoneSchema } from "../utils/schemas";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const zones = await prisma.zone.findMany({
      include: { _count: { select: { areas: true, agents: true } } },
      orderBy: { name: "asc" },
    });
    res.json(zones);
  })
);

router.post(
  "/",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = zoneSchema.parse(req.body);
    const zone = await prisma.zone.create({ data });
    res.status(201).json(zone);
  })
);

router.patch(
  "/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = zoneSchema.partial().parse(req.body);
    const zone = await prisma.zone.update({ where: { id: req.params.id }, data });
    res.json(zone);
  })
);

router.delete(
  "/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const areaCount = await prisma.area.count({ where: { zoneId: req.params.id } });
    if (areaCount > 0) {
      throw ApiError.conflict("Cannot delete a zone that still has areas mapped to it. Reassign or delete those areas first.");
    }
    await prisma.zone.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
