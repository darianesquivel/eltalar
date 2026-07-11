import { useState } from "react";
import { Trash2, Check, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import IconButton from "./IconButton";

type Turn = {
  id: string;
  pharmacy_id: string;
  starts_at: string;
  ends_at: string;
  businesses: { name: string } | null;
};

type Pharmacy = {
  id: string;
  name: string;
};

type Props = {
  turns: Turn[];
  pharmacies: Pharmacy[];
};

const inputClass = "field";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** datetime-local (hora argentina) → ISO UTC */
const localToIso = (local: string) =>
  new Date(`${local}:00-03:00`).toISOString();

export default function TurnsManager({ turns, pharmacies }: Props) {
  const [items, setItems] = useState(turns);
  const [pharmacyId, setPharmacyId] = useState(pharmacies[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = async () => {
    const { data } = await supabaseBrowser
      .from("pharmacy_turns")
      .select("id, pharmacy_id, starts_at, ends_at, businesses ( name )")
      .gte("ends_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("starts_at");
    if (data) setItems(data as Turn[]);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pharmacyId || !startsAt || !endsAt) {
      setError("Completá farmacia, inicio y fin");
      return;
    }
    if (endsAt <= startsAt) {
      setError("El fin tiene que ser después del inicio");
      return;
    }

    setSaving(true);
    const { error: insError } = await supabaseBrowser
      .from("pharmacy_turns")
      .insert({
        pharmacy_id: pharmacyId,
        starts_at: localToIso(startsAt),
        ends_at: localToIso(endsAt),
      });

    if (insError) {
      console.error(insError);
      setError("Error cargando el turno");
    } else {
      setStartsAt("");
      setEndsAt("");
      await refresh();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    await supabaseBrowser.from("pharmacy_turns").delete().eq("id", id);
    await refresh();
  };

  const now = new Date().toISOString();

  return (
    <div className="space-y-6">
      {/* Alta */}
      <form
        onSubmit={create}
        className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2"
      >
        <select
          value={pharmacyId}
          onChange={(e) => setPharmacyId(e.target.value)}
          className={`${inputClass} select-field sm:col-span-2`}
        >
          {pharmacies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="text-sm text-gray-600">
          Empieza (hora argentina)
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        <label className="text-sm text-gray-600">
          Termina
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 sm:col-span-2"
        >
          {saving ? "Guardando…" : "+ Cargar turno"}
        </button>
        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      </form>

      {/* Lista: turnos recientes y futuros (scroll propio) */}
      <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {items.map((t) => {
          const active = t.starts_at <= now && t.ends_at > now;
          const past = t.ends_at <= now;
          return (
            <li
              key={t.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ${past ? "opacity-50" : ""}`}
            >
              <div>
                <p className="text-sm font-semibold">
                  {active && (
                    <span className="mr-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700">
                      DE TURNO AHORA
                    </span>
                  )}
                  {t.businesses?.name ?? "(farmacia borrada)"}
                </p>
                <p className="text-xs text-gray-500">
                  {fmt(t.starts_at)} → {fmt(t.ends_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {confirmDelete === t.id ? (
                  <>
                    <span className="text-xs font-semibold text-red-600">
                      ¿Borrar?
                    </span>
                    <IconButton
                      label="Sí, borrar turno"
                      variant="danger"
                      onClick={() => {
                        remove(t.id);
                        setConfirmDelete(null);
                      }}
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
                  <IconButton
                    label="Borrar turno"
                    variant="danger"
                    onClick={() => setConfirmDelete(t.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <p className="text-sm text-gray-400">
            No hay turnos cargados (se muestran los de la última semana en
            adelante).
          </p>
        )}
      </ul>
    </div>
  );
}
