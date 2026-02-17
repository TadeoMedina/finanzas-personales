"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function NavBar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Carga" },
    { href: "/history", label: "Historial" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/settings", label: "Configuración" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--fipe-border)] bg-[var(--fipe-surface)]">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6 py-3">
        {/* LEFT — FIPE */}
        <div className="justify-self-start text-base font-semibold tracking-wide text-[var(--fipe-text)]">
          FIPE
        </div>

        {/* CENTER — TABS */}
        <nav className="justify-self-center flex items-center gap-2">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  active
                    ? "bg-[var(--fipe-surface2)] text-[var(--fipe-text)]"
                    : "text-[color:var(--fipe-muted)] hover:bg-[var(--fipe-surface2)] hover:text-[var(--fipe-text)]"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT — THEME */}
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
