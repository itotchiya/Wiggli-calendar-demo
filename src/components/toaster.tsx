"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type ToastItem = { id: number; line: string };

let pushToast: ((line: string) => void) | null = null;

export function showToast(line: string) {
  pushToast?.(line);
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (line: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, line }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4500);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className="app-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className="app-toast" role="alert" key={toast.id}>
          <span className="app-toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9.4" />
              <path d="m8 12.4 2.7 2.7L16.3 9.5" strokeWidth="2.2" />
            </svg>
          </span>
          <span className="app-toast-line">{toast.line}</span>
          <button
            className="app-toast-close"
            type="button"
            aria-label="Dismiss"
            onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
          >
            <X size={19} />
          </button>
        </div>
      ))}
    </div>
  );
}
