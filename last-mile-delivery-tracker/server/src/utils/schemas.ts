import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  companyName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const calculatePriceSchema = z.object({
  pickupPincode: z.string().min(1),
  dropPincode: z.string().min(1),
  lengthCm: z.number().positive(),
  breadthCm: z.number().positive(),
  heightCm: z.number().positive(),
  actualWeightKg: z.number().positive(),
  orderType: z.enum(["B2B", "B2C"]),
  paymentType: z.enum(["PREPAID", "COD"]),
});

export const createOrderSchema = calculatePriceSchema.extend({
  pickupAddress: z.string().min(3),
  dropAddress: z.string().min(3),
  customerId: z.string().uuid().optional(), // admin creating on behalf of a customer
  preferredDeliveryDate: z.string().datetime().optional(),
});

export const assignAgentSchema = z.object({
  agentId: z.string().uuid().optional(),
  reason: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum([
    "CREATED",
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "FAILED",
    "RESCHEDULED",
    "CANCELLED",
  ]),
  remarks: z.string().optional(),
  failureReason: z.string().optional(),
  override: z.boolean().optional(),
});

export const rescheduleSchema = z.object({
  requestedDate: z.string().datetime(),
});

export const zoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const areaSchema = z.object({
  name: z.string().min(1),
  postcode: z.string().min(1),
  zoneId: z.string().uuid(),
});

export const rateCardObjectSchema = z.object({
  orderType: z.enum(["B2B", "B2C"]),
  rateType: z.enum(["INTRA_ZONE", "INTER_ZONE"]),
  zoneId: z.string().uuid().optional(),
  fromZoneId: z.string().uuid().optional(),
  toZoneId: z.string().uuid().optional(),
  ratePerKg: z.number().positive(),
  isActive: z.boolean().optional(),
});

export const rateCardSchema = rateCardObjectSchema.refine(
  (v) => (v.rateType === "INTRA_ZONE" ? !!v.zoneId : !!(v.fromZoneId && v.toZoneId)),
  { message: "INTRA_ZONE rates require zoneId; INTER_ZONE rates require fromZoneId and toZoneId" }
);

// Separate, non-refined partial schema for PATCH — a partial update may
// legitimately touch only one field (e.g. just isActive or just ratePerKg).
export const rateCardUpdateSchema = rateCardObjectSchema.partial();

export const codSurchargeSchema = z.object({
  orderType: z.enum(["B2B", "B2C"]),
  flatFee: z.number().min(0),
  percentage: z.number().min(0),
  isActive: z.boolean().optional(),
});

export const agentAvailabilitySchema = z.object({
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const agentLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  zoneId: z.string().uuid().optional(),
});
