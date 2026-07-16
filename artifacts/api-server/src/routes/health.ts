import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { checkDatabaseHealth } from "@workspace/db";
import { checkQueueHealth } from "../lib/queue";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Basic health check for uptime monitoring
 * Used by load balancers / orchestrators
 */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Deep health check for comprehensive system status
 * Used by monitoring / alerting systems
 */
router.get("/health/deep", async (_req, res) => {
  try {
    const [dbHealth, queueHealth] = await Promise.all([
      checkDatabaseHealth().catch((err) => {
        logger.error({ err }, "Database health check failed");
        return {
          ok: false,
          poolSize: 0,
          idleCount: 0,
          waitingCount: 0,
          responseTime: 0,
        };
      }),
      checkQueueHealth().catch((err) => {
        logger.error({ err }, "Queue health check failed");
        return {
          incomingQueueOk: false,
          outboundQueueOk: false,
          redisConnected: false,
          pendingIncoming: 0,
          pendingOutbound: 0,
        };
      }),
    ]);

    const allHealthy = dbHealth.ok && queueHealth.redisConnected;
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      systems: {
        database: {
          ok: dbHealth.ok,
          poolSize: dbHealth.poolSize,
          idleConnections: dbHealth.idleCount,
          waitingRequests: dbHealth.waitingCount,
          responseTimeMs: dbHealth.responseTime,
        },
        queues: {
          redis: queueHealth.redisConnected,
          incoming: queueHealth.incomingQueueOk,
          outbound: queueHealth.outboundQueueOk,
          pendingJobs: {
            incoming: queueHealth.pendingIncoming,
            outbound: queueHealth.pendingOutbound,
          },
        },
        llm: (await import("../lib/intelligence/llm")).llmService.getHealthStatus(),
      },
      memory: {
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        externalMb: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      uptime: process.uptime(),
    });
  } catch (err) {
    logger.error({ err }, "Deep health check failed");
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: "Internal server error",
    });
  }
});

export default router;
