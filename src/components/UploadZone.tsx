"use client";

import { useCallback, useRef, useState } from "react";
import type { CreditReport } from "@/lib/parser/types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface UploadZoneProps {
  onParsed: (report: CreditReport) => void;
}

export function UploadZone({ onParsed }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/analyze", { method: "POST", body: form });
        const body = (await res.json()) as ApiResponse<CreditReport>;
        if (!body.success || !body.data) {
          setError(body.error ?? "Не удалось разобрать отчёт");
          return;
        }
        onParsed(body.data);
      } catch {
        setError("Сервер недоступен. Попробуйте ещё раз.");
      } finally {
        setIsLoading(false);
      }
    },
    [onParsed],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void upload(file);
    },
    [upload],
  );

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        disabled={isLoading}
        className={`group relative w-full rounded-2xl border-2 border-dashed px-8 py-10 text-center transition-all duration-200 cursor-pointer
          ${
            isDragging
              ? "border-accent bg-accent-soft scale-[1.01]"
              : "border-line bg-surface hover:border-accent/60 hover:bg-accent-soft/40"
          }
          ${isLoading ? "opacity-60 cursor-wait" : ""}`}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent transition-transform duration-200 group-hover:-translate-y-0.5">
          {isLoading ? (
            <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <p className="text-lg font-semibold">
          {isLoading ? "Читаем отчёт…" : "Перетащите PDF кредитного отчёта"}
        </p>
        <p className="mt-1 text-sm text-muted">
          НБКИ / ОКБ (Credistory) · до 25 МБ · файл не сохраняется на сервере
        </p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-accent">
          Выбрать файл
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      {error !== null && (
        <div className="mt-4 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
          {error}
        </div>
      )}
    </div>
  );
}
