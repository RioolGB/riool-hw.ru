import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getRow, runStmt, UserRow } from "../db";
import { badRequest, isValidEmail, unauthorized } from "../utils/errors";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import { parseRefreshToken, AuthedRequest } from "../middleware/auth";
import { createNotification } from "../services/notificationService";

const REFRESH_COOKIE = "refresh_token";

function setRefreshCookie(req: Request, res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearRefreshCookie(req: Request, res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: req.secure, path: "/", sameSite: "lax" });
}

function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    cycle_length: u.cycle_length,
    created_at: u.created_at
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || !isValidEmail(email.trim())) {
    throw badRequest("INVALID_EMAIL", "Укажите корректный email");
  }
  if (typeof password !== "string" || password.length < 8) {
    throw badRequest("WEAK_PASSWORD", "Пароль должен содержать минимум 8 символов");
  }

  const normalized = email.trim().toLowerCase();
  const existing = getRow<{ id: number }>("SELECT id FROM users WHERE email = ?", normalized);
  if (existing) {
    throw badRequest("EMAIL_TAKEN", "Пользователь с таким email уже существует");
  }

  const hash = await bcrypt.hash(password, 10);
  const info = runStmt("INSERT INTO users (email, password_hash) VALUES (?, ?)", normalized, hash);

  const user = getRow<UserRow>("SELECT * FROM users WHERE id = ?", Number(info.lastInsertRowid));
  if (!user) {
    throw new Error("user was not created");
  }

  createNotification(
    user.id,
    "Добро пожаловать в CycleTracker!",
    "Отмечайте дни цикла в календаре — трекер будет строить прогнозы.",
    "system"
  );

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(req, res, refreshToken);

  res.status(201).json({ user: publicUser(user), accessToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    throw badRequest("INVALID_CREDENTIALS", "Неверный email или пароль");
  }

  const user = getRow<UserRow>("SELECT * FROM users WHERE email = ?", email.trim().toLowerCase());

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw unauthorized("INVALID_CREDENTIALS", "Неверный email или пароль");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(req, res, refreshToken);

  res.json({ user: publicUser(user), accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const userId = parseRefreshToken(req);
  if (userId === null) {
    throw unauthorized("REFRESH_REQUIRED", "Сессия истекла, войдите снова");
  }
  const user = getRow<UserRow>("SELECT * FROM users WHERE id = ?", userId);
  if (!user) {
    throw unauthorized("REFRESH_REQUIRED", "Сессия истекла, войдите снова");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setRefreshCookie(req, res, refreshToken);

  res.json({ user: publicUser(user), accessToken });
}

export async function logout(req: AuthedRequest, res: Response): Promise<void> {
  clearRefreshCookie(req, res);
  res.json({ ok: true });
}