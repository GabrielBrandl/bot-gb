import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.aIAgent.updateMany({
    where: {
      OR: [{ id: "seed-ai-agent-bot-ti" }, { name: "Bot Ti" }],
    },
    data: {
      name: "BoTI",
      modelProvider: "anthropic",
      persona: "Assistente virtual do Setor de TI — UNIESBAM (Claude)",
    },
  });
  console.log("updated", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
