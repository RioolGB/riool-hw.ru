import { useEffect, useState, FormEvent } from "react";
import { adminApi, formatApiError } from "../api";
import { AdminArticle, Tip } from "../types";
import { LockIcon, TrashIcon } from "../components/icons";

const ADMIN_TOKEN_KEY = "admin_token";

function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export default function Admin() {
  return getAdminToken() ? <AdminPanel /> : <AdminLogin />;
}

/* ---------- Login ---------- */
function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await adminApi.login(password);
      localStorage.setItem(ADMIN_TOKEN_KEY, data.accessToken);
      window.location.hash = "";
      // force remount
      window.location.reload();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="auth-card" style={{ margin: "0 auto" }}>
          <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
            <LockIcon size={36} />
          </div>
          <h1 className="auth-title">Админка</h1>
          <p className="auth-sub">Вход по паролю администратора</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="admin-password">Пароль</label>
              <input
                id="admin-password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль из .env"
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? "Проверяем…" : "Войти"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

/* ---------- Panel ---------- */
type Tab = "articles" | "tips";

function AdminPanel() {
  const token = getAdminToken()!;
  const [tab, setTab] = useState<Tab>("articles");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function flashError(err: unknown) {
    setError(formatApiError(err));
    setSuccess("");
  }
  function flashSuccess(msg: string) {
    setSuccess(msg);
    setError("");
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div>
            <h1 className="page-title">Админ-панель</h1>
            <p className="page-sub">Управление статьями и подсказками</p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              localStorage.removeItem(ADMIN_TOKEN_KEY);
              window.location.reload();
            }}
          >
            Выйти из админки
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="tabs">
          <button className={`tab${tab === "articles" ? " active" : ""}`} onClick={() => setTab("articles")}>
            Статьи
          </button>
          <button className={`tab${tab === "tips" ? " active" : ""}`} onClick={() => setTab("tips")}>
            Подсказки
          </button>
        </div>

        {tab === "articles" ? (
          <ArticlesAdmin token={token} flashError={flashError} flashSuccess={flashSuccess} />
        ) : (
          <TipsAdmin token={token} flashError={flashError} flashSuccess={flashSuccess} />
        )}
      </div>
    </main>
  );
}

/* ---------- Articles admin ---------- */
function ArticlesAdmin({
  token,
  flashError,
  flashSuccess
}: {
  token: string;
  flashError: (err: unknown) => void;
  flashSuccess: (msg: string) => void;
}) {
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminArticle | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [posting, setPosting] = useState(false);

  async function load() {
    try {
      const data = await adminApi.listArticles(token);
      setArticles(data.articles);
    } catch (err) {
      flashError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function startCreate() {
    setEditing({ id: 0, title: "", slug: "", coverImage: null, content: "", publishedAt: null, isPublished: true });
    setTitle("");
    setSlug("");
    setContent("");
    setIsPublished(true);
  }

  function startEdit(a: AdminArticle) {
    setEditing(a);
    setTitle(a.title);
    setSlug(a.slug);
    setContent(a.content ?? "");
    setIsPublished(a.isPublished);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setPosting(true);
    try {
      const payload = { title, slug, content, is_published: isPublished };
      if (editing.id === 0) {
        await adminApi.createArticle(token, payload);
        flashSuccess("Статья создана");
      } else {
        await adminApi.updateArticle(token, editing.id, payload);
        flashSuccess("Статья обновлена");
      }
      setEditing(null);
      await load();
    } catch (err) {
      flashError(err);
    } finally {
      setPosting(false);
    }
  }

  async function remove(a: AdminArticle) {
    if (!window.confirm(`Удалить статью «${a.title}»?`)) return;
    try {
      await adminApi.deleteArticle(token, a.id);
      flashSuccess("Статья удалена");
      await load();
    } catch (err) {
      flashError(err);
    }
  }

  async function uploadCover(a: AdminArticle, file: File | undefined) {
    if (!file) return;
    try {
      await adminApi.uploadCover(token, a.id, file);
      flashSuccess("Обложка обновлена");
      await load();
    } catch (err) {
      flashError(err);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>Загрузка…</p>;

  return (
    <div>
      <button className="btn btn-primary btn-sm" onClick={startCreate} style={{ marginBottom: 16 }}>
        + Новая статья
      </button>

      <div className="admin-list">
        {articles.map((a) => (
          <div key={a.id} className="admin-row">
            <div className="admin-row-main">
              <div className="admin-row-title">{a.title}</div>
              <div className="admin-row-sub">
                /{a.slug} · {a.isPublished ? "опубликована" : "черновик"}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>
              Изменить
            </button>
            <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
              Обложка
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => uploadCover(a, e.target.files?.[0])}
              />
            </label>
            <button className="icon-btn" onClick={() => remove(a)} aria-label="Удалить">
              <TrashIcon size={16} />
            </button>
          </div>
        ))}
        {articles.length === 0 && (
          <div className="card" style={{ color: "var(--muted)", textAlign: "center" }}>
            Статей пока нет
          </div>
        )}
      </div>

      {editing && (
        <form className="admin-form" onSubmit={save}>
          <h3 style={{ marginBottom: 14 }}>{editing.id === 0 ? "Новая статья" : `Статья #${editing.id}`}</h3>
          <div className="grid grid-2">
            <div className="field">
              <label>Заголовок</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Slug (адрес)</label>
              <input
                className="input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-article"
              />
            </div>
          </div>
          <div className="field">
            <label>Контент (HTML или markdown)</label>
            <textarea
              className="input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
            />
          </div>
          <div className="field">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              Опубликована
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={posting} type="submit">
              {posting ? "Сохраняем…" : "Сохранить"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------- Tips admin ---------- */
function TipsAdmin({
  token,
  flashError,
  flashSuccess
}: {
  token: string;
  flashError: (err: unknown) => void;
  flashSuccess: (msg: string) => void;
}) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tip | null>(null);

  const [cycleDay, setCycleDay] = useState(1);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    try {
      const data = await adminApi.listTips(token);
      setTips(data.tips);
    } catch (err) {
      flashError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function startCreate() {
    setEditing({ id: 0, cycleDay: 1, title: "", text: "" });
    setCycleDay(1);
    setTitle("");
    setText("");
  }

  function startEdit(t: Tip) {
    setEditing(t);
    setCycleDay(t.cycleDay);
    setTitle(t.title);
    setText(t.text);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setPosting(true);
    try {
      const payload = { cycleDay, title, text };
      if (editing.id === 0) {
        await adminApi.createTip(token, payload);
        flashSuccess("Подсказка создана");
      } else {
        await adminApi.updateTip(token, editing.id, payload);
        flashSuccess("Подсказка обновлена");
      }
      setEditing(null);
      await load();
    } catch (err) {
      flashError(err);
    } finally {
      setPosting(false);
    }
  }

  async function remove(t: Tip) {
    if (!window.confirm(`Удалить подсказку для дня ${t.cycleDay}?`)) return;
    try {
      await adminApi.deleteTip(token, t.id);
      flashSuccess("Подсказка удалена");
      await load();
    } catch (err) {
      flashError(err);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>Загрузка…</p>;

  return (
    <div>
      <button className="btn btn-primary btn-sm" onClick={startCreate} style={{ marginBottom: 16 }}>
        + Новая подсказка
      </button>

      <div className="admin-list">
        {tips.map((t) => (
          <div key={t.id} className="admin-row">
            <div className="admin-row-main">
              <div className="admin-row-title">День {t.cycleDay}: {t.title}</div>
              <div className="admin-row-sub">{t.text}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>
              Изменить
            </button>
            <button className="icon-btn" onClick={() => remove(t)} aria-label="Удалить">
              <TrashIcon size={16} />
            </button>
          </div>
        ))}
        {tips.length === 0 && (
          <div className="card" style={{ color: "var(--muted)", textAlign: "center" }}>
            Подсказок пока нет
          </div>
        )}
      </div>

      {editing && (
        <form className="admin-form" onSubmit={save}>
          <h3 style={{ marginBottom: 14 }}>{editing.id === 0 ? "Новая подсказка" : `Подсказка #${editing.id}`}</h3>
          <div className="field">
            <label>День цикла (1–32)</label>
            <input
              type="number"
              className="input"
              min={1}
              max={32}
              value={cycleDay}
              onChange={(e) => setCycleDay(Number(e.target.value))}
              required
              style={{ maxWidth: 120 }}
            />
          </div>
          <div className="field">
            <label>Заголовок</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Текст</label>
            <textarea
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              required
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={posting} type="submit">
              {posting ? "Сохраняем…" : "Сохранить"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}