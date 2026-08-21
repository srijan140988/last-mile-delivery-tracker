import { PrismaClient, Role, OrderType, RateType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("Password123!", 10);

  // --- Zones ---
  const north = await prisma.zone.upsert({
    where: { name: "North Zone" },
    update: {},
    create: { name: "North Zone", description: "Northern metro area" },
  });
  const south = await prisma.zone.upsert({
    where: { name: "South Zone" },
    update: {},
    create: { name: "South Zone", description: "Southern metro area" },
  });
  const east = await prisma.zone.upsert({
    where: { name: "East Zone" },
    update: {},
    create: { name: "East Zone", description: "Eastern metro area" },
  });
  const west = await prisma.zone.upsert({
    where: { name: "West Zone" },
    update: {},
    create: { name: "West Zone", description: "Western metro area" },
  });

  // --- Areas / postcodes ---
  const areaData: { name: string; postcode: string; zoneId: string }[] = [
    { name: "Rohini", postcode: "110085", zoneId: north.id },
    { name: "Pitampura", postcode: "110034", zoneId: north.id },
    { name: "Saket", postcode: "110017", zoneId: south.id },
    { name: "Vasant Kunj", postcode: "110070", zoneId: south.id },
    { name: "Laxmi Nagar", postcode: "110092", zoneId: east.id },
    { name: "Mayur Vihar", postcode: "110091", zoneId: east.id },
    { name: "Dwarka", postcode: "110075", zoneId: west.id },
    { name: "Janakpuri", postcode: "110058", zoneId: west.id },
  ];
  for (const a of areaData) {
    await prisma.area.upsert({ where: { postcode: a.postcode }, update: {}, create: a });
  }

  // --- Rate cards ---
  const zones = [north, south, east, west];

  // RateCard has no natural unique key, so upsert-by-lookup via findFirst.
  async function ensureRateCard(params: {
    orderType: OrderType;
    rateType: RateType;
    zoneId?: string;
    fromZoneId?: string;
    toZoneId?: string;
    ratePerKg: number;
  }) {
    const existing = await prisma.rateCard.findFirst({
      where: {
        orderType: params.orderType,
        rateType: params.rateType,
        zoneId: params.zoneId ?? null,
        fromZoneId: params.fromZoneId ?? null,
        toZoneId: params.toZoneId ?? null,
      },
    });
    if (existing) {
      return prisma.rateCard.update({ where: { id: existing.id }, data: { ratePerKg: params.ratePerKg, isActive: true } });
    }
    return prisma.rateCard.create({ data: { ...params, isActive: true } });
  }

  for (const zone of zones) {
    await ensureRateCard({ orderType: "B2C", rateType: "INTRA_ZONE", zoneId: zone.id, ratePerKg: 25 });
    await ensureRateCard({ orderType: "B2B", rateType: "INTRA_ZONE", zoneId: zone.id, ratePerKg: 18 });
  }

  for (const from of zones) {
    for (const to of zones) {
      if (from.id === to.id) continue;
      await ensureRateCard({ orderType: "B2C", rateType: "INTER_ZONE", fromZoneId: from.id, toZoneId: to.id, ratePerKg: 40 });
      await ensureRateCard({ orderType: "B2B", rateType: "INTER_ZONE", fromZoneId: from.id, toZoneId: to.id, ratePerKg: 30 });
    }
  }

  // --- COD surcharge config ---
  await prisma.codSurchargeConfig.upsert({
    where: { orderType: "B2C" },
    update: { flatFee: 20, percentage: 2, isActive: true },
    create: { orderType: "B2C", flatFee: 20, percentage: 2, isActive: true },
  });
  await prisma.codSurchargeConfig.upsert({
    where: { orderType: "B2B" },
    update: { flatFee: 15, percentage: 1.5, isActive: true },
    create: { orderType: "B2B", flatFee: 15, percentage: 1.5, isActive: true },
  });

  // --- Admin user ---
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { name: "Ops Admin", email: "admin@example.com", passwordHash: password, role: Role.ADMIN, phone: "9999900000" },
  });

  // --- Customer user ---
  const customerUser = await prisma.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      name: "Aditi Sharma",
      email: "customer@example.com",
      passwordHash: password,
      role: Role.CUSTOMER,
      phone: "9999911111",
      customer: { create: { companyName: "Sharma Retail Pvt Ltd" } },
    },
  });
  const customer = await prisma.customer.findUniqueOrThrow({ where: { userId: customerUser.id } });

  // --- Delivery agents ---
  const agentDefs = [
    { name: "Ravi Kumar", email: "ravi.agent@example.com", zoneId: north.id, lat: 28.7041, lng: 77.1025 },
    { name: "Sunita Devi", email: "sunita.agent@example.com", zoneId: south.id, lat: 28.5245, lng: 77.1855 },
    { name: "Mohammed Faizan", email: "faizan.agent@example.com", zoneId: east.id, lat: 28.6139, lng: 77.2773 },
    { name: "Priya Nair", email: "priya.agent@example.com", zoneId: west.id, lat: 28.5921, lng: 77.0460 },
    { name: "Arjun Singh", email: "arjun.agent@example.com", zoneId: north.id, lat: 28.7196, lng: 77.1364 },
  ];

  const agents = [];
  for (const a of agentDefs) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {},
      create: {
        name: a.name,
        email: a.email,
        passwordHash: password,
        role: Role.AGENT,
        phone: "98765" + Math.floor(10000 + Math.random() * 89999),
        agent: {
          create: { currentZoneId: a.zoneId, currentLat: a.lat, currentLng: a.lng, isActive: true, isAvailable: true },
        },
      },
      include: { agent: true },
    });
    agents.push(user);
  }

  console.log("Seed complete.");
  console.log("---------------------------------------------");
  console.log("Demo credentials (password for all: Password123!)");
  console.log(`Admin:    ${adminUser.email}`);
  console.log(`Customer: ${customerUser.email}`);
  agentDefs.forEach((a) => console.log(`Agent:    ${a.email}`));
  console.log("---------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
