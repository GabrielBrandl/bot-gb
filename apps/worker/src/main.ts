import { Queue, Worker } from "bullmq";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import IORedis from "ioredis";

loadEnv({ path: resolve(__dirname, "../../../.env") });

const connection = new IORedis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

const WEBHOOK_QUEUE = "webhooks";
const CAMPAIGN_QUEUE = "campaigns";

async function bootstrap() {
  const webhookQueue = new Queue(WEBHOOK_QUEUE, { connection });
  const campaignQueue = new Queue(CAMPAIGN_QUEUE, { connection });

  const webhookWorker = new Worker(
    WEBHOOK_QUEUE,
    async (job) => {
      console.log(`[webhook] processing job ${job.id}`, job.name);
      // Phase 1: Evolution API webhook handling
    },
    { connection },
  );

  const campaignWorker = new Worker(
    CAMPAIGN_QUEUE,
    async (job) => {
      console.log(`[campaign] processing job ${job.id}`, job.name);
      // Phase 3: mass send rate-limited jobs
    },
    { connection },
  );

  webhookWorker.on("failed", (job, err) => {
    console.error(`[webhook] job ${job?.id} failed`, err.message);
  });

  campaignWorker.on("failed", (job, err) => {
    console.error(`[campaign] job ${job?.id} failed`, err.message);
  });

  console.log("Worker ready (queues: webhooks, campaigns)");

  // Keep references so GC does not collect them in long-running process
  void webhookQueue;
  void campaignQueue;
}

bootstrap().catch((error) => {
  console.error("Worker failed to start", error);
  process.exit(1);
});
