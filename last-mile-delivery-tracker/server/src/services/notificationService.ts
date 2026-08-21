import nodemailer from "nodemailer";
import { NotificationChannel, OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const STATUS_TEMPLATES: Partial<Record<OrderStatus, (orderNumber: string, extra?: string) => { subject: string; body: string }>> = {
  CREATED: (n) => ({ subject: `Order ${n} placed`, body: `Your order ${n} has been created and is awaiting pickup.` }),
  ASSIGNED: (n) => ({ subject: `Order ${n} assigned`, body: `A delivery agent has been assigned to order ${n}.` }),
  PICKED_UP: (n) => ({ subject: `Order ${n} picked up`, body: `Your package for order ${n} has been picked up.` }),
  IN_TRANSIT: (n) => ({ subject: `Order ${n} in transit`, body: `Your order ${n} is now in transit.` }),
  OUT_FOR_DELIVERY: (n) => ({ subject: `Order ${n} out for delivery`, body: `Your order ${n} is out for delivery today.` }),
  DELIVERED: (n) => ({ subject: `Order ${n} delivered`, body: `Your order ${n} has been delivered. Thank you!` }),
  FAILED: (n, reason) => ({
    subject: `Delivery attempt failed for order ${n}`,
    body: `We were unable to deliver order ${n}. Reason: ${reason ?? "Not specified"}. You can reschedule from your dashboard.`,
  }),
  RESCHEDULED: (n, date) => ({
    subject: `Order ${n} rescheduled`,
    body: `Your order ${n} has been rescheduled for delivery on ${date ?? "the requested date"}. A new agent will be assigned.`,
  }),
};

export function buildNotificationContent(status: OrderStatus, orderNumber: string, extra?: string) {
  const tpl = STATUS_TEMPLATES[status];
  if (!tpl) return { subject: `Order ${orderNumber} update`, body: `Order ${orderNumber} status changed to ${status}.` };
  return tpl(orderNumber, extra);
}

// A dedicated template for the "reassigned" event, which isn't itself an
// OrderStatus but a sub-event of FAILED -> RESCHEDULED.
export function buildReassignedContent(orderNumber: string, agentName: string) {
  return {
    subject: `New agent assigned for order ${orderNumber}`,
    body: `Order ${orderNumber} has been reassigned to delivery agent ${agentName} for your rescheduled delivery.`,
  };
}

// ---------------------------------------------------------------------------
// Email transport (Resend HTTP API, SMTP fallback, or no-op)
// ---------------------------------------------------------------------------

async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const provider = process.env.EMAIL_PROVIDER ?? "none";

  try {
    if (provider === "resend") {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "no-reply@example.com",
          to: [to],
          subject,
          text: body,
        }),
      });
      if (!res.ok) return { ok: false, error: `Resend API error: ${res.status}` };
      return { ok: true };
    }

    if (provider === "smtp") {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return { ok: false, error: "SMTP credentials not configured" };
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT ?? 587),
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      await transporter.sendMail({ from: process.env.EMAIL_FROM ?? SMTP_USER, to, subject, text: body });
      return { ok: true };
    }

    // provider === "none" or unrecognized: skip silently, app keeps working.
    return { ok: false, error: "Email provider not configured (EMAIL_PROVIDER=none)" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

// ---------------------------------------------------------------------------
// SMS transport (Twilio or no-op) — never throws, never crashes the app.
// ---------------------------------------------------------------------------

async function sendSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const provider = process.env.SMS_PROVIDER ?? "none";
  if (provider !== "twilio") return { ok: false, error: "SMS provider not configured (SMS_PROVIDER=none)" };

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { ok: false, error: "Twilio credentials not configured" };
  }

  try {
    // Lazy import so the app runs fine even if the twilio package/env is absent.
    const twilio = (await import("twilio")).default;
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({ from: TWILIO_FROM_NUMBER, to, body });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown SMS error" };
  }
}

// ---------------------------------------------------------------------------
// Public API: notify(orderId, status) — sends email+SMS and logs a
// Notification row regardless of success/failure so admins have an audit trail.
// ---------------------------------------------------------------------------

export async function notifyOrderStatus(orderId: string, status: OrderStatus, extra?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { include: { user: true } } },
  });
  if (!order) return;

  const { subject, body } = buildNotificationContent(status, order.orderNumber, extra);
  await dispatchAndLog(orderId, order.customer.user.email, order.customer.user.phone, subject, body);
}

export async function notifyCustom(orderId: string, subject: string, body: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { include: { user: true } } },
  });
  if (!order) return;
  await dispatchAndLog(orderId, order.customer.user.email, order.customer.user.phone, subject, body);
}

async function dispatchAndLog(
  orderId: string,
  email: string,
  phone: string | null | undefined,
  subject: string,
  body: string
) {
  const emailResult = await sendEmail(email, subject, body);
  await prisma.notification.create({
    data: {
      orderId,
      channel: NotificationChannel.EMAIL,
      status: emailResult.ok ? "SENT" : "SKIPPED",
      recipient: email,
      subject,
      body,
      errorMessage: emailResult.error,
    },
  });

  if (phone) {
    const smsResult = await sendSms(phone, `${subject}: ${body}`);
    await prisma.notification.create({
      data: {
        orderId,
        channel: NotificationChannel.SMS,
        status: smsResult.ok ? "SENT" : "SKIPPED",
        recipient: phone,
        subject,
        body,
        errorMessage: smsResult.error,
      },
    });
  }
}
