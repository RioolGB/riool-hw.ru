import { useEffect, useRef, useState, useCallback } from "react";
import { notificationsApi } from "../api";
import { NotificationsData } from "../types";
import { BellIcon } from "./icons";

export default function NotificationsBell() {
  const [data, setData] = useState<NotificationsData>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await notificationsApi.list();
      setData(d);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function markRead(id: number) {
    try {
      await notificationsApi.markRead(id);
      setData((prev) => ({
        items: prev.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unread: Math.max(0, prev.unread - 1)
      }));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} aria-label="Уведомления">
        <BellIcon />
        {data.unread > 0 && <span className="badge-dot">{data.unread}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-panel-title">Уведомления</div>
          {data.items.length === 0 ? (
            <div className="bell-empty">Пока нет уведомлений</div>
          ) : (
            data.items.map((n) => (
              <button
                key={n.id}
                className={`notif-item${n.isRead ? "" : " unread"}`}
                onClick={() => markRead(n.id)}
              >
                <div className="notif-item-title">{n.title}</div>
                <div className="notif-item-body">{n.body}</div>
                <div className="notif-item-time">
                  {new Date(n.createdAt + "Z").toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}