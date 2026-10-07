import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAdmin } from "../middleware/adminAuth";
import {
  adminLogin,
  adminListArticles,
  adminCreateArticle,
  adminUpdateArticle,
  adminDeleteArticle,
  adminUploadCover,
  adminListTips,
  adminCreateTip,
  adminUpdateTip,
  adminDeleteTip
} from "../controllers/adminController";

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(png|jpe?g|webp|gif|svg\+xml)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_FILE"));
    }
  }
});

const router = Router();

router.post("/login", asyncHandler(adminLogin));

router.use(requireAdmin);

router.get("/articles", adminListArticles);
router.post("/articles", asyncHandler(adminCreateArticle));
router.put("/articles/:id", asyncHandler(adminUpdateArticle));
router.delete("/articles/:id", adminDeleteArticle);
router.post("/articles/:id/cover", upload.single("cover"), adminUploadCover);

router.get("/tips", adminListTips);
router.post("/tips", asyncHandler(adminCreateTip));
router.put("/tips/:id", asyncHandler(adminUpdateTip));
router.delete("/tips/:id", adminDeleteTip);

export default router;