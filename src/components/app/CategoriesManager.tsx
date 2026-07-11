import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import IconButton from "./IconButton";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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

  // Renombrar: cambia el nombre visible; el slug (la URL del filtro) se
  // mantiene para no romper links existentes.
  const saveRename = async (cat: CategoryRow) => {
    const newName = editName.trim();
    if (!newName || newName === cat.name) {
      setEditingId(null);
      return;
    }

    const { error: upError } = await supabaseBrowser
      .from("categories")
      .update({ name: newName })
      .eq("id", cat.id);

    if (upError) {
      console.error(upError);
      setError(
        upError.code === "23505"
          ? "Ya existe una categoría con ese nombre"
          : "Error renombrando la categoría",
      );
    } else {
      setItems((prev) =>
        prev
          .map((c) => (c.id === cat.id ? { ...c, name: newName } : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setError(null);
    }
    setEditingId(null);
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
          className="field flex-1"
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
            {editingId === cat.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(cat);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className="field min-w-0 flex-1 py-1.5"
                />
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconButton
                    label="Guardar nombre"
                    variant="success"
                    onClick={() => saveRename(cat)}
                  >
                    <Check size={16} />
                  </IconButton>
                  <IconButton
                    label="Cancelar"
                    onClick={() => setEditingId(null)}
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{cat.name}</p>
                  <p className="text-xs text-gray-400">
                    {cat.count} negocio{cat.count === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {confirmDelete === cat.id ? (
                    <>
                      <span className="text-xs font-semibold text-red-600">
                        {cat.count > 0
                          ? `¿Seguro? La usan ${cat.count}`
                          : "¿Borrar?"}
                      </span>
                      <IconButton
                        label="Sí, borrar categoría"
                        variant="danger"
                        onClick={() => remove(cat)}
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
                        label="Renombrar"
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditName(cat.name);
                        }}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        label="Borrar"
                        variant="danger"
                        onClick={() => setConfirmDelete(cat.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
