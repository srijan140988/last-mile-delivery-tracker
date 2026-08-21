export type Role = "CUSTOMER" | "AGENT" | "ADMIN";
export type OrderType = "B2B" | "B2C";
export type PaymentType = "PREPAID" | "COD";
export type RateType = "INTRA_ZONE" | "INTER_ZONE";
export type OrderStatus =
  | "CREATED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RESCHEDULED"
  | "CANCELLED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  profileId?: string;
}

export interface Zone {
  id: string;
  name: string;
  description?: string | null;
  _count?: { areas: number; agents: number };
}

export interface Area {
  id: string;
  name: string;
  postcode: string;
  zoneId: string;
  zone?: Zone;
}

export interface RateCard {
  id: string;
  orderType: OrderType;
  rateType: RateType;
  zoneId?: string | null;
  fromZoneId?: string | null;
  toZoneId?: string | null;
  ratePerKg: number;
  isActive: boolean;
  zone?: Zone | null;
  fromZone?: Zone | null;
  toZone?: Zone | null;
}

export interface PriceBreakdown {
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

export interface AgentSummary {
  id: string;
  isActive: boolean;
  isAvailable: boolean;
  currentZoneId?: string | null;
  currentZone?: Zone | null;
  currentLat?: number | null;
  currentLng?: number | null;
  user: { id: string; name: string; email: string; phone?: string | null };
}

export interface AgentAssignment {
  id: string;
  orderId: string;
  agentId: string;
  status: "ACTIVE" | "COMPLETED" | "REASSIGNED" | "CANCELLED";
  assignmentMethod: string;
  distanceKm?: number | null;
  reason?: string | null;
  createdAt: string;
  agent?: AgentSummary;
}

export interface TrackingEvent {
  id: string;
  orderId: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  actorId: string;
  actorRole: Role;
  remarks?: string | null;
  isAdminOverride: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  pickupAddress: string;
  pickupPincode: string;
  pickupZoneId: string;
  pickupZone?: Zone;
  dropAddress: string;
  dropPincode: string;
  dropZoneId: string;
  dropZone?: Zone;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
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
  status: OrderStatus;
  preferredDeliveryDate?: string | null;
  createdAt: string;
  customer?: { id: string; companyName?: string | null; user: { name: string; email: string; phone?: string | null } };
  assignments?: AgentAssignment[];
  trackingEvents?: TrackingEvent[];
}
