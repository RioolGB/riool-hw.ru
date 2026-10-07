import { allRows, CycleEntryRow, getRow, UserRow } from "../db";
import { currentCycleData } from "../services/cycleService";
import { tomorrowISO } from "../utils/dates";
import { sendPeriodReminder } from "../services/emailService";
import { createNotification } from "../services/notificationService";

export function runDailyReminder(): void {
  const users = allRows<UserRow>("SELECT * FROM users");
  const tomorrow = tomorrowISO();
  const today = new Date();
  let sent = 0;

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (const user of users) {
    const entries = allRows<CycleEntryRow>(
      "SELECT * FROM cycle_entries WHERE user_id = ?",
      user.id
    );

    const data = currentCycleData(entries, user.cycle_length, startOfToday);
    if (!data.nextStart || data.nextStart !== tomorrow) continue;

    const notificationExists = getRow<{ c: number }>(
      "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND type = 'cycle_reminder' AND date(created_at) >= date('now', '-1 day')",
      user.id
    );
    if (notificationExists && notificationExists.c > 0) continue;

    createNotification(
      user.id,
      "Скоро месячные",
      `Завтра (${tomorrow}) ожидается начало цикла. Будьте готовы.`,
      "cycle_reminder"
    );

    console.log(
      `[reminder] Пользователь ${user.email}: прогноз — ${data.nextStart}, день цикла — ${data.cycleDay}`
    );

    sendPeriodReminder(user.email, data.nextStart, data.cycleDay ?? 0)
      .then(() => {
        sent += 1;
      })
      .catch((err: unknown) => {
        console.error(
          `[reminder] Ошибка отправки письма для ${user.email}:`,
          err instanceof Error ? err.message : err
        );
      });
  }

  if (sent > 0 || users.length > 0) {
    console.log(`[reminder] Job завершён. Пользователей проверено: ${users.length}`);
  }
}

let jobTimer: NodeJS.Timeout | null = null;

export function startReminderJob(): void {
  if (jobTimer) clearInterval(jobTimer);
  runDailyReminder();
  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
  jobTimer = setInterval(runDailyReminder, CHECK_INTERVAL_MS);
  console.log("[reminder] Email-job запущен (проверка каждые 6 часов)");
}

export function stopReminderJob(): void {
  if (jobTimer) {
    clearInterval(jobTimer);
    jobTimer = null;
  }
}