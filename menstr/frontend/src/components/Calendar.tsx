import { useMemo, useState } from "react";
import { CycleEntry, EntryType } from "../types";
import { isSameDay, monthLabel, todayStr, dayKey } from "../utils/date";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface DayCell {
  key: string;
  date: string;
  outside: boolean;
}

interface CalendarProps {
  month: string;
  onMonthChange: (month: string) => void;
  entries: CycleEntry[];
  predicted: string[];
  fertile: string[];
  onSelectDay: (date: string) => void;
}

export default function Calendar({ month, onMonthChange, entries, predicted, fertile, onSelectDay }: CalendarProps) {
  const { year, monthNum } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return { year: y, monthNum: m };
  }, [month]);

  const cells = useMemo(() => {
    const firstDow = new Date(year, monthNum - 1, 1).getDay();
    const offset = (firstDow + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const prevDays = new Date(year, monthNum - 1, 0).getDate();

    const list: DayCell[] = [];
    for (let i = offset - 1; i >= 0; i--) {
      const d = `${year}-${String(monthNum - 1).padStart(2, "0")}-${String(prevDays - i).padStart(2, "0")}`;
      list.push({ key: "p" + i, date: d, outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({
        key: "c" + d,
        date: `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        outside: false
      });
    }
    const total = list.length;
    for (let i = total; i < 42; i++) {
      const nextDay = i - total + 1;
      list.push({
        key: "n" + i,
        date: `${year}-${String(monthNum + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`,
        outside: true
      });
    }
    return list;
  }, [year, monthNum]);

  const entryByDate = useMemo(() => {
    const map = new Map<string, CycleEntry>();
    for (const e of entries) map.set(e.date, e);
    return map;
  }, [entries]);

  const predictedSet = useMemo(() => new Set(predicted), [predicted]);
  const fertileSet = useMemo(() => new Set(fertile), [fertile]);
  const today = todayStr();

  function shiftMonth(delta: number) {
    const d = new Date(year, monthNum - 1 + delta, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="calendar-card">
      <div className="calendar-header">
        <div className="calendar-month">{monthLabel(month)}</div>
        <div className="calendar-month-nav">
          <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
            <ChevronLeftIcon />
          </button>
          <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {DOW.map((d) => (
          <div key={d} className="calendar-dow">
            {d}
          </div>
        ))}

        {cells.map((cell) => {
          const entry = entryByDate.get(cell.date);
          let cls = "cal-day" + (cell.outside ? " outside" : "");
          if (!cell.outside && (entry?.type === "period_start" || entry?.type === "period_day")) {
            cls = "cal-day period";
          } else if (predictedSet.has(cell.date)) {
            cls += " predicted";
          } else if (fertileSet.has(cell.date)) {
            cls += " fertile";
          }
          if (isSameDay(cell.date, today)) cls += " today";

          const dayNum = Number(cell.date.slice(8));
          return (
            <button
              key={cell.key}
              className={cls}
              onClick={() => onSelectDay(cell.date)}
              disabled={cell.outside}
            >
              {dayNum}
              {entry?.notes && <span className="marker" title={entry.notes} />}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--period)" }} />
          Месячные
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--predicted-soft)", border: "1px dashed var(--predicted)" }} />
          Прогноз
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--fertile-soft)", border: "1px solid var(--fertile-border)" }} />
          Фертильное окно
        </span>
      </div>
    </div>
  );
}

interface DayEditorProps {
  date: string;
  current?: CycleEntry;
  onSave: (type: EntryType, notes: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function DayEditor({ date, current, onSave, onDelete, onClose }: DayEditorProps) {
  const [type, setType] = useState<EntryType>(current?.type ?? "none");
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const choices: Array<{ value: EntryType; label: string; desc: string; color: string }> = [
    { value: "period_start", label: "Начало цикла", desc: "Первый день месячных", color: "var(--period)" },
    { value: "period_day", label: "Месячные", desc: "Один из дней месячных", color: "var(--period)" },
    { value: "none", label: "Обычный день", desc: "Без отметки", color: "var(--border)" }
  ];

  async function save() {
    setBusy(true);
    try {
      await onSave(type, notes);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Отметить день</div>
        <div className="modal-sub">{dayKey(date)}</div>

        <div className="type-choices">
          {choices.map((c) => (
            <button
              key={c.value}
              className={`type-choice${type === c.value ? " selected" : ""}`}
              onClick={() => setType(c.value)}
            >
              <span className="type-dot" style={{ background: c.color }} />
              <span>
                {c.label}
                <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--text-soft)" }}>
                  {c.desc}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="day-notes">Заметка (необязательно)</label>
          <textarea
            id="day-notes"
            className="input"
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Самочувствие, симптомы…"
          />
        </div>

        <div className="modal-actions">
          {current && onDelete && (
            <button
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Удалить
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}