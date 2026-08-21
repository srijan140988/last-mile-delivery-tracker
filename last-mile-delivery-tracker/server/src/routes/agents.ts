import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { authenticate, authorize } from "../middleware/auth";
import { agentAvailabilitySchema, agentLocationSchema } from "../utils/schemas";

const router = Router();
router.use(authenticate);

// GET /api/agents — admin: list all agents. Agent: view own profile only via /me.
router.get(
  "/",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const { zoneId, isAvailable, isActive } = req.query as Record<string, string>;
    const agents = await prisma.deliveryAgent.findMany({
      where: {
        ...(zoneId ? { currentZoneId: zoneId } : {}),
        ...(isAvailable !== undefined ? { isAvailable: isAvailable === "true" } : {}),
        ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      },
      include: { user: true, currentZone: true, _count: { select: { assignments: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(agents);
  })
);

router.get(
  "/me",
  authorize(Role.AGENT),
  asyncHandler(async (req, res) => {
    const agent = await prisma.deliveryAgent.findUnique({
      where: { id: req.user!.profileId },
      include: { user: true, currentZone: true },
    });
    if (!agent) throw ApiError.notFound("Agent profile not found");
    res.json(agent);
  })
);

router.patch(
  "/:id/availability",
  authorize(Role.ADMIN, Role.AGENT),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.AGENT && req.user!.profileId !== req.params.id) {
      throw ApiError.forbidden("Agents may only update their own availability");
    }
    const data = agentAvailabilitySchema.parse(req.body);
    const agent = await prisma.deliveryAgent.update({ where: { id: req.params.id }, data });
    res.json(agent);
  })
);

router.patch(
  "/:id/location",
  authorize(Role.ADMIN, Role.AGENT),
  asyncHandler(async (req, res) => {
    if (req.user!.role === Role.AGENT && req.user!.profileId !== req.params.id) {
      throw ApiError.forbidden("Agents may only update their own location");
    }
    const data = agentLocationSchema.parse(req.body);
    const agent = await prisma.deliveryAgent.update({
      where: { id: req.params.id },
      data: { currentLat: data.lat, currentLng: data.lng, ...(data.zoneId ? { currentZoneId: data.zoneId } : {}) },
    });
    res.json(agent);
  })
);

export default router;
