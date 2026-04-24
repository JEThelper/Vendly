import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vendorsRouter from "./vendors";
import menuRouter from "./menu";
import ordersRouter from "./orders";
import conversationsRouter from "./conversations";
import customersRouter from "./customers";
import paymentsRouter from "./payments";
import dashboardRouter from "./dashboard";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vendorsRouter);
router.use(menuRouter);
router.use(ordersRouter);
router.use(conversationsRouter);
router.use(customersRouter);
router.use(paymentsRouter);
router.use(dashboardRouter);
router.use(webhookRouter);

export default router;
