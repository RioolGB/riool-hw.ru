import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import {
  getMe,
  updateMe,
  changePassword,
  deleteMe
} from "../controllers/userController";

const router = Router();

router.get("/me", requireAuth, asyncHandler(getMe));
router.patch("/me", requireAuth, asyncHandler(updateMe));
router.post("/me/change-password", requireAuth, asyncHandler(changePassword));
router.delete("/me", requireAuth, asyncHandler(deleteMe));

export default router;