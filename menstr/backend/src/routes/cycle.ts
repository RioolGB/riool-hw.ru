import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  getSummary,
  getEntriesForMonth,
  upsertEntry,
  deleteEntry,
  markStartToday
} from "../controllers/cycleController";

const router = Router();

router.use(requireAuth);

router.get("/summary", asyncHandler(getSummary));
router.get("/entries", asyncHandler(getEntriesForMonth));
router.post("/entries", asyncHandler(upsertEntry));
router.delete("/entries/:id", asyncHandler(deleteEntry));
router.post("/mark-start-today", asyncHandler(markStartToday));

export default router;