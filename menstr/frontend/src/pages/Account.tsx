import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiError, userApi } from "../api";

export default function Account() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [cycleLength, setCycleLength] = useState(user?.cycle_length ?? 28);
  const [lengthPassword, setLengthPassword] = useState("");
  const [curPassword, setCurPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  async function saveEmail(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const data = await userApi.update({ email: email.trim(), password: emailPassword });
      updateUser(data.user);
      setEmailPassword("");
      setSuccess("Email обновлён");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveCycleLength(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      const data = await userApi.update({ cycle_length: cycleLength, password: lengthPassword });
      updateUser(data.user);
      setLengthPassword("");
      setSuccess("Длина цикла обновлена");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function doChangePassword(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    if (newPassword.length < 8) {
      setError("Новый пароль должен содержать минимум 8 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Новые пароли не совпадают");
      return;
    }
    setBusy(true);
    try {
      await userApi.changePassword(curPassword, newPassword);
      setCurPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Пароль изменён");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!window.confirm("Аккаунт и все записи цикла будут удалены безвозвратно. Продолжить?")) {
      return;
    }
    resetMessages();
    setBusy(true);
    try {
      await userApi.deleteAccount();
      await logout();
      navigate("/");
    } catch (err) {
      setError(formatApiError(err));
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="page-header">
          <h1 className="page-title">Аккаунт</h1>
          <p className="page-sub">Управление профилем и настройками цикла</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="grid grid-2">
          <div className="card">
            <h2 className="section-title">Профиль</h2>
            <div className="info-row">
              <span className="info-row-label">Email</span>
              <span>{user?.email}</span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Дата регистрации</span>
              <span>
                {user?.created_at
                  ? new Date(user.created_at + "Z").toLocaleDateString("ru-RU")
                  : ""}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">Длина цикла</span>
              <span>{user?.cycle_length} дней</span>
            </div>

            <form onSubmit={saveEmail} className="field" style={{ marginTop: 16 }}>
              <label>Смена email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginBottom: 8 }}
              />
              <input
                type="password"
                className="input"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Текущий пароль для подтверждения"
                required
                style={{ marginBottom: 8 }}
              />
              <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                Сохранить email
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Параметры цикла</h2>
            <p style={{ fontSize: 14, color: "var(--text-soft)" }}>
              Средняя длина цикла используется для прогноза следующих месячных.
            </p>
            <form onSubmit={saveCycleLength}>
              <div className="range-wrap" style={{ margin: "12px 0" }}>
                <input
                  type="range"
                  min={21}
                  max={40}
                  value={cycleLength}
                  onChange={(e) => setCycleLength(Number(e.target.value))}
                  aria-label="Длина цикла в днях"
                />
                <span className="range-value">{cycleLength} дн.</span>
              </div>
              <input
                type="password"
                className="input"
                value={lengthPassword}
                onChange={(e) => setLengthPassword(e.target.value)}
                placeholder="Текущий пароль для подтверждения"
                required
                style={{ marginBottom: 10 }}
              />
              <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                Сохранить длину цикла
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="section-title">Пароль</h2>
            <form onSubmit={doChangePassword}>
              <div className="field">
                <input
                  type="password"
                  className="input"
                  value={curPassword}
                  onChange={(e) => setCurPassword(e.target.value)}
                  placeholder="Текущий пароль"
                  required
                />
              </div>
              <div className="field">
                <input
                  type="password"
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Новый пароль (мин. 8 символов)"
                  required
                />
              </div>
              <div className="field">
                <input
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                  required
                />
              </div>
              <button className="btn btn-primary btn-block" disabled={busy} type="submit">
                Сменить пароль
              </button>
            </form>
          </div>

          <div className="card" style={{ borderColor: "rgba(214,48,49,0.4)" }}>
            <h2 className="section-title" style={{ color: "var(--danger)" }}>
              Опасная зона
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-soft)" }}>
              Удаление аккаунта безвозвратно удалит все записи цикла, уведомления и профиль.
            </p>
            <button className="btn btn-danger btn-block" disabled={busy} onClick={doDelete}>
              Удалить аккаунт
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}