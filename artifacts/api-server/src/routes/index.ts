import { Router, type IRouter } from "express";
import { requireApiKey } from "../middleware/auth";
import healthRouter from "./health";
import vendorsRouter from "./vendors";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import conversationsRouter from "./conversations";
import customersRouter from "./customers";
import paymentsRouter from "./payments";
import dashboardRouter from "./dashboard";
import webhookRouter from "./webhook";
import promotionsRouter from "./promotions";
import broadcastsRouter from "./broadcasts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(webhookRouter);
router.use(requireApiKey, vendorsRouter);
router.use(requireApiKey, menuRouter);
router.use(requireApiKey, ordersRouter);
router.use(requireApiKey, conversationsRouter);
router.use(requireApiKey, customersRouter);
router.use(requireApiKey, paymentsRouter);
router.use(requireApiKey, dashboardRouter);
router.use(requireApiKey, promotionsRouter);
router.use(requireApiKey, broadcastsRouter);

export default router;
