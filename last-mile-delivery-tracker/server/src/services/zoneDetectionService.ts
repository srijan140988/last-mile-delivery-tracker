import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

// ZoneDetectionService resolves a postcode (today) or a geocoded lat/lng
// (future) to an admin-managed Zone. The lookup is fully data-driven via the
// Area table — nothing about zone boundaries is hardcoded in code.
//
// The `coordinates` parameter is accepted but unused today; it exists so a
// geocoding API can be dropped in later (see docs/SYSTEM_DESIGN.md) without
// changing the service's public contract or any of its callers.
export interface DetectZoneInput {
  postcode: string;
  coordinates?: { lat: number; lng: number };
}

export async function detectZoneForPostcode(postcode: string): Promise<{ zoneId: string; zoneName: string }> {
  const normalized = postcode.trim();
  if (!normalized) {
    throw ApiError.badRequest("A postcode/area code is required to detect a zone");
  }

  const area = await prisma.area.findUnique({
    where: { postcode: normalized },
    include: { zone: true },
  });

  if (!area) {
    throw ApiError.badRequest(
      `No zone is mapped for postcode "${normalized}". Ask an admin to map this area to a zone.`
    );
  }

  return { zoneId: area.zoneId, zoneName: area.zone.name };
}
