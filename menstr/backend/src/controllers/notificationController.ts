import { Response } from "express";
import { badRequest, notFound } from "../utils/errors";
import { AuthedRequest } from "../middleware/auth";
import { listNotifications, markNotificationRead } from "../services/notificationService";

export async function getNotifications(req: AuthedRequest, res: Response): Promise<void> {
  const data = listNotifications(req.userId!);
  res.json(data);
}

export async function markRead(req: AuthedRequest, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw badRequest("INVALID_ID", "Некорректный идентификатор");
  }
  const updated = markNotificationRead(req.userId!, id);
  if (!updated) {
    throw notFound("NOTIFICATION_NOT_FOUND", "Уведомление не найдено");
  }
  res.json({ ok: true });
}