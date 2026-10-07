import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { listArticles, getArticle } from "../controllers/articleController";

const router = Router();

router.get("/", asyncHandler(listArticles));
router.get("/:slug", asyncHandler(getArticle));

export default router;