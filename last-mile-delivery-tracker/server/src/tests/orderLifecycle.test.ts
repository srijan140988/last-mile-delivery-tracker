import { describe, it, expect } from "vitest";
import { isTransitionAllowed } from "../services/orderLifecycleService";

// ---------------------------------------------------------------------------
// Pure tests against the allowed-transitions state machine. No DB required.
// ---------------------------------------------------------------------------

describe("Order status lifecycle - isTransitionAllowed", () => {
  it("allows the full happy-path lifecycle in order", () => {
    expect(isTransitionAllowed("CREATED", "ASSIGNED")).toBe(true);
    expect(isTransitionAllowed("ASSIGNED", "PICKED_UP")).toBe(true);
    expect(isTransitionAllowed("PICKED_UP", "IN_TRANSIT")).toBe(true);
    expect(isTransitionAllowed("IN_TRANSIT", "OUT_FOR_DELIVERY")).toBe(true);
    expect(isTransitionAllowed("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
  });

  it("allows OUT_FOR_DELIVERY -> FAILED", () => {
    expect(isTransitionAllowed("OUT_FOR_DELIVERY", "FAILED")).toBe(true);
  });

  it("allows FAILED -> RESCHEDULED, and RESCHEDULED -> ASSIGNED for the new attempt", () => {
    expect(isTransitionAllowed("FAILED", "RESCHEDULED")).toBe(true);
    expect(isTransitionAllowed("RESCHEDULED", "ASSIGNED")).toBe(true);
  });

  it("rejects DELIVERED -> IN_TRANSIT (no reverting a completed delivery)", () => {
    expect(isTransitionAllowed("DELIVERED", "IN_TRANSIT")).toBe(false);
  });

  it("rejects skipping states, e.g. CREATED -> DELIVERED", () => {
    expect(isTransitionAllowed("CREATED", "DELIVERED")).toBe(false);
  });

  it("rejects any transition out of a terminal DELIVERED or CANCELLED state", () => {
    expect(isTransitionAllowed("DELIVERED", "FAILED")).toBe(false);
    expect(isTransitionAllowed("CANCELLED", "ASSIGNED")).toBe(false);
  });

  it("rejects FAILED -> DELIVERED directly (must go through RESCHEDULED)", () => {
    expect(isTransitionAllowed("FAILED", "DELIVERED")).toBe(false);
  });
});
