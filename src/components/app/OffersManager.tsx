import { useState } from "react";
import { Flame, Trash2, Check, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { todayInArgentina } from "../../lib/hours";
import IconButton from "./IconButton";
import type { BusinessOffer } from "../../lib/repositories/business.repository";

type Props = {
  businessId: string;
  /** Incluye también las vencidas (el dueño las ve todas). */
  initialOffers: BusinessOffer[];
  isFeatured?: boolean;
};

/** Fecha por defecto: dentro de 7 días. */
const defaultExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });

export default function OffersManager({
  businessId,
  initialOffers,
  isFeatured = false,
}: Props) {
  const [offers, setOffers] = useState<BusinessOffer[]>(initialOffers);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const today = todayInArgentina();
  const maxActive = isFeatured ? 5 : 1;
  const activeCount = offers.filter((o) => o.expires_at >= today).length;
  const atLimit = activeCount >= maxActive;

  const refresh = async () => {
    const { data } = await supabaseBrowser
      .from("business_offers")
      .select("id, title, description, expires_at")
      .eq("business_id", businessId)
      .order("expires_at", { ascending: false });
    if (data) setOffers(data);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Escribí el título de la oferta");
      return;
    }
    if (expiresAt < today) {
      setError("La fecha de vencimiento no puede ser en el pasado");
      return;
    }

    setSaving(true);
    const { error: insError } = await supabaseBrowser
      .from("business_offers")
      .insert({
        business_id: businessId,
        title: title.trim(),
        description: description.trim() || null,
        expires_at: expiresAt,
      });

    if (insError) {
      console.error(insError);
      setError(
        insError.message.includes("Límite")
          ? `Tu plan permite ${maxActive} oferta${maxActive === 1 ? "" : "s"} activa${maxActive === 1 ? "" : "s"} a la vez`
          : "Error creando la oferta",
      );
    } else {
      setTitle("");
      setDescription("");
      setExpiresAt(defaultExpiry());
      await refresh();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    await supabaseBrowser.from("business_offers").delete().eq("id", id);
    setConfirmDelete(null);
    await refresh();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Publicá promos con fecha de vencimiento: aparecen en tu ficha y en la
        sección <strong>Ofertas del barrio</strong>, y se dan de baja solas
        cuando vencen.
      </p>

      {/* Alta */}
      {!atLimit ? (
        <form
          onSubmit={create}
          className="grid gap-3 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (ej: 2x1 en pizzas los lunes) *"
            className="field sm:col-span-2"
            maxLength={80}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle (opcional)"
            className="field"
            maxLength={200}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Válida hasta
            <input
              type="date"
              value={expiresAt}
              min={today}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="field w-auto flex-1"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 sm:col-span-2"
          >
            {saving ? "Publicando…" : "🔥 Publicar oferta"}
          </button>
        </form>
      ) : (
        !isFeatured && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ⭐ Tu plan incluye 1 oferta activa a la vez. Con el{" "}
            <strong>plan Destacado</strong> podés tener hasta 5 promos
            publicadas al mismo tiempo.
          </p>
        )
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      {/* Lista */}
      <ul className="space-y-2">
        {offers.map((offer) => {
          const expired = offer.expires_at < today;
          return (
            <li
              key={offer.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                expired ? "bg-gray-50 opacity-60" : "bg-orange-50"
              }`}
            >
              <Flame
                size={18}
                className={
                  expired
                    ? "shrink-0 text-gray-400"
                    : "shrink-0 text-orange-500"
                }
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-semibold ${expired ? "line-through" : ""}`}
                >
                  {offer.title}
                </p>
                <p className="text-xs text-gray-500">
                  {expired
                    ? `Venció el ${fmtDate(offer.expires_at)}`
                    : `Válida hasta el ${fmtDate(offer.expires_at)}`}
                  {offer.description ? ` · ${offer.description}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {confirmDelete === offer.id ? (
                  <>
                    <span className="text-xs font-semibold text-red-600">
                      ¿Borrar?
                    </span>
                    <IconButton
                      label="Sí, borrar oferta"
                      variant="danger"
                      onClick={() => remove(offer.id)}
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
                    label="Borrar oferta"
                    variant="danger"
                    onClick={() => setConfirmDelete(offer.id)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
        {offers.length === 0 && (
          <p className="text-sm text-gray-400">
            Todavía no publicaste ninguna oferta.
          </p>
        )}
      </ul>

      <p className="text-xs text-gray-400">
        {activeCount}/{maxActive} activa{maxActive === 1 ? "" : "s"}
      </p>
    </div>
  );
}
