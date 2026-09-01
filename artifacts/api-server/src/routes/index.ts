import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cyberlabRouter from "./cyberlab";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cyberlabRouter);

export default router;
