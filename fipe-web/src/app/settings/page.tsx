"use client";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Configuración
      </h1>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Acá vamos a poner: cuentas (BBVA/Galicia/Santander/DolarApp), defaults,
          categorías, y opciones de importación.
        </p>
      </div>
    </div>
  );
}
