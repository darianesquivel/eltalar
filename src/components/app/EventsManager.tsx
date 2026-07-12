import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Eye, EyeOff, Trash2, X } from "lucide-react";
import { todayInArgentina } from "../../lib/hours";
import IconButton from "./IconButton";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  image_url: string | null;
  is_active: boolean;
};

const EMPTY_FORM = {
  title: "",
  date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  location: "",
  description: "",
};

const fmtFecha = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

// Alta y gestión de eventos. La página pública (/eventos) solo muestra los
// activos cuya fecha no pasó; acá el admin ve todo, incluso los pasados.
export default function EventsManager() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/eventos")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .finally(() => setLoading(false));
  }, []);

  const set =
    (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [field]: e.target.value });

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, v));
      if (photo) fd.set("photo", photo);

      const res = await fetch("/api/admin/eventos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error creando el evento");

      setEvents((prev) => [data.event, ...prev]);
      setForm(EMPTY_FORM);
      setPhoto(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (ev: EventItem) => {
    setBusy(ev.id);
    const res = await fetch("/api/admin/eventos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ev.id, is_active: !ev.is_active }),
    });
    if (res.ok) {
      setEvents((prev) =>
        prev.map((e) => (e.id === ev.id ? { ...e, is_active: !ev.is_active } : e)),
      );
    } else {
      alert("Error actualizando el evento");
    }
    setBusy(null);
  };

  const remove = async (id: string) => {
    setBusy(id);
    const res = await fetch("/api/admin/eventos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } else {
      alert("Error borrando el evento");
    }
    setBusy(null);
    setConfirmDelete(null);
  };

  const today = todayInArgentina();
  const vigente = (e: EventItem) => (e.end_date ?? e.date) >= today;
  const vigentes = events.filter(vigente);
  const pasados = events.filter((e) => !vigente(e));

  const row = (e: EventItem) => (
    <li
      key={e.id}
      className={`flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-sm ${busy === e.id ? "opacity-50" : ""} ${!e.is_active ? "opacity-60" : ""}`}
    >
      {e.image_url ? (
        <img
          src={e.image_url}
          alt=""
          className="h-11 w-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-lg bg-primary-soft/40">
          <CalendarDays size={18} className="text-primary/60" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={e.title}>
          {e.title}
          {!e.is_active && (
            <span className="ml-1.5 text-[10px] font-normal text-gray-400">
              (oculto)
            </span>
          )}
        </p>
        <p className="truncate text-xs text-gray-500">
          {fmtFecha(e.date)}
          {e.end_date && e.end_date !== e.date && ` → ${fmtFecha(e.end_date)}`}
          {e.start_time && ` · ${e.start_time.slice(0, 5)} hs`}
          {e.location && ` · ${e.location}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {confirmDelete === e.id ? (
          <>
            <span className="text-xs font-semibold text-red-600">¿Borrar?</span>
            <IconButton
              small
              label="Sí, borrar"
              variant="danger"
              disabled={busy === e.id}
              onClick={() => remove(e.id)}
            >
              <Check size={13} />
            </IconButton>
            <IconButton small label="Cancelar" onClick={() => setConfirmDelete(null)}>
              <X size={13} />
            </IconButton>
          </>
        ) : (
          <>
            <IconButton
              small
              label={e.is_active ? "Ocultar del sitio" : "Publicar"}
              variant={e.is_active ? "default" : "success"}
              disabled={busy === e.id}
              onClick={() => toggleActive(e)}
            >
              {e.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
            </IconButton>
            <IconButton
              small
              label="Borrar"
              variant="danger"
              disabled={busy === e.id}
              onClick={() => setConfirmDelete(e.id)}
            >
              <Trash2 size={13} />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      {/* ALTA */}
      <form
        onSubmit={submit}
        className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold">Nuevo evento</h2>

        <input
          required
          value={form.title}
          onChange={set("title")}
          placeholder="Título (ej: Feria de artesanos)"
          className="field"
          maxLength={120}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-xs text-gray-500">
            Fecha *
            <input
              required
              type="date"
              value={form.date}
              onChange={set("date")}
              className="field"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            Hasta (opcional)
            <input
              type="date"
              value={form.end_date}
              onChange={set("end_date")}
              min={form.date}
              className="field"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            Desde las
            <input
              type="time"
              value={form.start_time}
              onChange={set("start_time")}
              className="field"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            Hasta las
            <input
              type="time"
              value={form.end_time}
              onChange={set("end_time")}
              className="field"
            />
          </label>
        </div>

        <input
          value={form.location}
          onChange={set("location")}
          placeholder="Lugar (ej: Plaza principal, Brasil y Perú)"
          className="field"
          maxLength={160}
        />

        <textarea
          value={form.description}
          onChange={set("description")}
          placeholder="Descripción (opcional)"
          rows={2}
          maxLength={600}
          className="field"
        />

        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPhoto}
            className="text-xs text-gray-500 file:mr-3 file:rounded-full file:border-0 file:bg-primary-soft/50 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
          />
          {preview && (
            <img
              src={preview}
              alt="vista previa"
              className="h-12 w-20 rounded-lg object-cover"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Publicar evento"}
        </button>
      </form>

      {/* VIGENTES */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">
          Próximos y en curso{" "}
          <span className="ml-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs text-gray-600">
            {vigentes.length}
          </span>
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : vigentes.length > 0 ? (
          <ul className="space-y-2">{vigentes.map(row)}</ul>
        ) : (
          <p className="rounded-xl bg-gray-50 px-5 py-3 text-sm text-gray-500">
            No hay eventos próximos cargados.
          </p>
        )}
      </div>

      {/* PASADOS */}
      {pasados.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500">
            Ya pasaron{" "}
            <span className="ml-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs text-gray-600">
              {pasados.length}
            </span>
          </h2>
          <ul className="space-y-2">{pasados.map(row)}</ul>
        </div>
      )}
    </div>
  );
}
