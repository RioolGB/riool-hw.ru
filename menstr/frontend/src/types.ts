export interface User {
  id: number;
  email: string;
  cycle_length: number;
  created_at: string;
}

export type EntryType = "period_start" | "period_day" | "none";

export interface CycleEntry {
  id: number;
  date: string;
  type: EntryType;
  notes: string | null;
}

export interface CycleSummary {
  cycleDay: number | null;
  phase: "menstruation" | "follicular" | "ovulation" | "luteal" | null;
  phaseLabel: string | null;
  lastPeriodStart: string | null;
  nextPeriodStart: string | null;
  daysUntilNext: number | null;
  ovulationDate: string | null;
  fertileWindow: { start: string; end: string } | null;
  tip: { day: number; title: string; text: string } | null;
}

export interface MonthEntries {
  month: string;
  entries: CycleEntry[];
  predicted: string[];
  fertile: string[];
  cycleLength: number;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  coverImage: string | null;
  content: string | null;
  publishedAt: string | null;
}

export interface NotificationItem {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsData {
  items: NotificationItem[];
  unread: number;
}

export interface AdminArticle extends Article {
  isPublished: boolean;
}

export interface Tip {
  id: number;
  cycleDay: number;
  title: string;
  text: string;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}