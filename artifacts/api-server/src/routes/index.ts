import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import ogRouter from "./og";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ogRouter);
router.use(proxyRouter);

export default router;
