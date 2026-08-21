import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { authenticate, authorize } from "../middleware/auth";
import {
  calculatePriceSchema,
  createOrderSchema,
  assignAgentSchema,
  updateStatusSchema,
  rescheduleSchema,
} from "../utils/schemas";
import { calculateOrderPrice } from "../services/rateCalculationService";
import { detectZoneForPostcode } from "../services/zoneDetectionService";
import { assignAgentToOrder, findBestAgent } from "../services/agentAssignmentService";
import { generateOrderNumber } from "../utils/orderNumber";
import { transitionOrderStatus, applyAdminOverride, notifyAfterTransition } from "../services/orderLifecycleService";
import { notifyOrderStatus, notifyCustom, buildReassignedContent } from "../services/notificationService";

const router = Router();
router.use(authenticate);

// Resolves the customerId to operate on: customers always operate on their
// own profile; admins may create/view orders for any customer via body/query.
async function resolveCustomerId(req: any, explicitCustomerId?: string): Promise<string> {
  if (req.user.role === Role.ADMIN) {
    if (!explicitCustomerId) throw ApiError.badRequest("customerId is required when an admin creates an order");
    return explicitCustomerId;
  }
  if (req.user.role !== Role.CUSTOMER) throw ApiError.forbidden("Only customers or admins can perform this action");
  if (!req.user.profileId) throw ApiError.badRequest("No customer profile linked to this account");
  return req.user.profileId;
}

// POST /api/orders/calculate-price — preview the charge before an order is created.
router.post(
  "/calculate-price",
  asyncHandler(async (req, res) => {
    const data = calculatePriceSchema.parse(req.body);
    const pickupZone = await detectZoneForPostcode(data.pickupPincode);
    const dropZone = await detectZoneForPostcode(data.dropPincode);

    const result = await calculateOrderPrice({
      lengthCm: data.lengthCm,
      breadthCm: data.breadthCm,
      heightCm: data.heightCm,
      actualWeightKg: data.actualWeightKg,
      orderType: data.orderType,
      paymentType: data.paymentType,
      pickupZoneId: pickupZone.zoneId,
      dropZoneId: dropZone.zoneId,
    });

    res.json(result);
  })
);

// POST /api/orders — create an order (customer for self, or admin on behalf of a customer).
router.post(
  "/",
  authorize(Role.CUSTOMER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = createOrderSchema.parse(req.body);
    const customerId = await resolveCustomerId(req, data.customerId);

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw ApiError.notFound("Customer not found");

    const pickupZone = await detectZoneForPostcode(data.pickupPincode);
    const dropZone = await detectZoneForPostcode(data.dropPincode);

    const priced = await calculateOrderPrice({
      lengthCm: data.lengthCm,
      breadthCm: data.breadthCm,
      heightCm: data.heightCm,
      actualWeightKg: data.actualWeightKg,
      orderType: data.orderType,
      paymentType: data.paymentType,
      pickupZoneId: pickupZone.zoneId,
      dropZoneId: dropZone.zoneId,
    });

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId,
          createdByUserId: req.user!.userId,
          createdByRole: req.user!.role,
          pickupAddress: data.pickupAddress,
          pickupPincode: data.pickupPincode,
          pickupZoneId: pickupZone.zoneId,
          dropAddress: data.dropAddress,
          dropPincode: data.dropPincode,
          dropZoneId: dropZone.zoneId,
          lengthCm: data.lengthCm,
          breadthCm: data.breadthCm,
          heightCm: data.heightCm,
          actualWeightKg: data.actualWeightKg,
          volumetricWeightKg: priced.volumetricWeightKg,
          chargeableWeightKg: priced.chargeableWeightKg,
          orderType: data.orderType,
          paymentType: data.paymentType,
          rateType: priced.rateType,
          ratePerKg: priced.ratePerKg,
          baseCharge: priced.baseCharge,
          codSurcharge: priced.codSurcharge,
          totalCharge: priced.totalCharge,
          status: "CREATED",
          preferredDeliveryDate: data.preferredDeliveryDate ? new Date(data.preferredDeliveryDate) : undefined,
        },
      });

      await tx.trackingEvent.create({
        data: {
          orderId: created.id,
          previousStatus: null,
          newStatus: "CREATED",
          actorId: req.user!.userId,
          actorRole: req.user!.role,
          remarks: "Order created",
        },
      });

      return created;
    });

    await notifyOrderStatus(order.id, "CREATED");

    res.status(201).json(order);
  })
);

// GET /api/orders — list orders. Customers see only their own; agents see
// only orders assigned to them; admins see everything with filters.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, zone, agentId, date, page = "1", pageSize = "20" } = req.query as Record<string, string>;

    const where: any = {};

    if (req.user!.role === Role.CUSTOMER) {
      where.customerId = req.user!.profileId;
    } else if (req.user!.role === Role.AGENT) {
      where.assignments = { some: { agentId: req.user!.profileId, status: "ACTIVE" } };
    } else if (agentId) {
      where.assignments = { some: { agentId, status: "ACTIVE" } };
    }

    if (status) where.status = status;
    if (zone) where.OR = [{ pickupZoneId: zone }, { dropZoneId: zone }];
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.createdAt = { gte: start, lt: end };
    }

    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          pickupZone: true,
          dropZone: true,
          customer: { include: { user: true } },
          assignments: { where: { status: "ACTIVE" }, include: { agent: { include: { user: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: Number(page), pageSize: take });
  })
);

// GET /api/orders/:id — order detail, with access control.
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        pickupZone: true,
        dropZone: true,
        customer: { include: { user: true } },
        assignments: { include: { agent: { include: { user: true } } }, orderBy: { createdAt: "desc" } },
        trackingEvents: { orderBy: { createdAt: "asc" } },
        reschedules: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) throw ApiError.notFound("Order not found");

    if (req.user!.role === Role.CUSTOMER && order.customerId !== req.user!.profileId) {
      throw ApiError.forbidden("You can only view your own orders");
    }
    if (req.user!.role === Role.AGENT) {
      const isAssigned = order.assignments.some((a) => a.agentId === req.user!.profileId);
      if (!isAssigned) throw ApiError.forbidden("You can only view orders assigned to you");
    }

    res.json(order);
  })
);

// GET /api/orders/:id/tracking — the full immutable tracking timeline.
router.get(
  "/:id/tracking",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw ApiError.notFound("Order not found");
    if (req.user!.role === Role.CUSTOMER && order.customerId !== req.user!.profileId) {
      throw ApiError.forbidden("You can only view your own orders");
    }
    const events = await prisma.trackingEvent.findMany({
      where: { orderId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(events);
  })
);

// POST /api/orders/:id/assign — admin manually assigns a specific agent.
router.post(
  "/:id/assign",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = assignAgentSchema.parse(req.body);
    if (!data.agentId) throw ApiError.badRequest("agentId is required for manual assignment");
    const assignment = await assignAgentToOrder({
      orderId: req.params.id,
      agentId: data.agentId,
      assignedByUserId: req.user!.userId,
      reason: data.reason,
    });
    res.json(assignment);
  })
);

// POST /api/orders/:id/auto-assign — admin triggers automatic nearest-agent assignment.
router.post(
  "/:id/auto-assign",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const assignment = await assignAgentToOrder({
      orderId: req.params.id,
      assignedByUserId: req.user!.userId,
    });
    res.json(assignment);
  })
);

// PATCH /api/orders/:id/status — agent progresses status; admin can override.
router.patch(
  "/:id/status",
  authorize(Role.AGENT, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = updateStatusSchema.parse(req.body);

    if (req.user!.role === Role.AGENT) {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { assignments: { where: { status: "ACTIVE" } } },
      });
      if (!order) throw ApiError.notFound("Order not found");
      const isAssigned = order.assignments.some((a) => a.agentId === req.user!.profileId);
      if (!isAssigned) throw ApiError.forbidden("You can only update orders assigned to you");
    }

    const useOverride = data.override && req.user!.role === Role.ADMIN;

    const updated = useOverride
      ? await applyAdminOverride({
          orderId: req.params.id,
          newStatus: data.status,
          actorId: req.user!.userId,
          actorRole: req.user!.role,
          remarks: data.remarks,
        })
      : await transitionOrderStatus({
          orderId: req.params.id,
          newStatus: data.status,
          actorId: req.user!.userId,
          actorRole: req.user!.role,
          remarks: data.remarks,
        });

    // FAILED requires a reason and triggers the failed-delivery flow.
    if (data.status === "FAILED") {
      await prisma.reschedule.create({
        data: {
          orderId: req.params.id,
          failureReason: data.failureReason ?? data.remarks ?? "Delivery attempt failed",
          requestedDate: new Date(), // placeholder until customer picks a real date
          requestedByUserId: req.user!.userId,
        },
      });
      await notifyOrderStatus(req.params.id, "FAILED", data.failureReason ?? data.remarks);
    } else {
      await notifyAfterTransition(req.params.id, data.status);
    }

    res.json(updated);
  })
);

// POST /api/orders/:id/reschedule — customer selects a new delivery date
// after a failed attempt; system reassigns an agent for the new attempt.
router.post(
  "/:id/reschedule",
  authorize(Role.CUSTOMER, Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = rescheduleSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw ApiError.notFound("Order not found");
    if (req.user!.role === Role.CUSTOMER && order.customerId !== req.user!.profileId) {
      throw ApiError.forbidden("You can only reschedule your own orders");
    }
    if (order.status !== "FAILED") {
      throw ApiError.badRequest(`Only orders with status FAILED can be rescheduled (current status: ${order.status})`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.reschedule.create({
        data: {
          orderId: order.id,
          failureReason: "Customer-requested reschedule",
          requestedDate: new Date(data.requestedDate),
          requestedByUserId: req.user!.userId,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: "RESCHEDULED", preferredDeliveryDate: new Date(data.requestedDate) },
      });
      await tx.trackingEvent.create({
        data: {
          orderId: order.id,
          previousStatus: "FAILED",
          newStatus: "RESCHEDULED",
          actorId: req.user!.userId,
          actorRole: req.user!.role,
          remarks: `Rescheduled for ${data.requestedDate}`,
        },
      });
    });

    await notifyOrderStatus(order.id, "RESCHEDULED", new Date(data.requestedDate).toDateString());

    // Reassign an eligible agent for the rescheduled attempt.
    try {
      const assignment = await assignAgentToOrder({
        orderId: order.id,
        assignedByUserId: req.user!.userId,
        reason: "Reassignment after failed delivery / reschedule",
      });
      const agent = await prisma.deliveryAgent.findUnique({ where: { id: assignment.agentId }, include: { user: true } });
      if (agent) {
        const content = buildReassignedContent(order.orderNumber, agent.user.name);
        await notifyCustom(order.id, content.subject, content.body);
      }
    } catch (err) {
      // No agent available right now — order stays RESCHEDULED/ASSIGNED-pending;
      // admin can retry auto-assign or assign manually later.
    }

    const refreshed = await prisma.order.findUnique({
      where: { id: order.id },
      include: { assignments: { where: { status: "ACTIVE" }, include: { agent: { include: { user: true } } } } },
    });
    res.json(refreshed);
  })
);

export default router;
