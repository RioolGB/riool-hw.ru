import { useState, ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { ArrowRightIcon, CalendarIcon, BellIcon, ArticleIcon } from "../components/icons";

interface Slide {
  icon: ReactElement;
  title: string;
  text: string;
}

const SLIDES: Slide[] = [
  {
    icon: <CalendarIcon size={56} />,
    title: "Трекер цикла",
    text: "Отмечайте дни месячных в календаре — CycleTracker автоматически рассчитает фазы цикла и длину."
  },
  {
    icon: <BellIcon size={56} />,
    title: "Прогнозы и уведомления",
    text: "Мы предупредим заранее о следующих месячных, чтобы вы были готовы, но не думали об этом весь месяц."
  },
  {
    icon: <ArticleIcon size={56} />,
    title: "Полезные статьи",
    text: "Простые и понятные материалы о цикле, фертильном окне, ПМС и самочувствии — для спокойствия и понимания."
  },
  {
    icon: (
      <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 8.5c.7-1 1.9-1.5 3-1.5 2 0 3 1 3 2.2 0 3.8-6 2.3-6 5.8 0 .9.7 1.5 1.6 1.5" />
        <circle cx="12" cy="18" r="0.4" fill="currentColor" />
      </svg>
    ),
    title: "Приватность",
    text: "Пароль надёжно зашифрован, а сессия защищена токенами. Ваши данные принадлежат только вам."
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  function finish() {
    localStorage.setItem("onboarding_completed", "true");
    navigate("/register");
  }

  function skip() {
    localStorage.setItem("onboarding_completed", "true");
    navigate("/");
  }

  const slide = SLIDES[Math.min(index, SLIDES.length - 1)];

  return (
    <div className="ob-shell">
      <div className="ob-theme-toggle">
        <ThemeToggle />
      </div>

      <div className="ob-card">
        <div className="ob-illustration" style={{ color: "var(--accent)" }}>
          {slide.icon}
        </div>
        <h1 className="ob-title">{slide.title}</h1>
        <p className="ob-text">{slide.text}</p>

        <div className="ob-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`ob-dot${i === index ? " active" : ""}`} />
          ))}
        </div>

        <div className="ob-actions">
          {!isLast && (
            <button className="btn btn-ghost" onClick={skip}>
              Пропустить
            </button>
          )}
          <button className="btn btn-primary" onClick={isLast ? finish : () => setIndex((i) => i + 1)}>
            {isLast ? "Начать" : "Далее"}
            {!isLast && <ArrowRightIcon size={16} />}
          </button>
        </div>

        {isLast && (
          <div style={{ marginTop: 16, fontSize: 14, color: "var(--text-soft)" }}>
            Уже есть аккаунт?{" "}
            <Link
              to="/login"
              onClick={() => localStorage.setItem("onboarding_completed", "true")}
            >
              Войти
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}