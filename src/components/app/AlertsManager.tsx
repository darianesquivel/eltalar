import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Alert = {
  id: string;
  title: string;
  description: string;
  is_active: boolean | null;
};

type Props = {
  alerts: Alert[];
};

export default function AlertsManager({ alerts }: Props) {
  const [items, setItems] = useState(alerts);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const { data } = await supabaseBrowser
      .from("site_alerts")
      .select("id, title, description, is_active")
      .order("created_at", { ascending: false });
    if (data) setItems(data);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabaseBrowser.from("site_alerts").insert({
      title: title.trim(),
      description: description.trim(),
      is_active: true,
    });
    if (error) {
      console.error(error);
      alert("Error creando el aviso");
    } else {
      setTitle("");
      setDescription("");
      await refresh();
    }
    setSaving(false);
  };

  const toggle = async (a: Alert) => {
    await supabaseBrowser
      .from("site_alerts")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    await refresh();
  };

  const remove = async (id: string) => {
    await supabaseBrowser.from("site_alerts").delete().eq("id", id);
    await refresh();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del aviso (ej: Corte de luz programado)"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
        />
        <div className="flex gap-3">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle (opcional)"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            Publicar
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3"
          >
            <div>
              <p
                className={`text-sm font-semibold ${a.is_active ? "" : "text-gray-400 line-through"}`}
              >
                {a.title}
              </p>
              {a.description && (
                <p className="text-xs text-gray-500">{a.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggle(a)}
                className="rounded-full bg-gray-200 px-4 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
              >
                {a.is_active ? "Desactivar" : "Activar"}
              </button>
              <button
                onClick={() => remove(a.id)}
                className="rounded-full bg-red-100 px-4 py-1 text-xs font-semibold text-red-600 hover:bg-red-200"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-gray-400">No hay avisos cargados.</p>
        )}
      </ul>
    </div>
  );
}
