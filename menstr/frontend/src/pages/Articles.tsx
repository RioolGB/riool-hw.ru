import { useEffect, useState } from "react";
import { articlesApi, formatApiError } from "../api";
import { Article } from "../types";
import ArticleCard from "../components/ArticleCard";
import { Spinner } from "../components/ProtectedRoute";

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    articlesApi
      .list()
      .then((data) => setArticles(data.articles))
      .catch((err) => setError(formatApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Статьи</h1>
          <p className="page-sub">Простые материалы о цикле, фертильности и самочувствии</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {articles.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>
            Пока нет статей. Загляните позже!
          </div>
        ) : (
          <div className="article-grid">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}