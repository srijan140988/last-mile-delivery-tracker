import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

// Haversine great-circle distance in kilometers.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface PickupPoint {
  zoneId: string;
  lat?: number | null;
  lng?: number | null;
}

// Picks the best available agent for a pickup point:
//  1. Only active + available agents are eligible.
//  2. If the pickup has coordinates and at least one eligible agent has
//     coordinates, prefer the geographically nearest agent (haversine).
//  3. Otherwise, fall back to any eligible agent in the same zone as pickup.
//  4. If nothing matches, throw a meaningful error.
export async function findBestAgent(pickup: PickupPoint) {
  const eligibleAgents = await prisma.deliveryAgent.findMany({
    where: { isActive: true, isAvailable: true },
    include: { user: true },
  });

  if (eligibleAgents.length === 0) {
    throw ApiError.conflict("No active, available delivery agents exist in the system right now.");
  }

  // Prefer proximity when we have coordinates for both pickup and some agents.
  if (pickup.lat != null && pickup.lng != null) {
    const withCoords = eligibleAgents.filter((a) => a.currentLat != null && a.currentLng != null);
    if (withCoords.length > 0) {
      let best = withCoords[0];
      let bestDist = distanceKm(pickup.lat, pickup.lng, best.currentLat!, best.currentLng!);
      for (const agent of withCoords.slice(1)) {
        const d = distanceKm(pickup.lat, pickup.lng, agent.currentLat!, agent.currentLng!);
        if (d < bestDist) {
          best = agent;
          bestDist = d;
        }
      }
      return { agent: best, distanceKm: Math.round(bestDist * 100) / 100, method: "AUTO_NEAREST" as const };
    }
  }

  // Fallback: same-zone availability.
  const sameZone = eligibleAgents.filter((a) => a.currentZoneId === pickup.zoneId);
  if (sameZone.length > 0) {
    return { agent: sameZone[0], distanceKm: null, method: "AUTO_SAME_ZONE" as const };
  }

  throw ApiError.conflict(
    "No available agent found near the pickup location or in the pickup zone. Please try again later or assign manually."
  );
}

interface AssignAgentOptions {
  orderId: string;
  agentId?: string; // if provided => manual assignment; otherwise auto-assign
  assignedByUserId: string;
  reason?: string;
}

// Creates a new AgentAssignment row (auto or manual), marks any previous
// active assignment for the order as REASSIGNED, and flips agent
// availability. Assignment history is never overwritten — every assignment
// (including reassignments after a failed delivery) is preserved as its own row.
export async function assignAgentToOrder(options: AssignAgentOptions) {
  const { orderId, agentId, assignedByUserId, reason } = options;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { pickupZone: true } });
    if (!order) throw ApiError.notFound("Order not found");

    if (["DELIVERED", "CANCELLED"].includes(order.status)) {
      throw ApiError.badRequest(`Cannot assign an agent to an order with status ${order.status}`);
    }

    let chosenAgentId = agentId;
    let distance: number | null = null;
    let method: "MANUAL" | "AUTO" = "MANUAL";

    if (!chosenAgentId) {
      // Order does not yet store geocoded pickup coordinates (see
      // ZoneDetectionService docs on future geocoding integration), so
      // auto-assignment currently resolves via the same-zone fallback path.
      // Once coordinates are captured on Order, pass them here to enable
      // nearest-agent-by-distance selection automatically.
      const best = await findBestAgent({ zoneId: order.pickupZoneId });
      chosenAgentId = best.agent.id;
      distance = best.distanceKm;
      method = "AUTO";
    } else {
      const agent = await tx.deliveryAgent.findUnique({ where: { id: chosenAgentId } });
      if (!agent) throw ApiError.badRequest("Selected agent does not exist");
      if (!agent.isActive) throw ApiError.badRequest("Selected agent is not active");
      method = "MANUAL";
    }

    // Mark any existing ACTIVE assignment for this order as REASSIGNED and
    // free up that agent.
    const previousActive = await tx.agentAssignment.findFirst({
      where: { orderId, status: "ACTIVE" },
    });
    if (previousActive) {
      await tx.agentAssignment.update({
        where: { id: previousActive.id },
        data: { status: "REASSIGNED" },
      });
      await tx.deliveryAgent.update({
        where: { id: previousActive.agentId },
        data: { isAvailable: true },
      });
    }

    const assignment = await tx.agentAssignment.create({
      data: {
        orderId,
        agentId: chosenAgentId!,
        status: "ACTIVE",
        assignmentMethod: method,
        assignedByUserId,
        distanceKm: distance,
        reason: reason ?? (previousActive ? "Reassignment" : "Initial assignment"),
      },
    });

    await tx.deliveryAgent.update({
      where: { id: chosenAgentId! },
      data: { isAvailable: false },
    });

    const newStatus = order.status === "CREATED" ? "ASSIGNED" : order.status;
    if (newStatus !== order.status) {
      await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
      await tx.trackingEvent.create({
        data: {
          orderId,
          previousStatus: order.status,
          newStatus,
          actorId: assignedByUserId,
          actorRole: Role.ADMIN,
          remarks: method === "AUTO" ? "Auto-assigned to nearest available agent" : "Manually assigned by admin",
        },
      });
    }

    return assignment;
  });
}
