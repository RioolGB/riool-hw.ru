import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

export default function Landing() {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div className="landing">
        <div className="landing-brand">
          Cycle<span className="heart">Tracker</span>
        </div>
        <p className="landing-tagline">
          Понятный трекер менструального цикла: календарь, прогнозы и полезные статьи —
          всё в одном месте.
        </p>
        <div className="landing-actions">
          <Link to="/register" className="btn btn-primary">
            Начать
          </Link>
          <Link to="/login" className="btn btn-ghost">
            Войти
          </Link>
          <Link to="/articles" className="btn btn-ghost">
            Статьи
          </Link>
        </div>
      </div>
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle />
      </div>
    </div>
  );
}