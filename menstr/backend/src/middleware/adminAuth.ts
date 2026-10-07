import { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../utils/jwt";
import { unauthorized } from "../utils/errors";

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(unauthorized("ADMIN_REQUIRED", "Требуется вход в админку"));
    return;
  }
  try {
    const payload = verifyAdminToken(header.slice(7));
    if (payload.role !== "admin") {
      next(unauthorized("ADMIN_REQUIRED", "Требуется вход в админку"));
      return;
    }
    next();
  } catch {
    next(unauthorized("ADMIN_REQUIRED", "Требуется вход в админку"));
  }
}