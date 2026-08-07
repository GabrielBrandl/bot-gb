import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { AppModule } from "./app.module";

const WEAK_JWT_SECRETS = new Set([
  "",
  "change-me-in-production-use-long-random-string",
  "secret",
  "jwt-secret",
]);

/** Carrega .env no process.env sem depender do pacote dotenv. */
function preloadEnvFiles() {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "apps/api/.env"),
    resolve(__dirname, "../.env"),
    resolve(__dirname, "../../../.env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env) || !String(process.env[key] ?? "").trim()) {
        process.env[key] = value;
      } else if (value && ["JWT_SECRET", "EVOLUTION_WEBHOOK_SECRET", "ASAAS_WEBHOOK_TOKEN"].includes(key)) {
        // Prefer non-empty secrets from later env files (apps/api/.env).
        process.env[key] = value;
      }
    }
  }
}

async function bootstrap() {
  preloadEnvFiles();

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const jwtSecret = process.env.JWT_SECRET || config.get<string>("JWT_SECRET") || "";
  const isProd =
    Boolean(process.env.PUBLIC_API_URL || config.get<string>("PUBLIC_API_URL")?.trim()) ||
    process.env.NODE_ENV === "production";
  if (!jwtSecret || jwtSecret.length < 32 || WEAK_JWT_SECRETS.has(jwtSecret)) {
    if (isProd) {
      throw new Error(
        "JWT_SECRET inseguro ou ausente. Defina um segredo aleatório com pelo menos 32 caracteres.",
      );
    }
    console.warn(
      "[security] JWT_SECRET fraco/ausente — OK só em desenvolvimento. Nunca use isso em produção.",
    );
  } else {
    // Garante que o ConfigService/JWT usem o segredo forte do process.env
    process.env.JWT_SECRET = jwtSecret;
  }

  const webhookSecret = (process.env.EVOLUTION_WEBHOOK_SECRET || "").trim();
  console.log(
    `[security] EVOLUTION_WEBHOOK_SECRET ${webhookSecret ? "carregado" : "AUSENTE (webhook aberto em dev)"}`,
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  const prefix = config.get<string>("API_PREFIX", "api");
  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: config.get<string>("CORS_ORIGIN", "http://localhost:5173"),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>("API_PORT", 3000);
  await app.listen(port, "0.0.0.0");
  console.log(`API running on http://0.0.0.0:${port}/${prefix}`);
}

void bootstrap();
