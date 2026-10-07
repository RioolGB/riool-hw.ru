import { Request, Response } from "express";
import { allRows, getRow } from "../db";
import { notFound } from "../utils/errors";

interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  cover_image: string | null;
  content: string | null;
  published_at: string | null;
}

function publicArticle(row: ArticleRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    coverImage: row.cover_image,
    publishedAt: row.published_at
  };
}

export async function listArticles(_req: Request, res: Response): Promise<void> {
  const rows = allRows<ArticleRow>(
    "SELECT * FROM articles WHERE is_published = 1 ORDER BY published_at DESC"
  );
  res.json({ articles: rows.map(publicArticle) });
}

export async function getArticle(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug);
  const row = getRow<ArticleRow>("SELECT * FROM articles WHERE slug = ? AND is_published = 1", slug);

  if (!row) {
    throw notFound("ARTICLE_NOT_FOUND", "Статья не найдена");
  }

  res.json({
    article: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      coverImage: row.cover_image,
      content: row.content,
      publishedAt: row.published_at
    }
  });
}