import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, verifyRefreshToken } from "../utils/jwt";
import { unauthorized, HttpError } from "../utils/errors";

export interface AuthedRequest extends Request {
  userId?: number;
  userEmail?: string;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(unauthorized("AUTH_REQUIRED", "Требуется авторизация"));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    if (payload.type !== "access" || payload.role !== "user") {
      next(unauthorized("INVALID_TOKEN", "Недействительный токен"));
      return;
    }
    req.userId = Number(payload.sub);
    req.userEmail = payload.email;
    next();
  } catch {
    next(unauthorized("TOKEN_EXPIRED", "Токен недействителен или истёк"));
  }
}

export function parseRefreshToken(req: Request): number | null {
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies;
  const token = cookie?.refresh_token;
  if (!token) return null;
  try {
    const payload = verifyRefreshToken(token);
    if (payload.type !== "refresh" || payload.role !== "user") return null;
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  return new HttpError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера");
}