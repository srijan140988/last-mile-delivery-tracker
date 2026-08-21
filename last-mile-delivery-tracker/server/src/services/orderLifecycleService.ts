import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { notifyOrderStatus } from "./notificationService";

// The only status transitions normal application users (agents/admins acting
// through normal APIs) are allowed to perform. Admin override bypasses this
// map entirely but still records an immutable TrackingEvent (see
// applyAdminOverride below).
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["RESCHEDULED"],
  RESCHEDULED: ["ASSIGNED", "PICKED_UP"],
  CANCELLED: [],
};

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

interface TransitionOptions {
  orderId: string;
  newStatus: OrderStatus;
  actorId: string;
  actorRole: Role;
  remarks?: string;
}

// Applies a normal (non-override) status transition: validates it against the
// allowed-transitions map, updates the order, and writes an immutable
// TrackingEvent. Throws ApiError.badRequest on an invalid transition.
export async function transitionOrderStatus(options: TransitionOptions) {
  const { orderId, newStatus, actorId, actorRole, remarks } = options;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound("Order not found");

    if (!isTransitionAllowed(order.status, newStatus)) {
      throw ApiError.badRequest(
        `Invalid status transition: ${order.status} -> ${newStatus}. Allowed next states: ${
          ALLOWED_TRANSITIONS[order.status].join(", ") || "none"
        }`
      );
    }

    const updated = await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });

    await tx.trackingEvent.create({
      data: {
        orderId,
        previousStatus: order.status,
        newStatus,
        actorId,
        actorRole,
        remarks,
        isAdminOverride: false,
      },
    });

    // Free up the agent once a delivery reaches a terminal state.
    if (newStatus === "DELIVERED" || newStatus === "FAILED") {
      const activeAssignment = await tx.agentAssignment.findFirst({ where: { orderId, status: "ACTIVE" } });
      if (activeAssignment) {
        if (newStatus === "DELIVERED") {
          await tx.agentAssignment.update({ where: { id: activeAssignment.id }, data: { status: "COMPLETED" } });
        }
        // On FAILED, the assignment row is intentionally left ACTIVE — it will
        // be marked REASSIGNED by assignAgentToOrder when a new agent is
        // assigned for the rescheduled attempt, preserving full history.
        await tx.deliveryAgent.update({ where: { id: activeAssignment.agentId }, data: { isAvailable: true } });
      }
    }

    return updated;
  });
}

// Admin override: can force ANY status transition, bypassing the normal
// state machine, but — critically — it still writes an immutable
// TrackingEvent flagged isAdminOverride=true, preserving full history.
export async function applyAdminOverride(options: TransitionOptions) {
  const { orderId, newStatus, actorId, actorRole, remarks } = options;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound("Order not found");

    const updated = await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });

    await tx.trackingEvent.create({
      data: {
        orderId,
        previousStatus: order.status,
        newStatus,
        actorId,
        actorRole,
        remarks: remarks ?? "Status manually overridden by admin",
        isAdminOverride: true,
      },
    });

    return updated;
  });
}

// Sends the post-transition notification (kept separate from the DB
// transaction above so a slow/failed email provider never rolls back the
// order's status update).
export async function notifyAfterTransition(orderId: string, newStatus: OrderStatus, extra?: string) {
  await notifyOrderStatus(orderId, newStatus, extra);
}
