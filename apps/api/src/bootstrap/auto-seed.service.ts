import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { PrismaService } from "../prisma/prisma.service";

const execFileAsync = promisify(execFile);

@Injectable()
export class AutoSeedService implements OnModuleInit {
  private readonly logger = new Logger(AutoSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const enabled = (this.config.get<string>("RUN_SEED") ?? process.env.RUN_SEED ?? "false")
      .toString()
      .toLowerCase();
    if (enabled !== "true" && enabled !== "1") {
      return;
    }

    const users = await this.prisma.user.count();
    if (users > 0) {
      this.logger.log(`Seed skipped — already have ${users} user(s)`);
      return;
    }

    this.logger.warn("Database empty — running seed…");
    const seedFile = join("/app/packages/database/prisma/seed.ts");
    const tsxBin = [
      join("/app/node_modules/.bin/tsx"),
      join("/app/packages/database/node_modules/.bin/tsx"),
    ].find((p) => existsSync(p));

    if (!tsxBin || !existsSync(seedFile)) {
      this.logger.error(`Seed tools missing (tsx=${tsxBin ?? "no"}, seed=${existsSync(seedFile)})`);
      return;
    }

    try {
      const { stdout, stderr } = await execFileAsync(tsxBin, [seedFile], {
        cwd: "/app/packages/database",
        env: process.env,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (stdout?.trim()) this.logger.log(stdout.trim());
      if (stderr?.trim()) this.logger.warn(stderr.trim());
      this.logger.log("Seed completed");
    } catch (err) {
      this.logger.error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
