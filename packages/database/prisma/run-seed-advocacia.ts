/**
 * Runner: cria/atualiza o tenant Mendes & Associados (WhatsApp advocacia + Claude).
 * Uso: pnpm exec tsx prisma/run-seed-advocacia.ts  (em packages/database)
 */
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { seedAdvocacia } from "./seed-advocacia";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  const result = await seedAdvocacia(prisma, passwordHash);
  console.log("Advocacia seed OK:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
