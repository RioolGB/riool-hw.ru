import { Link } from "react-router-dom";
import { Article } from "../types";
import { ArticleIcon } from "./icons";

function formatPubDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <Link to={`/articles/${article.slug}`} className="article-card">
      <div className="article-cover">
        {article.coverImage ? (
          <img src={article.coverImage} alt={article.title} loading="lazy" />
        ) : (
          <ArticleIcon size={40} />
        )}
      </div>
      <div className="article-card-body">
        <div className="article-card-title">{article.title}</div>
        <div className="article-card-date">{formatPubDate(article.publishedAt)}</div>
      </div>
    </Link>
  );
}