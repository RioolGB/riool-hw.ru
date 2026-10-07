import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { register, login, refresh, logout } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", requireAuth, asyncHandler(logout));

export default router;