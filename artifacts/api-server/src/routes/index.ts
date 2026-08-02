import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import ogRouter from "./og";
import aiRouter from "./ai";
import adminRouter from "./admin";
import authRouter from "./auth";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ogRouter);
router.use(aiRouter);
router.use(adminRouter);
router.use(authRouter);
router.use(botRouter);
router.use(proxyRouter);

export default router;
