import { DatabaseSync, SQLInputValue } from "node:sqlite";
import path from "path";
import fs from "fs";
import { seedArticles, seedTips } from "./seed";

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(path.join(dataDir, "cycle-tracker.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function getRow<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function allRows<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function runStmt(
  sql: string,
  ...params: SQLInputValue[]
): { changes: number | bigint; lastInsertRowid: number | bigint } {
  return db.prepare(sql).run(...params);
}

export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      cycle_length INTEGER NOT NULL DEFAULT 28,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cycle_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('period_start', 'period_day', 'none')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      cover_image TEXT,
      content TEXT,
      published_at TEXT,
      is_published INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_day INTEGER NOT NULL CHECK (cycle_day BETWEEN 1 AND 32),
      text TEXT NOT NULL,
      title TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      body TEXT,
      type TEXT NOT NULL DEFAULT 'system',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.prepare("CREATE INDEX IF NOT EXISTS idx_cycle_user_date ON cycle_entries(user_id, date)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read)").run();

  seedArticles();
  seedTips();
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  cycle_length: number;
  created_at: string;
  updated_at: string;
}

export interface CycleEntryRow {
  id: number;
  user_id: number;
  date: string;
  type: "period_start" | "period_day" | "none";
  notes: string | null;
  created_at: string;
}

export interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  cover_image: string | null;
  content: string | null;
  published_at: string | null;
  is_published: number;
}

export interface TipRow {
  id: number;
  cycle_day: number;
  text: string;
  title: string | null;
}

export interface NotificationRow {
  id: number;
  user_id: number;
  title: string | null;
  body: string | null;
  type: string;
  is_read: number;
  created_at: string;
}