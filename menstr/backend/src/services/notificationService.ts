import { allRows, db, getRow, NotificationRow } from "../db";

export interface InAppNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function createNotification(
  userId: number,
  title: string,
  body: string,
  type: "cycle_reminder" | "system" = "system"
): void {
  db.prepare(
    "INSERT INTO notifications (user_id, title, body, type) VALUES (?, ?, ?, ?)"
  ).run(userId, title, body, type);
}

export function listNotifications(userId: number): { items: InAppNotification[]; unread: number } {
  const rows = allRows<NotificationRow>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50",
    userId
  );

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    body: r.body ?? "",
    type: r.type,
    isRead: r.is_read === 1,
    createdAt: r.created_at
  }));

  return { items, unread: items.filter((i) => !i.isRead).length };
}

export function markNotificationRead(userId: number, id: number): NotificationRow | null {
  const row = getRow<NotificationRow>(
    "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!row) return null;
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(id, userId);
  return { ...row, is_read: 1 };
}

export function markAllRead(userId: number): void {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(userId);
}

export function countUnread(userId: number): number {
  const row = getRow<{ c: number }>(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0",
    userId
  );
  return row?.c ?? 0;
}