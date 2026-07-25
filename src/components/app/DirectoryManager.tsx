import { useState } from "react";
import { Siren, List, Eye, EyeOff, Trash2, Check, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import IconButton from "./IconButton";
import type { DirectoryEntry } from "../../lib/repositories/directory.repository";

type Props = {
  entries: DirectoryEntry[];
  /** Barrio elegido en el selector del panel (multi-barrio). */
  barrioId: string;
};

const CATEGORIES = [
  { value: "seguridad", label: "Seguridad" },
  { value: "emergencia", label: "Emergencias" },
  { value: "salud", label: "Salud" },
  { value: "servicio", label: "Servicios" },
];

const inputClass = "field";

const EMPTY = {
  title: "",
  subtitle: "",
  phone: "",
  category: "servicio",
  is_priority: false,
};

export default function DirectoryManager({ entries, barrioId }: Props) {
  const [items, setItems] = useState(entries);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Errores de acciones sobre la lista (ocultar, priorizar, borrar)
  const [listError, setListError] = useState<string | null>(null);

  const refresh = async () => {
    const { data } = await supabaseBrowser
      .from("directory_entries")
      .select("*")
      .eq("barrio_id", barrioId)
      .order("position");
    if (data) setItems(data);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.phone.trim()) {
      setError("Título y teléfono son obligatorios");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: insError } = await supabaseBrowser
      .from("directory_entries")
      .insert({
        barrio_id: barrioId,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        phone: form.phone.trim(),
        category: form.category,
        is_priority: form.is_priority,
        // max(position)+1: items.length+1 repite posiciones después de borrar
        position: Math.max(0, ...items.map((i) => i.position ?? 0)) + 1,
      });

    if (insError) {
      console.error(insError);
      setError("Error creando el teléfono");
    } else {
      setForm(EMPTY);
      await refresh();
    }
    setSaving(false);
  };

  const toggleActive = async (entry: DirectoryEntry) => {
    setListError(null);
    const { error: updError } = await supabaseBrowser
      .from("directory_entries")
      .update({ is_active: !entry.is_active })
      .eq("id", entry.id);
    if (updError) {
      console.error(updError);
      setListError("Error cambiando la visibilidad. Probá de nuevo.");
      return;
    }
    await refresh();
  };

  const togglePriority = async (entry: DirectoryEntry) => {
    setListError(null);
    const { error: updError } = await supabaseBrowser
      .from("directory_entries")
      .update({ is_priority: !entry.is_priority })
      .eq("id", entry.id);
    if (updError) {
      console.error(updError);
      setListError("Error cambiando la prioridad. Probá de nuevo.");
      return;
    }
    await refresh();
  };

  const remove = async (id: string) => {
    setListError(null);
    const { error: delError } = await supabaseBrowser
      .from("directory_entries")
      .delete()
      .eq("id", id);
    if (delError) {
      console.error(delError);
      setListError("Error borrando el teléfono. Probá de nuevo.");
    } else {
      await refresh();
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Alta */}
      <form
        onSubmit={create}
        className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Nombre (ej: Defensa Civil) *"
          className={inputClass}
        />
        <input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Teléfono completo (ej: +541147XXXXXX o 103) *"
          className={inputClass}
        />
        <input
          value={form.subtitle}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          placeholder="Subtítulo (ej: Atención 24hs)"
          className={inputClass}
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={`${inputClass} select-field`}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={form.is_priority}
            onChange={(e) =>
              setForm({ ...form, is_priority: e.target.checked })
            }
          />
          Card grande de emergencias
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Guardando…" : "+ Agregar teléfono"}
        </button>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      </form>

      {listError && (
        <p role="alert" className="text-sm text-red-600">
          {listError}
        </p>
      )}

      {/* Lista (scroll propio) */}
      <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {items.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p
                className={`text-sm font-semibold ${entry.is_active ? "" : "text-gray-400 line-through"}`}
              >
                {entry.is_priority && "⭐ "}
                {entry.title}{" "}
                <span className="font-normal text-gray-500">
                  · {entry.phone}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {entry.category}
                {entry.subtitle ? ` · ${entry.subtitle}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {confirmDelete === entry.id ? (
                <>
                  <span className="text-xs font-semibold text-red-600">
                    ¿Borrar?
                  </span>
                  <IconButton
                    label="Sí, borrar"
                    variant="danger"
                    onClick={() => remove(entry.id)}
                  >
                    <Check size={16} />
                  </IconButton>
                  <IconButton
                    label="Cancelar"
                    onClick={() => setConfirmDelete(null)}
                  >
                    <X size={16} />
                  </IconButton>
                </>
              ) : (
                <>
                  <IconButton
                    label={
                      entry.is_priority
                        ? "Mover al directorio general"
                        : "Mover a emergencias prioritarias"
                    }
                    variant="warning"
                    active={entry.is_priority}
                    onClick={() => togglePriority(entry)}
                  >
                    {entry.is_priority ? (
                      <List size={16} />
                    ) : (
                      <Siren size={16} />
                    )}
                  </IconButton>
                  <IconButton
                    label={
                      entry.is_active
                        ? "Ocultar del sitio"
                        : "Mostrar en el sitio"
                    }
                    onClick={() => toggleActive(entry)}
                  >
                    {/* Mismo criterio que AdminBusinesses: EyeOff = "ocultar" cuando está visible */}
                    {entry.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                  <IconButton
                    label="Borrar"
                    variant="danger"
                    onClick={() => setConfirmDelete(entry.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
