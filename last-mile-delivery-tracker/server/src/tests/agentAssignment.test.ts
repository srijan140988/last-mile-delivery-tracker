import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// findBestAgent is tested against a mocked Prisma client covering:
//  - nearest available agent by coordinates
//  - busy/inactive agents excluded
//  - same-zone fallback when no coordinates are available
//  - meaningful error when no agent is available at all
// ---------------------------------------------------------------------------

const agentsFixture = [
  { id: "agent-near", isActive: true, isAvailable: true, currentZoneId: "zone-a", currentLat: 28.70, currentLng: 77.10, user: { name: "Near Agent" } },
  { id: "agent-far", isActive: true, isAvailable: true, currentZoneId: "zone-a", currentLat: 29.50, currentLng: 78.50, user: { name: "Far Agent" } },
  { id: "agent-busy", isActive: true, isAvailable: false, currentZoneId: "zone-a", currentLat: 28.71, currentLng: 77.11, user: { name: "Busy Agent" } },
  { id: "agent-inactive", isActive: false, isAvailable: true, currentZoneId: "zone-a", currentLat: 28.71, currentLng: 77.11, user: { name: "Inactive Agent" } },
  { id: "agent-no-coords-samezone", isActive: true, isAvailable: true, currentZoneId: "zone-b", currentLat: null, currentLng: null, user: { name: "No Coords Agent" } },
];

vi.mock("../lib/prisma", () => ({
  prisma: {
    deliveryAgent: {
      findMany: vi.fn(async ({ where }: any) => {
        return agentsFixture.filter((a) => a.isActive === where.isActive && a.isAvailable === where.isAvailable);
      }),
    },
  },
}));

describe("findBestAgent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefers the geographically nearest available agent when coordinates exist", async () => {
    const { findBestAgent } = await import("../services/agentAssignmentService");
    const result = await findBestAgent({ zoneId: "zone-a", lat: 28.7041, lng: 77.1025 });
    expect(result.agent.id).toBe("agent-near");
    expect(result.method).toBe("AUTO_NEAREST");
  });

  it("excludes busy and inactive agents from consideration", async () => {
    const { findBestAgent } = await import("../services/agentAssignmentService");
    const result = await findBestAgent({ zoneId: "zone-a", lat: 28.7041, lng: 77.1025 });
    expect(result.agent.id).not.toBe("agent-busy");
    expect(result.agent.id).not.toBe("agent-inactive");
  });

  it("falls back to same-zone availability when no coordinates are provided", async () => {
    const { findBestAgent } = await import("../services/agentAssignmentService");
    const result = await findBestAgent({ zoneId: "zone-b" });
    expect(result.agent.id).toBe("agent-no-coords-samezone");
    expect(result.method).toBe("AUTO_SAME_ZONE");
  });

  it("throws a meaningful error when no agent is available anywhere", async () => {
    vi.doMock("../lib/prisma", () => ({
      prisma: { deliveryAgent: { findMany: vi.fn(async () => []) } },
    }));
    vi.resetModules();
    const { findBestAgent } = await import("../services/agentAssignmentService");
    await expect(findBestAgent({ zoneId: "zone-a" })).rejects.toThrow(/no active, available/i);
  });
});
