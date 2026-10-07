import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { getNotifications, markRead } from "../controllers/notificationController";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(getNotifications));
router.patch("/:id/read", asyncHandler(markRead));

export default router;