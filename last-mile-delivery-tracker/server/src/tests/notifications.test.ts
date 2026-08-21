import { describe, it, expect } from "vitest";
import { buildNotificationContent, buildReassignedContent } from "../services/notificationService";

describe("Notification templates", () => {
  it("builds a FAILED notification including the failure reason", () => {
    const { subject, body } = buildNotificationContent("FAILED" as any, "LMD-20260101-AB12", "Customer not available");
    expect(subject).toMatch(/failed/i);
    expect(body).toContain("Customer not available");
    expect(body).toContain("LMD-20260101-AB12");
  });

  it("builds a RESCHEDULED notification including the new date", () => {
    const { subject, body } = buildNotificationContent("RESCHEDULED" as any, "LMD-20260101-AB12", "Mon Jan 05 2026");
    expect(subject).toMatch(/reschedul/i);
    expect(body).toContain("Mon Jan 05 2026");
  });

  it("builds a reassignment notification naming the new agent", () => {
    const { subject, body } = buildReassignedContent("LMD-20260101-AB12", "Ravi Kumar");
    expect(subject).toContain("LMD-20260101-AB12");
    expect(body).toContain("Ravi Kumar");
  });

  it("falls back to a generic template for statuses without a specific one", () => {
    const { body } = buildNotificationContent("CANCELLED" as any, "LMD-1");
    expect(body).toContain("CANCELLED");
  });

  it("builds correct templates for every core lifecycle status", () => {
    const statuses = ["CREATED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
    for (const s of statuses) {
      const { subject, body } = buildNotificationContent(s as any, "LMD-XYZ");
      expect(subject.length).toBeGreaterThan(0);
      expect(body).toContain("LMD-XYZ");
    }
  });
});
