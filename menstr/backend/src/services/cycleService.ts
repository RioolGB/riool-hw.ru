import { allRows, getRow, CycleEntryRow } from "../db";
import { addDaysISO, diffDays, toISODate } from "../utils/dates";

interface TipLike {
  id: number;
  cycle_day: number;
  title: string | null;
  text: string;
}

export type Phase = "menstruation" | "follicular" | "ovulation" | "luteal";

export const PHASE_LABELS: Record<Phase, string> = {
  menstruation: "Менструация",
  follicular: "Фолликулярная фаза",
  ovulation: "Овуляция",
  luteal: "Лютеиновая фаза"
};

export interface CycleSummary {
  cycleDay: number | null;
  phase: Phase | null;
  phaseLabel: string | null;
  lastPeriodStart: string | null;
  nextPeriodStart: string | null;
  daysUntilNext: number | null;
  ovulationDate: string | null;
  fertileWindow: { start: string; end: string } | null;
  tip: { day: number; title: string; text: string } | null;
}

export function getDescriptionForPhase(phase: Phase | null): string {
  switch (phase) {
    case "menstruation":
      return "Организм восстанавливается. Берегите себя: тепло, отдых и вода — лучшие помощники.";
    case "follicular":
      return "Энергия растёт. Отличное время для новых задач, тренировок и планов.";
    case "ovulation":
      return "Самый фертильный период цикла. Наблюдайте за признаками овуляции.";
    case "luteal":
      return "Прогестерон растёт. Возможны симптомы ПМС — следите за сном и питанием.";
    default:
      return "Отметьте первый день цикла, чтобы трекер начал работать.";
  }
}

function periodStarts(entries: CycleEntryRow[]): string[] {
  return entries
    .filter((e) => e.type === "period_start")
    .map((e) => e.date)
    .sort();
}

export function currentCycleData(
  entries: CycleEntryRow[],
  cycleLength: number,
  today: Date = new Date()
): {
  cycleDay: number | null;
  phase: Phase | null;
  lastStart: string | null;
  nextStart: string | null;
  daysUntilNext: number | null;
  ovulationDate: string | null;
  fertileWindow: { start: string; end: string } | null;
} {
  const starts = periodStarts(entries);
  const lastStart = starts.length ? starts[starts.length - 1] : null;
  const todayISO = toISODate(today);

  if (!lastStart) {
    return {
      cycleDay: null,
      phase: null,
      lastStart: null,
      nextStart: null,
      daysUntilNext: null,
      ovulationDate: null,
      fertileWindow: null
    };
  }

  const diff = diffDays(lastStart, todayISO);
  const cycleDay = (diff % cycleLength) + 1;
  const nextStart = addDaysISO(lastStart, cycleLength);
  const daysUntilNext = Math.max(0, diffDays(todayISO, nextStart));

  const ovulationDay = Math.max(1, cycleLength - 14);
  let phase: Phase;
  if (cycleDay <= 6) phase = "menstruation";
  else if (cycleDay < ovulationDay - 1) phase = "follicular";
  else if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) phase = "ovulation";
  else phase = "luteal";

  const ovulationDate = addDaysISO(lastStart, ovulationDay - 1);
  const fertileWindow = {
    start: addDaysISO(ovulationDate, -4),
    end: addDaysISO(ovulationDate, 4)
  };

  return {
    cycleDay,
    phase,
    lastStart,
    nextStart,
    daysUntilNext,
    ovulationDate,
    fertileWindow
  };
}

export function getCycleSummary(
  userId: number,
  cycleLength: number,
  today: Date = new Date()
): CycleSummary {
  const entries = allRows<CycleEntryRow>(
    "SELECT * FROM cycle_entries WHERE user_id = ?",
    userId
  );

  const data = currentCycleData(entries, cycleLength, today);

  let tip: CycleSummary["tip"] = null;
  if (data.cycleDay !== null) {
    const row = getRow<TipLike>(
      "SELECT * FROM tips WHERE cycle_day = ? ORDER BY id LIMIT 1",
      data.cycleDay
    );
    if (row) tip = { day: row.cycle_day, title: row.title ?? "", text: row.text };
  }

  return {
    cycleDay: data.cycleDay,
    phase: data.phase,
    phaseLabel: data.phase ? PHASE_LABELS[data.phase] : null,
    lastPeriodStart: data.lastStart,
    nextPeriodStart: data.nextStart,
    daysUntilNext: data.daysUntilNext,
    ovulationDate: data.ovulationDate,
    fertileWindow: data.fertileWindow,
    tip
  };
}

export function predictedPeriodDays(
  lastStart: string | null,
  cycleLength: number,
  fromISO: string,
  toISO: string
): string[] {
  if (!lastStart) return [];
  const out: string[] = [];
  const first = diffDays(lastStart, fromISO);
  if (first > 0) return [];

  const periodLen = 5;
  let offset = 0;
  while (true) {
    const day = addDaysISO(lastStart, offset);
    if (day > toISO) break;
    if (day >= fromISO) {
      for (let i = 0; i < periodLen; i++) {
        const d = addDaysISO(day, i);
        if (d > toISO) break;
        if (d >= fromISO) out.push(d);
      }
    }
    offset += cycleLength;
  }
  return out;
}

export function fertileWindowDays(
  fertileWindow: { start: string; end: string } | null,
  fromISO: string,
  toISO: string
): string[] {
  if (!fertileWindow) return [];
  const out: string[] = [];
  let cur = fertileWindow.start;
  while (cur <= fertileWindow.end && cur <= toISO) {
    if (cur >= fromISO) out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
}