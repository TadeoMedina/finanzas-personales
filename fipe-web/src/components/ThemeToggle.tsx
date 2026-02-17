"use client";

import { useEffect, useState } from "react";

const KEY = "fipe.theme";

type Theme = "dark" | "light";

function resolveInitialTheme(): Theme {
  // OJO: esto se llama SOLO en useEffect (cliente)
  const stored = window.localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light") return stored;

  const prefersDark =
    window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;

  return prefersDark ? "dark" : "light";
}

export default function ThemeToggle() {
  // Importante: estado inicial fijo (mismo en server y en el primer render del cliente)
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const t = resolveInitialTheme();
    setTheme(t);

    const html = document.documentElement;
    html.classList.toggle("dark", t === "dark");
    window.localStorage.setItem(KEY, t);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);

    const html = document.documentElement;
    html.classList.toggle("dark", next === "dark");
    window.localStorage.setItem(KEY, next);
  }

  return (
    <button
      onClick={toggle}
      className="rounded-xl border border-[var(--fipe-border)] bg-[var(--fipe-surface)] px-3 py-2 text-sm transition hover:bg-[var(--fipe-surface2)]"
      aria-label="Cambiar tema"
      title="Cambiar tema"
      type="button"
    >
      {/* Evita mismatch si el icono cambia post-mount */}
      <span suppressHydrationWarning>
        {mounted ? (theme === "dark" ? "☀️" : "🌙") : "🌙"}
      </span>
    </button>
  );
}
