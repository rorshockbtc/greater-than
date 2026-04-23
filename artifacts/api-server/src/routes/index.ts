import { Router, type IRouter } from "express";
import healthRouter from "./health";
import articlesRouter from "./articles";
import chatRouter from "./chat";
import ingestRouter from "./ingest";
import feedbackRouter from "./feedback";
import debugLogRouter from "./debug-log";

const router: IRouter = Router();

router.use(healthRouter);
router.use(articlesRouter);
router.use(chatRouter);
router.use(ingestRouter);
router.use(feedbackRouter);
router.use(debugLogRouter);

export default router;
