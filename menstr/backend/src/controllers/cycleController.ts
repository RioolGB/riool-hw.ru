import { Request, Response } from "express";
import { allRows, CycleEntryRow, getRow, runStmt, UserRow } from "../db";
import { badRequest, notFound, unauthorized } from "../utils/errors";
import { AuthedRequest } from "../middleware/auth";
import {
  getCycleSummary,
  predictedPeriodDays,
  fertileWindowDays
} from "../services/cycleService";
import { isValidDate, monthYearOf, toISODate } from "../utils/dates";

type EntryType = "period_start" | "period_day" | "none";
const ENTRY_TYPES: EntryType[] = ["period_start", "period_day", "none"];

function userWithLength(req: AuthedRequest): UserRow {
  const user = getRow<UserRow>("SELECT * FROM users WHERE id = ?", req.userId!);
  if (!user) {
    throw unauthorized("AUTH_REQUIRED", "Требуется авторизация");
  }
  return user;
}

function entryById(req: AuthedRequest, id: number): CycleEntryRow {
  const entry = getRow<CycleEntryRow>(
    "SELECT * FROM cycle_entries WHERE id = ? AND user_id = ?",
    id,
    req.userId!
  );
  if (!entry) {
    throw notFound("ENTRY_NOT_FOUND", "Запись не найдена");
  }
  return entry;
}

function toEntryJson(e: CycleEntryRow) {
  return { id: e.id, date: e.date, type: e.type, notes: e.notes };
}

export async function getSummary(req: AuthedRequest, res: Response): Promise<void> {
  const user = userWithLength(req);
  const summary = getCycleSummary(user.id, user.cycle_length);
  res.json(summary);
}

export async function getEntriesForMonth(req: AuthedRequest, res: Response): Promise<void> {
  const month = String(req.query.month ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw badRequest("INVALID_MONTH", "Укажите месяц в формате YYYY-MM");
  }
  const user = userWithLength(req);
  const { year, month: m } = monthYearOf(month + "-01");
  const monthStart = `${year}-${String(m).padStart(2, "0")}-01`;
  const date = new Date(year, m, 0);
  const monthEnd = toISODate(date);

  const rows = allRows<CycleEntryRow>(
    "SELECT * FROM cycle_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date",
    user.id,
    monthStart,
    monthEnd
  );

  const summary = getCycleSummary(user.id, user.cycle_length, new Date());
  const lastStart = summary.lastPeriodStart;

  const predicted = lastStart
    ? predictedPeriodDays(lastStart, user.cycle_length, monthStart, monthEnd)
    : [];

  const fertile = summary.fertileWindow
    ? fertileWindowDays(summary.fertileWindow, monthStart, monthEnd)
    : [];

  res.json({
    month,
    entries: rows.map(toEntryJson),
    predicted,
    fertile,
    cycleLength: user.cycle_length
  });
}

export async function upsertEntry(req: AuthedRequest, res: Response): Promise<void> {
  const user = userWithLength(req);
  const { date, type, notes } = req.body ?? {};

  if (typeof date !== "string" || !isValidDate(date)) {
    throw badRequest("INVALID_DATE", "Укажите корректную дату (YYYY-MM-DD)");
  }
  if (typeof type !== "string" || !ENTRY_TYPES.includes(type as EntryType)) {
    throw badRequest("INVALID_TYPE", "Некорректный тип записи");
  }
  if (notes !== undefined && (typeof notes !== "string" || notes.length > 500)) {
    throw badRequest("INVALID_NOTES", "Заметка должна быть строкой до 500 символов");
  }

  const existing = getRow<CycleEntryRow>(
    "SELECT * FROM cycle_entries WHERE user_id = ? AND date = ?",
    req.userId!,
    date
  );

  let entry: CycleEntryRow;
  if (existing) {
    runStmt(
      "UPDATE cycle_entries SET type = ?, notes = ? WHERE id = ?",
      type,
      notes || null,
      existing.id
    );
    entry = { ...existing, type: type as CycleEntryRow["type"], notes: notes || null };
  } else {
    const info = runStmt(
      "INSERT INTO cycle_entries (user_id, date, type, notes) VALUES (?, ?, ?, ?)",
      req.userId!,
      date,
      type,
      notes || null
    );
    entry = getRow<CycleEntryRow>(
      "SELECT * FROM cycle_entries WHERE id = ?",
      Number(info.lastInsertRowid)
    )!;
  }

  res.json({ entry: toEntryJson(entry) });
}

export async function deleteEntry(req: AuthedRequest, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw badRequest("INVALID_ID", "Некорректный идентификатор");
  }
  entryById(req, id);
  runStmt("DELETE FROM cycle_entries WHERE id = ?", id);
  res.json({ ok: true });
}

export async function markStartToday(req: AuthedRequest, res: Response): Promise<void> {
  const today = toISODate(new Date());
  const existing = getRow<CycleEntryRow>(
    "SELECT * FROM cycle_entries WHERE user_id = ? AND date = ?",
    req.userId!,
    today
  );

  let entry: CycleEntryRow;
  if (existing) {
    runStmt("UPDATE cycle_entries SET type = 'period_start' WHERE id = ?", existing.id);
    entry = { ...existing, type: "period_start" };
  } else {
    const info = runStmt(
      "INSERT INTO cycle_entries (user_id, date, type) VALUES (?, ?, ?)",
      req.userId!,
      today,
      "period_start"
    );
    entry = getRow<CycleEntryRow>(
      "SELECT * FROM cycle_entries WHERE id = ?",
      Number(info.lastInsertRowid)
    )!;
  }

  res.json({ entry: toEntryJson(entry) });
}