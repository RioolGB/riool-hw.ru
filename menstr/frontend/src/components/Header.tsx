import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import NotificationsBell from "./NotificationsBell";

function Logo() {
  return (
    <NavLink to="/" className="logo">
      <span className="logo-badge">C</span>
      <span>CycleTracker</span>
    </NavLink>
  );
}

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />

        <nav className="header-nav">
          {isAuthenticated && (
            <>
              <NavLink to="/today" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                Сегодня
              </NavLink>
              <NavLink
                to="/calendar"
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                Календарь
              </NavLink>
            </>
          )}
          <NavLink
            to="/articles"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Статьи
          </NavLink>
          {isAuthenticated && (
            <NavLink
              to="/account"
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              Аккаунт
            </NavLink>
          )}
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <NotificationsBell />
              <span className="header-user">{user?.email}</span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-ghost btn-sm">
                Войти
              </NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">
                Регистрация
              </NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}