import { api } from "./client";
import {
  AdminArticle,
  Article,
  CycleEntry,
  CycleSummary,
  MonthEntries,
  NotificationsData,
  Tip,
  User
} from "../types";

/* Auth */
export const authApi = {
  register: (email: string, password: string) =>
    api<{ user: User; accessToken: string }>("/auth/register", {
      method: "POST",
      json: { email, password }
    }),
  login: (email: string, password: string) =>
    api<{ user: User; accessToken: string }>("/auth/login", {
      method: "POST",
      json: { email, password }
    }),
  logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" })
};

/* User */
export const userApi = {
  me: () => api<{ user: User }>("/me"),
  update: (payload: { email?: string; cycle_length?: number; password: string }) =>
    api<{ user: User }>("/me", { method: "PATCH", json: payload }),
  changePassword: (current_password: string, new_password: string) =>
    api<{ ok: boolean }>("/me/change-password", {
      method: "POST",
      json: { current_password, new_password }
    }),
  deleteAccount: () => api<{ ok: boolean }>("/me", { method: "DELETE" })
};

/* Cycle */
export const cycleApi = {
  summary: () => api<CycleSummary>("/cycle/summary"),
  entries: (month: string) =>
    api<MonthEntries>(`/cycle/entries?month=${month}`),
  upsert: (date: string, type: CycleEntry["type"], notes?: string) =>
    api<{ entry: CycleEntry }>("/cycle/entries", {
      method: "POST",
      json: { date, type, notes }
    }),
  remove: (id: number) =>
    api<{ ok: boolean }>(`/cycle/entries/${id}`, { method: "DELETE" }),
  markStartToday: () =>
    api<{ entry: CycleEntry }>("/cycle/mark-start-today", { method: "POST", json: {} })
};

/* Articles */
export const articlesApi = {
  list: () => api<{ articles: Article[] }>("/articles"),
  get: (slug: string) => api<{ article: Article }>(`/articles/${slug}`)
};

/* Notifications */
export const notificationsApi = {
  list: () => api<NotificationsData>("/notifications"),
  markRead: (id: number) =>
    api<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" })
};

/* Admin */
export const adminApi = {
  login: (password: string) =>
    api<{ accessToken: string }>("/admin/login", { method: "POST", json: { password } }),

  listArticles: (token: string) =>
    api<{ articles: AdminArticle[] }>("/admin/articles", {
      headers: { Authorization: `Bearer ${token}` }
    }),
  createArticle: (token: string, payload: Partial<AdminArticle>) =>
    api<{ article: AdminArticle }>("/admin/articles", {
      method: "POST",
      json: payload,
      headers: { Authorization: `Bearer ${token}` }
    }),
  updateArticle: (token: string, id: number, payload: Partial<AdminArticle>) =>
    api<{ article: AdminArticle }>(`/admin/articles/${id}`, {
      method: "PUT",
      json: payload,
      headers: { Authorization: `Bearer ${token}` }
    }),
  deleteArticle: (token: string, id: number) =>
    api<{ ok: boolean }>(`/admin/articles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }),
  uploadCover: (token: string, id: number, file: File) => {
    const form = new FormData();
    form.append("cover", file);
    return api<{ article: AdminArticle }>(`/admin/articles/${id}/cover`, {
      method: "POST",
      form,
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  listTips: (token: string) =>
    api<{ tips: Tip[] }>("/admin/tips", { headers: { Authorization: `Bearer ${token}` } }),
  createTip: (token: string, payload: { cycleDay: number; title: string; text: string }) =>
    api<{ tip: Tip }>("/admin/tips", {
      method: "POST",
      json: { cycle_day: payload.cycleDay, title: payload.title, text: payload.text },
      headers: { Authorization: `Bearer ${token}` }
    }),
  updateTip: (token: string, id: number, payload: { cycleDay: number; title: string; text: string }) =>
    api<{ tip: Tip }>(`/admin/tips/${id}`, {
      method: "PUT",
      json: { cycle_day: payload.cycleDay, title: payload.title, text: payload.text },
      headers: { Authorization: `Bearer ${token}` }
    }),
  deleteTip: (token: string, id: number) =>
    api<{ ok: boolean }>(`/admin/tips/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
};

export function formatApiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}