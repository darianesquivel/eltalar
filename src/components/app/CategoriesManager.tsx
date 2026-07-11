import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  count: number;
};

type Props = {
  categories: CategoryRow[];
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function CategoriesManager({ categories }: Props) {
  const [items, setItems] = useState(categories);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const { data, error: insError } = await supabaseBrowser
      .from("categories")
      .insert({ name: name.trim(), slug: slugify(name) })
      .select("id, name, slug")
      .single();

    if (insError || !data) {
      console.error(insError);
      setError(
        insError?.code === "23505"
          ? "Ya existe una categoría con ese nombre"
          : "Error creando la categoría",
      );
    } else {
      setItems((prev) =>
        [...prev, { ...data, count: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setName("");
    }
    setSaving(false);
  };

  const remove = async (cat: CategoryRow) => {
    const { error: delError } = await supabaseBrowser
      .from("categories")
      .delete()
      .eq("id", cat.id);

    if (delError) {
      console.error(delError);
      setError("No se pudo borrar la categoría");
    } else {
      setItems((prev) => prev.filter((c) => c.id !== cat.id));
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={create}
        className="flex gap-3 rounded-2xl bg-white p-5 shadow-sm"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva categoría (ej: Heladería)"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          + Agregar
        </button>
      </form>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((cat) => (
          <li
            key={cat.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold">{cat.name}</p>
              <p className="text-xs text-gray-400">
                {cat.count} negocio{cat.count === 1 ? "" : "s"}
              </p>
            </div>

            {confirmDelete === cat.id ? (
              <div className="flex gap-1">
                <button
                  onClick={() => remove(cat)}
                  className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  {cat.count > 0 ? `¿Seguro? La usan ${cat.count}` : "¿Seguro?"}
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(cat.id)}
                className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                Borrar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
