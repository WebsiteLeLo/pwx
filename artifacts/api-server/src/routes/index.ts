import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proxyRouter);

export default router;
