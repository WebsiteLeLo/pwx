import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import ogRouter from "./og";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ogRouter);
router.use(aiRouter);
router.use(proxyRouter);

export default router;
