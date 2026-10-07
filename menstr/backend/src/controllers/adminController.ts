import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { allRows, getRow, runStmt } from "../db";
import { badRequest, notFound, unauthorized } from "../utils/errors";
import { signAdminToken } from "../utils/jwt";

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123";
}

export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { password } = req.body ?? {};
  if (typeof password !== "string" || password !== adminPassword()) {
    throw unauthorized("WRONG_ADMIN_PASSWORD", "Неверный пароль администратора");
  }
  res.json({ accessToken: signAdminToken() });
}

/* ---------- Articles ---------- */

interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  cover_image: string | null;
  content: string | null;
  published_at: string | null;
  is_published: number;
}

function toArticleJson(a: ArticleRow) {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    coverImage: a.cover_image,
    content: a.content,
    publishedAt: a.published_at,
    isPublished: a.is_published === 1
  };
}

function slugify(slug: string): string {
  const s = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return s || `article-${Date.now()}`;
}

function articleById(id: number): ArticleRow {
  const a = getRow<ArticleRow>("SELECT * FROM articles WHERE id = ?", id);
  if (!a) throw notFound("ARTICLE_NOT_FOUND", "Статья не найдена");
  return a;
}

export function adminListArticles(_req: Request, res: Response): void {
  const rows = allRows<ArticleRow>("SELECT * FROM articles ORDER BY id DESC");
  res.json({ articles: rows.map(toArticleJson) });
}

export function adminCreateArticle(req: Request, res: Response): void {
  const { title, slug, content, cover_image, is_published } = req.body ?? {};

  if (typeof title !== "string" || title.trim().length === 0) {
    throw badRequest("TITLE_REQUIRED", "Укажите заголовок статьи");
  }
  const normalizedSlug = slugify(typeof slug === "string" ? slug : title);
  const existing = getRow<{ id: number }>("SELECT id FROM articles WHERE slug = ?", normalizedSlug);
  if (existing) {
    throw badRequest("SLUG_TAKEN", "Статья с таким slug уже существует");
  }

  const info = runStmt(
    `INSERT INTO articles (title, slug, content, cover_image, published_at, is_published)
     VALUES (?, ?, ?, ?, ?, ?)`,
    title.trim(),
    normalizedSlug,
    typeof content === "string" ? content : "",
    typeof cover_image === "string" && cover_image ? cover_image : null,
    new Date().toISOString(),
    is_published === undefined ? 1 : Number(Boolean(is_published))
  );

  const row = getRow<ArticleRow>("SELECT * FROM articles WHERE id = ?", Number(info.lastInsertRowid));
  res.status(201).json({ article: toArticleJson(row!) });
}

export function adminUpdateArticle(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw badRequest("INVALID_ID", "Некорректный идентификатор");
  }
  const article = articleById(id);

  const { title, slug, content, cover_image, is_published } = req.body ?? {};

  const newTitle = typeof title === "string" && title.trim() ? title.trim() : article.title;
  let newSlug = typeof slug === "string" && slug.trim() ? slugify(slug) : article.slug;
  if (newSlug !== article.slug) {
    const conflict = getRow<{ id: number }>(
      "SELECT id FROM articles WHERE slug = ? AND id != ?",
      newSlug,
      id
    );
    if (conflict) {
      throw badRequest("SLUG_TAKEN", "Статья с таким slug уже существует");
    }
  }

  runStmt(
    `UPDATE articles SET title = ?, slug = ?, content = ?, cover_image = ?, is_published = ?, published_at = ?
     WHERE id = ?`,
    newTitle,
    newSlug,
    typeof content === "string" ? content : article.content ?? "",
    typeof cover_image === "string" && cover_image ? cover_image : article.cover_image,
    is_published === undefined ? article.is_published : Number(Boolean(is_published)),
    article.published_at ?? new Date().toISOString(),
    id
  );

  res.json({ article: toArticleJson(articleById(id)) });
}

export function adminDeleteArticle(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw badRequest("INVALID_ID", "Некорректный идентификатор");
  }
  const article = articleById(id);

  if (article.cover_image) {
    const filename = path.basename(article.cover_image);
    try {
      fs.unlinkSync(path.join(__dirname, "..", "..", "uploads", filename));
    } catch {
      /* ignore */
    }
  }

  runStmt("DELETE FROM articles WHERE id = ?", id);
  res.json({ ok: true });
}

export function adminUploadCover(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw badRequest("INVALID_ID", "Некорректный идентификатор");
  }
  articleById(id);

  const file = req.file;
  if (!file) {
    throw badRequest("FILE_REQUIRED", "Выберите файл изображения");
  }

  runStmt("UPDATE articles SET cover_image = ? WHERE id = ?", `/uploads/${file.filename}`, id);

  res.json({ article: toArticleJson(articleById(id)) });
}

/* ---------- Tips ---------- */

interface TipRow {
  id: number;
  cycle_day: number;
  title: string | null;
  text: string;
}

function toTipJson(t: TipRow) {
  return { id: t.id, cycleDay: t.cycle_day, title: t.title ?? "", text: t.text };
}

function tipById(id: number): TipRow {
  const t = getRow<TipRow>("SELECT * FROM tips WHERE id = ?", id);
  if (!t) throw notFound("TIP_NOT_FOUND", "Подсказка не найдена");
  return t;
}

export function adminListTips(_req: Request, res: Response): void {
  const rows = allRows<TipRow>("SELECT * FROM tips ORDER BY cycle_day, id");
  res.json({ tips: rows.map(toTipJson) });
}

export function adminCreateTip(req: Request, res: Response): void {
  const { cycle_day, text, title } = req.body ?? {};
  const day = Number(cycle_day);
  if (!Number.isInteger(day) || day < 1 || day > 32) {
    throw badRequest("INVALID_CYCLE_DAY", "День цикла должен быть от 1 до 32");
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw badRequest("TEXT_REQUIRED", "Укажите текст подсказки");
  }

  const info = runStmt(
    "INSERT INTO tips (cycle_day, text, title) VALUES (?, ?, ?)",
    day,
    text.trim(),
    typeof title === "string" ? title : null
  );

  res.status(201).json({ tip: toTipJson(tipById(Number(info.lastInsertRowid))) });
}

export function adminUpdateTip(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw badRequest("INVALID_ID", "Некорректный идентификатор");
  }
  const tip = tipById(id);

  const { cycle_day, text, title } = req.body ?? {};
  const day = cycle_day === undefined ? tip.cycle_day : Number(cycle_day);
  if (!Number.isInteger(day) || day < 1 || day > 32) {
    throw badRequest("INVALID_CYCLE_DAY", "День цикла должен быть от 1 до 32");
  }
  const newText = typeof text === "string" && text.trim() ? text.trim() : tip.text;

  runStmt(
    "UPDATE tips SET cycle_day = ?, text = ?, title = ? WHERE id = ?",
    day,
    newText,
    typeof title === "string" ? title : tip.title,
    id
  );

  res.json({ tip: toTipJson(tipById(id)) });
}

export function adminDeleteTip(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw badRequest("INVALID_ID", "Некорректный идентификатор");
  }
  tipById(id);
  runStmt("DELETE FROM tips WHERE id = ?", id);
  res.json({ ok: true });
}