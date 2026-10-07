import { useCallback, useEffect, useState } from "react";
import { cycleApi } from "../api";
import { formatApiError } from "../api";
import { CycleSummary } from "../types";
import { formatDate } from "../api";
import { Spinner } from "../components/ProtectedRoute";

export default function Today() {
  const [summary, setSummary] = useState<CycleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setSummary(await cycleApi.summary());
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markStart() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await cycleApi.markStartToday();
      setMessage("Начало цикла отмечено. Прогноз обновлён!");
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  const phaseClass: Record<string, string> = {
    menstruation: "Менструация",
    follicular: "Фолликулярная фаза",
    ovulation: "Овуляция",
    luteal: "Лютеиновая фаза"
  };

  const phaseDescriptions: Record<string, string> = {
    menstruation: "Организм восстанавливается. Тепло, отдых и вода — лучшие помощники в эти дни.",
    follicular: "Энергия растёт. Отличное время для новых задач, тренировок и планов.",
    ovulation: "Самый фертильный период цикла. Наблюдайте за признаками овуляции.",
    luteal: "Растёт прогестерон. Следите за сном, питанием и будьте добрее к себе."
  };

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Сегодня</h1>
          <p className="page-sub">{formatDate(new Date().toISOString())}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <div className="today-hero">
          <div className="today-day-label">День цикла</div>
          {summary?.cycleDay ? (
            <>
              <div className="today-day-number">{summary.cycleDay}</div>
              <div className="today-phase">
                {summary.phase && phaseClass[summary.phase]}
              </div>
              <p className="today-phase-desc">
                {summary.phase && phaseDescriptions[summary.phase]}
              </p>
            </>
          ) : (
            <>
              <div className="today-day-number" style={{ fontSize: 28, padding: "14px 0 4px" }}>
                Цикл пока не начат
              </div>
              <p className="today-phase-desc">
                Отметьте первый день месячных, и трекер начнёт строить прогнозы и подсказки.
              </p>
            </>
          )}

          <div className="today-actions">
            <button className="btn btn-overlay" disabled={busy} onClick={markStart}>
              {busy ? "Отмечаем…" : "Отметить начало цикла"}
            </button>
          </div>
        </div>

        {summary?.cycleDay !== null && summary && (
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">
                {summary.nextPeriodStart ? formatDate(summary.nextPeriodStart) : "—"}
              </div>
              <div className="stat-label">Следующие месячные</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {summary.daysUntilNext !== null ? `${summary.daysUntilNext} дн.` : "—"}
              </div>
              <div className="stat-label">До следующего цикла</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {summary.fertileWindow ? formatDate(summary.fertileWindow.start) : "—"}
              </div>
              <div className="stat-label">Начало фертильного окна</div>
            </div>
          </div>
        )}

        {summary?.tip && (
          <div className="card tip-card">
            <h3 className="tip-card-title">{summary.tip.title}</h3>
            <p style={{ margin: 0 }}>{summary.tip.text}</p>
          </div>
        )}
      </div>
    </main>
  );
}