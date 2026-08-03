import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
  // Bind 0.0.0.0 so EasyPanel / Docker healthchecks and reverse proxies can reach the process
  await app.listen(port, "0.0.0.0");
  console.log(`API running on http://0.0.0.0:${port}/${prefix}`);
}

void bootstrap();
