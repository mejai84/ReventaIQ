import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined || connectionString.length === 0) {
  console.error("Login/database startup: DATABASE_URL is missing or empty (runtime env).");
}
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString ?? "" }) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
