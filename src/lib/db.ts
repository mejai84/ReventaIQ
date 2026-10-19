import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseConnectionConfig } from "@/lib/database-config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connection = resolveDatabaseConnectionConfig(process.env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg(connection) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
