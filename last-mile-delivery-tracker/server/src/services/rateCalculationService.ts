import { OrderType, PaymentType, RateType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export interface RateCalculationInput {
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
  pickupZoneId: string;
  dropZoneId: string;
}

export interface RateCalculationResult {
  pickupZoneId: string;
  pickupZoneName: string;
  dropZoneId: string;
  dropZoneName: string;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
  rateType: RateType;
  ratePerKg: number;
  baseCharge: number;
  codSurcharge: number;
  totalCharge: number;
}

const VOLUMETRIC_DIVISOR = 5000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Pure calculation of volumetric + chargeable weight — no I/O, easy to unit test.
export function calculateChargeableWeight(lengthCm: number, breadthCm: number, heightCm: number, actualWeightKg: number) {
  if (lengthCm <= 0 || breadthCm <= 0 || heightCm <= 0) {
    throw ApiError.badRequest("Package dimensions (length, breadth, height) must all be greater than 0");
  }
  if (actualWeightKg <= 0) {
    throw ApiError.badRequest("Actual weight must be greater than 0");
  }
  const volumetricWeightKg = round2((lengthCm * breadthCm * heightCm) / VOLUMETRIC_DIVISOR);
  const chargeableWeightKg = round2(Math.max(actualWeightKg, volumetricWeightKg));
  return { volumetricWeightKg, chargeableWeightKg };
}

// The dedicated pricing service. Looks up admin-configured rate cards from the
// database — nothing about pricing is ever hardcoded in application code.
export async function calculateOrderPrice(input: RateCalculationInput): Promise<RateCalculationResult> {
  const { lengthCm, breadthCm, heightCm, actualWeightKg, orderType, paymentType, pickupZoneId, dropZoneId } = input;

  if (!Object.values(OrderType).includes(orderType)) {
    throw ApiError.badRequest(`Invalid order type: ${orderType}`);
  }
  if (!Object.values(PaymentType).includes(paymentType)) {
    throw ApiError.badRequest(`Invalid payment type: ${paymentType}`);
  }

  const [pickupZone, dropZone] = await Promise.all([
    prisma.zone.findUnique({ where: { id: pickupZoneId } }),
    prisma.zone.findUnique({ where: { id: dropZoneId } }),
  ]);
  if (!pickupZone) throw ApiError.badRequest("Invalid or unknown pickup zone");
  if (!dropZone) throw ApiError.badRequest("Invalid or unknown drop zone");

  const { volumetricWeightKg, chargeableWeightKg } = calculateChargeableWeight(
    lengthCm,
    breadthCm,
    heightCm,
    actualWeightKg
  );

  const isIntraZone = pickupZone.id === dropZone.id;
  const rateType: RateType = isIntraZone ? "INTRA_ZONE" : "INTER_ZONE";

  const rateCard = isIntraZone
    ? await prisma.rateCard.findFirst({
        where: { orderType, rateType: "INTRA_ZONE", zoneId: pickupZone.id, isActive: true },
      })
    : await prisma.rateCard.findFirst({
        where: {
          orderType,
          rateType: "INTER_ZONE",
          fromZoneId: pickupZone.id,
          toZoneId: dropZone.id,
          isActive: true,
        },
      });

  if (!rateCard) {
    throw ApiError.badRequest(
      `No active ${orderType} ${rateType === "INTRA_ZONE" ? "intra-zone" : "inter-zone"} rate card configured for ${
        isIntraZone ? pickupZone.name : `${pickupZone.name} -> ${dropZone.name}`
      }. Ask an admin to configure rates.`
    );
  }

  const baseCharge = round2(rateCard.ratePerKg * chargeableWeightKg);

  let codSurcharge = 0;
  if (paymentType === "COD") {
    const codConfig = await prisma.codSurchargeConfig.findUnique({ where: { orderType } });
    if (codConfig && codConfig.isActive) {
      codSurcharge = round2(codConfig.flatFee + (codConfig.percentage / 100) * baseCharge);
    }
  }

  const totalCharge = round2(baseCharge + codSurcharge);

  return {
    pickupZoneId: pickupZone.id,
    pickupZoneName: pickupZone.name,
    dropZoneId: dropZone.id,
    dropZoneName: dropZone.name,
    actualWeightKg,
    volumetricWeightKg,
    chargeableWeightKg,
    orderType,
    paymentType,
    rateType,
    ratePerKg: rateCard.ratePerKg,
    baseCharge,
    codSurcharge,
    totalCharge,
  };
}
