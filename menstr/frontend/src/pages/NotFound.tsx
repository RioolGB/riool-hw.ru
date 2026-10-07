import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="page">
      <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
        <h1 style={{ fontSize: 72, color: "var(--accent)", marginBottom: 8 }}>404</h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          Такой страницы не существует.
        </p>
        <Link to="/" className="btn btn-primary">
          На главную
        </Link>
      </div>
    </main>
  );
}