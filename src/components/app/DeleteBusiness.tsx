import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Props = {
  businessId: string;
  businessName: string;
  photoUrls: string[];
};

/** Borrado con confirmación de dos pasos. Limpia fotos del storage y la fila
 *  (las tablas hijas caen por CASCADE). RLS: solo el dueño o el admin pueden. */
export default function DeleteBusiness({
  businessId,
  businessName,
  photoUrls,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      // 1. Fotos del storage (best-effort)
      const marker = "/business-photos/";
      const paths = photoUrls
        .map((url) => {
          const idx = url.indexOf(marker);
          return idx === -1
            ? null
            : decodeURIComponent(url.slice(idx + marker.length));
        })
        .filter((p): p is string => Boolean(p));

      if (paths.length > 0) {
        await supabaseBrowser.storage.from("business-photos").remove(paths);
      }

      // 2. El negocio (horarios, fotos, categorías y reclamos caen en cascada)
      const { error: delError, count } = await supabaseBrowser
        .from("businesses")
        .delete({ count: "exact" })
        .eq("id", businessId);

      if (delError) throw delError;
      if (!count) throw new Error("Sin permiso para borrar este negocio");

      window.location.href = "/app?borrado=1";
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "No pudimos borrar el negocio");
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 space-y-3">
      <h2 className="text-lg font-semibold text-red-700">Zona peligrosa</h2>
      <p className="text-sm text-gray-600">
        Borrar el negocio elimina su ficha, fotos, horarios y reclamos. No se
        puede deshacer.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-xl border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
        >
          Borrar negocio
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-red-700">
            ¿Borrar «{businessName}» definitivamente?
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Borrando…" : "Sí, borrar"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-xl border border-gray-300 px-5 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-100 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
