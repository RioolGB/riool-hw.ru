import { Response } from "express";
import bcrypt from "bcryptjs";
import { getRow, runStmt, UserRow } from "../db";
import { badRequest, isValidEmail, unauthorized } from "../utils/errors";
import { AuthedRequest } from "../middleware/auth";

function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    cycle_length: u.cycle_length,
    created_at: u.created_at
  };
}

export async function getMe(req: AuthedRequest, res: Response): Promise<void> {
  const user = getRow<UserRow>("SELECT * FROM users WHERE id = ?", req.userId!);
  if (!user) {
    throw unauthorized("AUTH_REQUIRED", "Требуется авторизация");
  }
  res.json({ user: publicUser(user) });
}

export async function updateMe(req: AuthedRequest, res: Response): Promise<void> {
  const user = getRow<UserRow>("SELECT * FROM users WHERE id = ?", req.userId!);
  if (!user) {
    throw unauthorized("AUTH_REQUIRED", "Требуется авторизация");
  }
  const { email, cycle_length, password } = req.body ?? {};

  let newEmail = user.email;
  let newCycleLength = user.cycle_length;
  let needPassword = email !== undefined || cycle_length !== undefined;

  if (needPassword) {
    if (typeof password !== "string" || !(await bcrypt.compare(password, user.password_hash))) {
      throw unauthorized("PASSWORD_REQUIRED", "Подтвердите действие текущим паролем");
    }
  }

  if (cycle_length !== undefined) {
    const len = Number(cycle_length);
    if (!Number.isInteger(len) || len < 21 || len > 40) {
      throw badRequest("INVALID_CYCLE_LENGTH", "Длина цикла должна быть от 21 до 40 дней");
    }
    newCycleLength = len;
  }

  if (email !== undefined) {
    if (typeof email !== "string" || !isValidEmail(email.trim())) {
      throw badRequest("INVALID_EMAIL", "Укажите корректный email");
    }
    newEmail = email.trim().toLowerCase();
    const conflict = getRow<{ id: number }>(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      newEmail,
      req.userId!
    );
    if (conflict) {
      throw badRequest("EMAIL_TAKEN", "Пользователь с таким email уже существует");
    }
  }

  runStmt(
    "UPDATE users SET email = ?, cycle_length = ?, updated_at = datetime('now') WHERE id = ?",
    newEmail,
    newCycleLength,
    req.userId!
  );

  const updated = getRow<UserRow>("SELECT * FROM users WHERE id = ?", req.userId!);
  res.json({ user: publicUser(updated!) });
}

export async function changePassword(req: AuthedRequest, res: Response): Promise<void> {
  const { current_password, new_password } = req.body ?? {};
  const user = getRow<UserRow>("SELECT * FROM users WHERE id = ?", req.userId!);
  if (!user) {
    throw unauthorized("AUTH_REQUIRED", "Требуется авторизация");
  }

  if (
    typeof current_password !== "string" ||
    !(await bcrypt.compare(current_password, user.password_hash))
  ) {
    throw unauthorized("WRONG_PASSWORD", "Неверный текущий пароль");
  }
  if (typeof new_password !== "string" || new_password.length < 8) {
    throw badRequest("WEAK_PASSWORD", "Новый пароль должен содержать минимум 8 символов");
  }

  const hash = await bcrypt.hash(new_password, 10);
  runStmt(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
    hash,
    req.userId!
  );

  res.json({ ok: true });
}

export async function deleteMe(req: AuthedRequest, res: Response): Promise<void> {
  res.clearCookie("refresh_token", { httpOnly: true, path: "/", sameSite: "lax" });
  runStmt("DELETE FROM users WHERE id = ?", req.userId!);
  res.json({ ok: true });
}