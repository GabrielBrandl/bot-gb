import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    let users = -1;
    let plans = -1;
    let seedError: string | null = null;
    try {
      users = await this.prisma.user.count();
      plans = await this.prisma.plan.count();
    } catch (err) {
      seedError = err instanceof Error ? err.message : String(err);
    }
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      db: { users, plans, error: seedError },
    };
  }
}
