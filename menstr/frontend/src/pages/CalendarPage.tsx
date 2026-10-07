import { useCallback, useEffect, useState } from "react";
import Calendar, { DayEditor } from "../components/Calendar";
import { cycleApi } from "../api";
import { formatApiError } from "../api";
import { EntryType, MonthEntries } from "../types";
import { currentMonth, todayStr } from "../utils/date";
import { Spinner } from "../components/ProtectedRoute";

export default function CalendarPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<MonthEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      setData(await cycleApi.entries(m));
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  const editingEntry = editingDate
    ? data?.entries.find((e) => e.date === editingDate)
    : undefined;

  async function handleSave(type: EntryType, notes: string) {
    if (!editingDate) return;
    await cycleApi.upsert(editingDate, type, notes);
    setEditingDate(null);
    await load(month);
  }

  async function handleDelete() {
    if (!editingEntry) return;
    await cycleApi.remove(editingEntry.id);
    setEditingDate(null);
    await load(month);
  }

  if (loading && !data) return <Spinner />;

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Календарь</h1>
          <p className="page-sub">
            Нажмите на день, чтобы отметить его. Сегодня: {todayStr()}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <Calendar
          month={month}
          onMonthChange={setMonth}
          entries={data?.entries ?? []}
          predicted={data?.predicted ?? []}
          fertile={data?.fertile ?? []}
          onSelectDay={setEditingDate}
        />
      </div>

      {editingDate && (
        <DayEditor
          date={editingDate}
          current={editingEntry}
          onSave={handleSave}
          onDelete={editingEntry ? handleDelete : undefined}
          onClose={() => setEditingDate(null)}
        />
      )}
    </main>
  );
}