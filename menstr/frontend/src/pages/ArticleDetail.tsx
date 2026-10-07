import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { articlesApi, formatApiError } from "../api";
import { Article } from "../types";
import { ArticleIcon } from "../components/icons";
import { Spinner } from "../components/ProtectedRoute";

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError("");
    articlesApi
      .get(slug)
      .then((data) => setArticle(data.article))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <Spinner />;

  if (error || !article) {
    return (
      <main className="page">
        <div className="container">
          <div className="alert alert-error">{error || "Статья не найдена"}</div>
          <Link to="/articles" className="btn btn-ghost">
            Назад к статьям
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <Link to="/articles" className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>
          Назад к статьям
        </Link>

        <div className="article-cover-hero">
          {article.coverImage ? (
            <img src={article.coverImage} alt={article.title} />
          ) : (
            <ArticleIcon size={64} />
          )}
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800 }}>{article.title}</h1>
        <div className="article-meta">
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })
            : ""}
        </div>

        {article.content && (
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.content }} />
        )}
      </div>
    </main>
  );
}