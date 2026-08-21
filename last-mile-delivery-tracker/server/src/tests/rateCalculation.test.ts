import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateChargeableWeight } from "../services/rateCalculationService";

// ---------------------------------------------------------------------------
// Pure-function tests: volumetric / chargeable weight math.
// No DB required — these exercise the formulas exactly as specified in the
// PDF: volumetric = L*B*H/5000, chargeable = max(actual, volumetric).
// ---------------------------------------------------------------------------

describe("calculateChargeableWeight", () => {
  it("uses actual weight when actual weight is greater than volumetric weight", () => {
    // volumetric = (20*20*10)/5000 = 0.8kg, actual = 5kg -> chargeable = 5kg
    const result = calculateChargeableWeight(20, 20, 10, 5);
    expect(result.volumetricWeightKg).toBe(0.8);
    expect(result.chargeableWeightKg).toBe(5);
  });

  it("uses volumetric weight when volumetric weight is greater than actual weight", () => {
    // volumetric = (50*40*30)/5000 = 12kg, actual = 2kg -> chargeable = 12kg
    const result = calculateChargeableWeight(50, 40, 30, 2);
    expect(result.volumetricWeightKg).toBe(12);
    expect(result.chargeableWeightKg).toBe(12);
  });

  it("rounds volumetric weight to 2 decimal places", () => {
    // volumetric = (33*17*11)/5000 = 1.2342 -> 1.23
    const result = calculateChargeableWeight(33, 17, 11, 1);
    expect(result.volumetricWeightKg).toBe(1.23);
  });

  it("throws when any dimension is zero or negative", () => {
    expect(() => calculateChargeableWeight(0, 10, 10, 1)).toThrow();
    expect(() => calculateChargeableWeight(10, -5, 10, 1)).toThrow();
    expect(() => calculateChargeableWeight(10, 10, 0, 1)).toThrow();
  });

  it("throws when actual weight is zero or negative", () => {
    expect(() => calculateChargeableWeight(10, 10, 10, 0)).toThrow();
    expect(() => calculateChargeableWeight(10, 10, 10, -1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration-style tests for calculateOrderPrice, with the Prisma client
// mocked so these run without a live database. Covers same-zone/inter-zone,
// B2B/B2C, COD/Prepaid, and missing-rate-card error handling.
// ---------------------------------------------------------------------------

vi.mock("../lib/prisma", () => {
  const zones: Record<string, { id: string; name: string }> = {
    "zone-a": { id: "zone-a", name: "Zone A" },
    "zone-b": { id: "zone-b", name: "Zone B" },
  };

  const rateCards = [
    { id: "r1", orderType: "B2C", rateType: "INTRA_ZONE", zoneId: "zone-a", fromZoneId: null, toZoneId: null, ratePerKg: 25, isActive: true },
    { id: "r2", orderType: "B2B", rateType: "INTRA_ZONE", zoneId: "zone-a", fromZoneId: null, toZoneId: null, ratePerKg: 18, isActive: true },
    { id: "r3", orderType: "B2C", rateType: "INTER_ZONE", zoneId: null, fromZoneId: "zone-a", toZoneId: "zone-b", ratePerKg: 40, isActive: true },
  ];

  const codConfigs: Record<string, { orderType: string; flatFee: number; percentage: number; isActive: boolean }> = {
    B2C: { orderType: "B2C", flatFee: 20, percentage: 2, isActive: true },
    B2B: { orderType: "B2B", flatFee: 15, percentage: 1.5, isActive: true },
  };

  return {
    prisma: {
      zone: {
        findUnique: vi.fn(async ({ where: { id } }: any) => zones[id] ?? null),
      },
      rateCard: {
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            rateCards.find((r) => {
              if (r.orderType !== where.orderType || r.rateType !== where.rateType) return false;
              if (where.rateType === "INTRA_ZONE") return r.zoneId === where.zoneId;
              return r.fromZoneId === where.fromZoneId && r.toZoneId === where.toZoneId;
            }) ?? null
          );
        }),
      },
      codSurchargeConfig: {
        findUnique: vi.fn(async ({ where: { orderType } }: any) => codConfigs[orderType] ?? null),
      },
    },
  };
});

describe("calculateOrderPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates same-zone B2C pricing correctly (no COD)", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    const result = await calculateOrderPrice({
      lengthCm: 20,
      breadthCm: 20,
      heightCm: 10,
      actualWeightKg: 5,
      orderType: "B2C" as any,
      paymentType: "PREPAID" as any,
      pickupZoneId: "zone-a",
      dropZoneId: "zone-a",
    });
    expect(result.rateType).toBe("INTRA_ZONE");
    expect(result.ratePerKg).toBe(25);
    expect(result.chargeableWeightKg).toBe(5);
    expect(result.baseCharge).toBe(125);
    expect(result.codSurcharge).toBe(0);
    expect(result.totalCharge).toBe(125);
  });

  it("calculates same-zone B2B pricing correctly", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    const result = await calculateOrderPrice({
      lengthCm: 20,
      breadthCm: 20,
      heightCm: 10,
      actualWeightKg: 5,
      orderType: "B2B" as any,
      paymentType: "PREPAID" as any,
      pickupZoneId: "zone-a",
      dropZoneId: "zone-a",
    });
    expect(result.ratePerKg).toBe(18);
    expect(result.baseCharge).toBe(90);
  });

  it("calculates inter-zone B2C pricing correctly", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    const result = await calculateOrderPrice({
      lengthCm: 30,
      breadthCm: 30,
      heightCm: 30,
      actualWeightKg: 1,
      orderType: "B2C" as any,
      paymentType: "PREPAID" as any,
      pickupZoneId: "zone-a",
      dropZoneId: "zone-b",
    });
    // volumetric = 27000/5000 = 5.4kg (> actual 1kg) -> chargeable 5.4kg
    expect(result.rateType).toBe("INTER_ZONE");
    expect(result.chargeableWeightKg).toBe(5.4);
    expect(result.baseCharge).toBe(216); // 5.4 * 40
  });

  it("applies COD surcharge (flat fee + percentage of base charge)", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    const result = await calculateOrderPrice({
      lengthCm: 20,
      breadthCm: 20,
      heightCm: 10,
      actualWeightKg: 5,
      orderType: "B2C" as any,
      paymentType: "COD" as any,
      pickupZoneId: "zone-a",
      dropZoneId: "zone-a",
    });
    // base = 125, COD = 20 + 2% of 125 = 20 + 2.5 = 22.5
    expect(result.baseCharge).toBe(125);
    expect(result.codSurcharge).toBe(22.5);
    expect(result.totalCharge).toBe(147.5);
  });

  it("does not apply COD surcharge for prepaid orders", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    const result = await calculateOrderPrice({
      lengthCm: 20,
      breadthCm: 20,
      heightCm: 10,
      actualWeightKg: 5,
      orderType: "B2C" as any,
      paymentType: "PREPAID" as any,
      pickupZoneId: "zone-a",
      dropZoneId: "zone-a",
    });
    expect(result.codSurcharge).toBe(0);
  });

  it("throws a meaningful error when no rate card is configured for the lane", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    await expect(
      calculateOrderPrice({
        lengthCm: 20,
        breadthCm: 20,
        heightCm: 10,
        actualWeightKg: 5,
        orderType: "B2B" as any,
        paymentType: "PREPAID" as any,
        pickupZoneId: "zone-b", // no B2B intra-zone rate configured for zone-b in the mock
        dropZoneId: "zone-b",
      })
    ).rejects.toThrow(/rate card/i);
  });

  it("throws for an unknown zone id", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    await expect(
      calculateOrderPrice({
        lengthCm: 20,
        breadthCm: 20,
        heightCm: 10,
        actualWeightKg: 5,
        orderType: "B2C" as any,
        paymentType: "PREPAID" as any,
        pickupZoneId: "zone-does-not-exist",
        dropZoneId: "zone-a",
      })
    ).rejects.toThrow(/pickup zone/i);
  });

  it("rejects invalid dimensions before hitting the database", async () => {
    const { calculateOrderPrice } = await import("../services/rateCalculationService");
    await expect(
      calculateOrderPrice({
        lengthCm: 0,
        breadthCm: 20,
        heightCm: 10,
        actualWeightKg: 5,
        orderType: "B2C" as any,
        paymentType: "PREPAID" as any,
        pickupZoneId: "zone-a",
        dropZoneId: "zone-a",
      })
    ).rejects.toThrow(/dimensions/i);
  });
});
