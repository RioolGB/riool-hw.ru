import jwt from "jsonwebtoken";
import { UserRow } from "../db";

export interface AccessPayload {
  sub: number;
  email: string;
  role: "user";
  type: "access";
}

export interface RefreshPayload {
  sub: number;
  email: string;
  role: "user";
  type: "refresh";
}

export interface AdminPayload {
  sub: string;
  role: "admin";
  type: "access";
}

export function signAccessToken(user: UserRow | { id: number; email: string }): string {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const ttl = (process.env.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"]) || "15m";
  return jwt.sign(
    { sub: user.id, email: user.email, role: "user", type: "access" } satisfies AccessPayload,
    secret,
    { expiresIn: ttl }
  );
}

export function signRefreshToken(user: UserRow | { id: number; email: string }): string {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const ttl = (process.env.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"]) || "7d";
  return jwt.sign(
    { sub: user.id, email: user.email, role: "user", type: "refresh" } satisfies RefreshPayload,
    secret,
    { expiresIn: ttl }
  );
}

export function signAdminToken(): string {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return jwt.sign({ sub: "admin", role: "admin", type: "access" } satisfies AdminPayload, secret, {
    expiresIn: "8h"
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const payload = jwt.verify(token, secret) as unknown as AccessPayload;
  if (payload.type !== "access") throw new Error("invalid token type");
  return payload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const payload = jwt.verify(token, secret) as unknown as RefreshPayload;
  if (payload.type !== "refresh") throw new Error("invalid token type");
  return payload;
}

export function verifyAdminToken(token: string): AdminPayload {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const payload = jwt.verify(token, secret) as unknown as AdminPayload;
  if (payload.role !== "admin") throw new Error("invalid admin token");
  return payload;
}