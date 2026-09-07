import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  CourierAvailabilityStatus,
  Role,
  ShipmentDirection,
  ShipmentType,
  StaffType,
} from "../src/generated/prisma/enums.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for seeding");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const hashPassword = (password: string) => bcrypt.hash(password, 12);

const zones = [
  { code: "A", name: "Near Asia" },
  { code: "B", name: "South Asia" },
  { code: "C", name: "East Asia" },
  { code: "D", name: "Middle East" },
  { code: "E", name: "Australia and Gulf" },
  { code: "F", name: "United Kingdom" },
  { code: "G", name: "Europe 1" },
  { code: "H", name: "Europe 2" },
  { code: "I", name: "United States" },
  { code: "J", name: "Canada and Japan" },
  { code: "K", name: "Asia 3 and Middle East" },
  { code: "L", name: "Africa and Extended Europe" },
  { code: "M", name: "Rest of World" },
];

const countries = [
  { name: "Bangladesh", iso2Code: "BD", exportZoneCode: "A", importZoneCode: "A" },
  { name: "India", iso2Code: "IN", exportZoneCode: "A", importZoneCode: "A" },
  { name: "Singapore", iso2Code: "SG", exportZoneCode: "A", importZoneCode: "B" },
  { name: "Sri Lanka", iso2Code: "LK", exportZoneCode: "B", importZoneCode: "B" },
  { name: "Malaysia", iso2Code: "MY", exportZoneCode: "C", importZoneCode: "F" },
  { name: "China", iso2Code: "CN", exportZoneCode: "C", importZoneCode: "C" },
  { name: "United Arab Emirates", iso2Code: "AE", exportZoneCode: "D", importZoneCode: "E" },
  { name: "Saudi Arabia", iso2Code: "SA", exportZoneCode: "D", importZoneCode: "E" },
  { name: "Australia", iso2Code: "AU", exportZoneCode: "E", importZoneCode: "D" },
  { name: "United Kingdom", iso2Code: "GB", exportZoneCode: "F", importZoneCode: "G" },
  { name: "Germany", iso2Code: "DE", exportZoneCode: "G", importZoneCode: "G" },
  { name: "France", iso2Code: "FR", exportZoneCode: "G", importZoneCode: "G" },
  { name: "Spain", iso2Code: "ES", exportZoneCode: "G", importZoneCode: "G" },
  { name: "Netherlands", iso2Code: "NL", exportZoneCode: "G", importZoneCode: "G" },
  { name: "Sweden", iso2Code: "SE", exportZoneCode: "H", importZoneCode: "H" },
  { name: "United States", iso2Code: "US", exportZoneCode: "I", importZoneCode: "I" },
  { name: "Canada", iso2Code: "CA", exportZoneCode: "J", importZoneCode: "I" },
  { name: "Japan", iso2Code: "JP", exportZoneCode: "K", importZoneCode: "J" },
  { name: "South Africa", iso2Code: "ZA", exportZoneCode: "L", importZoneCode: "K" },
  { name: "Brazil", iso2Code: "BR", exportZoneCode: "M", importZoneCode: "L" },
  { name: "Peru", iso2Code: "PE", exportZoneCode: "M", importZoneCode: "L" },
];

const zoneMultiplier: Record<string, number> = {
  A: 1,
  B: 1.15,
  C: 1.3,
  D: 1.45,
  E: 1.65,
  F: 1.75,
  G: 1.9,
  H: 2.05,
  I: 2.15,
  J: 2.25,
  K: 2.45,
  L: 2.75,
  M: 3.25,
};

const weightSlabs = [
  { min: 0.01, max: 0.5, base: 7 },
  { min: 0.51, max: 1, base: 10 },
  { min: 1.01, max: 2, base: 15 },
  { min: 2.01, max: 5, base: 24 },
  { min: 5.01, max: 10, base: 42 },
  { min: 10.01, max: 20, base: 72 },
  { min: 20.01, max: null, base: 5 },
];

const getPrice = (
  base: number,
  multiplier: number,
  shipmentType: ShipmentType,
  direction: ShipmentDirection,
) => {
  const typeMultiplier = shipmentType === ShipmentType.PARCEL ? 1.18 : 1;
  const directionMultiplier = direction === ShipmentDirection.IMPORT ? 1.12 : 1;
  return Number((base * multiplier * typeMultiplier * directionMultiplier).toFixed(2));
};

async function main() {
  const adminPassword = await hashPassword("Admin@12345");
  const managerPassword = await hashPassword("Manager@12345");
  const customerPassword = await hashPassword("Customer@12345");

  await prisma.user.upsert({
    where: { email: "admin@shipperex.com" },
    update: {},
    create: {
      name: "ShipperEx Admin",
      email: "admin@shipperex.com",
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "customer@shipperex.com" },
    update: {},
    create: {
      name: "Demo Customer",
      email: "customer@shipperex.com",
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
    },
  });

  for (const zone of zones) {
    await prisma.rateZone.upsert({
      where: { code: zone.code },
      update: zone,
      create: zone,
    });
  }

  for (const country of countries) {
    await prisma.country.upsert({
      where: { iso2Code: country.iso2Code },
      update: country,
      create: country,
    });
  }

  for (const direction of [ShipmentDirection.EXPORT, ShipmentDirection.IMPORT]) {
    for (const shipmentType of [ShipmentType.DOCUMENT, ShipmentType.PARCEL]) {
      for (const zone of zones) {
        for (const slab of weightSlabs) {
          const isFlatRate = slab.max === null;
          const rateData = {
            direction,
            zoneCode: zone.code,
            shipmentType,
            minWeightKg: slab.min,
            maxWeightKg: slab.max,
            priceUsd: isFlatRate
              ? null
              : getPrice(slab.base, zoneMultiplier[zone.code], shipmentType, direction),
            perKgRateUsd: isFlatRate
              ? getPrice(slab.base, zoneMultiplier[zone.code], shipmentType, direction)
              : null,
            isActive: true,
          };
          const existingRate = await prisma.shipmentRate.findFirst({
            where: {
              direction,
              zoneCode: zone.code,
              shipmentType,
              minWeightKg: slab.min,
              maxWeightKg: slab.max,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (existingRate) {
            await prisma.shipmentRate.update({ where: { id: existingRate.id }, data: rateData });
          } else {
            await prisma.shipmentRate.create({ data: rateData });
          }
        }
      }
    }
  }

  await prisma.hub.upsert({
    where: { code: "DAC-HUB" },
    update: { country: { connect: { iso2Code: "BD" } } },
    create: {
      name: "Dhaka Central Hub",
      code: "DAC-HUB",
      city: "Dhaka",
      address: "Tejgaon Industrial Area, Dhaka",
      country: { connect: { iso2Code: "BD" } },
    },
  });

  const chattogramHub = await prisma.hub.upsert({
    where: { code: "CTG-HUB" },
    update: { country: { connect: { iso2Code: "BD" } } },
    create: {
      name: "Chattogram Hub",
      code: "CTG-HUB",
      city: "Chattogram",
      address: "Agrabad Commercial Area, Chattogram",
      country: { connect: { iso2Code: "BD" } },
    },
  });

  const newYorkHub = await prisma.hub.upsert({
    where: { code: "NYC-HUB" },
    update: { country: { connect: { iso2Code: "US" } } },
    create: {
      name: "New York Hub",
      code: "NYC-HUB",
      city: "New York",
      address: "Queens Logistics District, New York",
      country: { connect: { iso2Code: "US" } },
    },
  });

  const limaHub = await prisma.hub.upsert({
    where: { code: "LIM-HUB" },
    update: { country: { connect: { iso2Code: "PE" } } },
    create: {
      name: "Lima Hub",
      code: "LIM-HUB",
      city: "Lima",
      address: "Callao Logistics District, Lima",
      country: { connect: { iso2Code: "PE" } },
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@shipperex.com" },
    update: {
      passwordHash: managerPassword,
      role: Role.STAFF,
      status: "ACTIVE",
    },
    create: {
      name: "ShipperEx Manager",
      email: "manager@shipperex.com",
      passwordHash: managerPassword,
      role: Role.STAFF,
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: manager.id },
    update: { hubId: chattogramHub.id, staffType: StaffType.MANAGER },
    create: {
      userId: manager.id,
      hubId: chattogramHub.id,
      staffType: StaffType.MANAGER,
    },
  });

  for (const managerAccount of [
    {
      name: "New York Hub Manager",
      email: "manager.newyork@shipperex.com",
      phone: "+12025550120",
      hubId: newYorkHub.id,
    },
    {
      name: "Lima Hub Manager",
      email: "manager.lima@shipperex.com",
      phone: "+51955501000",
      hubId: limaHub.id,
    },
  ]) {
    const hubManager = await prisma.user.upsert({
      where: { email: managerAccount.email },
      update: {
        name: managerAccount.name,
        phone: managerAccount.phone,
        passwordHash: managerPassword,
        role: Role.STAFF,
        status: "ACTIVE",
      },
      create: {
        name: managerAccount.name,
        email: managerAccount.email,
        phone: managerAccount.phone,
        passwordHash: managerPassword,
        role: Role.STAFF,
      },
    });
    await prisma.staffProfile.upsert({
      where: { userId: hubManager.id },
      update: { hubId: managerAccount.hubId, staffType: StaffType.MANAGER },
      create: {
        userId: hubManager.id,
        hubId: managerAccount.hubId,
        staffType: StaffType.MANAGER,
      },
    });
  }

  const staffAccounts = [
    {
      name: "Rahim Courier",
      email: "rahim.courier@shipperex.com",
      phone: "+8801700000001",
      password: "Courier@12345",
      hubId: chattogramHub.id,
    },
    {
      name: "John Courier",
      email: "john.courier@shipperex.com",
      phone: "+12025550124",
      password: "Courier@12345",
      hubId: newYorkHub.id,
    },
    {
      name: "Carlos Courier",
      email: "carlos.courier@shipperex.com",
      phone: "+51955501001",
      password: "Courier@12345",
      hubId: limaHub.id,
    },
  ];

  for (const account of staffAccounts) {
    const courier = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        phone: account.phone,
        passwordHash: await hashPassword(account.password),
        role: Role.STAFF,
        status: "ACTIVE",
      },
      create: {
        name: account.name,
        email: account.email,
        phone: account.phone,
        passwordHash: await hashPassword(account.password),
        role: Role.STAFF,
      },
    });

    await prisma.staffProfile.upsert({
      where: { userId: courier.id },
      update: {
        hubId: account.hubId,
        staffType: StaffType.COURIER,
        maxActiveTasks: 5,
      },
      create: {
        userId: courier.id,
        hubId: account.hubId,
        staffType: StaffType.COURIER,
        availabilityStatus: CourierAvailabilityStatus.AVAILABLE,
        maxActiveTasks: 5,
      },
    });
  }

  console.log("Seed completed");
  console.log("Admin: admin@shipperex.com / Admin@12345");
  console.log("Manager: manager@shipperex.com / Manager@12345");
  console.log("Customer: customer@shipperex.com / Customer@12345");
  console.log("Courier: rahim.courier@shipperex.com / Courier@12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
