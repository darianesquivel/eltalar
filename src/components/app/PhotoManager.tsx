import { useState } from "react";
import imageCompression from "browser-image-compression";
import { supabaseBrowser } from "../../lib/supabase/browser";
import type { BusinessPhoto } from "../../lib/repositories/business.repository";

type Props = {
  businessId: string;
  initialPhotos: BusinessPhoto[];
  /** El plan Destacado permite hasta 4 fotos; el gratuito, 1. */
  isFeatured?: boolean;
};

const MAX_SIZE_MB = 10;

// Opciones de compresión en el navegador antes de subir: las fotos de celular
// pesan varios MB, las bajamos a ~0.4MB, máx 1280px y las convertimos a WebP
// sin que el dueño note nada. Al quedar chicas y en WebP, las servimos crudas
// (sin el optimizador de Vercel) y no gastamos cuota de Image Transformations.
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: "image/webp",
};

export default function PhotoManager({
  businessId,
  initialPhotos,
  isFeatured = false,
}: Props) {
  const [photos, setPhotos] = useState<BusinessPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Evita dobles clics mientras corre una acción (portada / borrar)
  const [busy, setBusy] = useState(false);
  // Confirmación en dos pasos para borrar una foto
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const maxPhotos = isFeatured ? 4 : 1;
  const atLimit = photos.length >= maxPhotos;

  const refresh = async () => {
    const { data } = await supabaseBrowser
      .from("business_photos")
      .select("id, url, is_cover, position")
      .eq("business_id", businessId)
      .order("position");
    if (data) setPhotos(data);
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`La foto no puede pesar más de ${MAX_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Comprimimos en el navegador antes de subir. Si algo falla, subimos el
      // original (ya validado a máx 10MB).
      let toUpload = file;
      try {
        toUpload = await imageCompression(file, COMPRESSION_OPTIONS);
      } catch (compressErr) {
        console.error("Compresión falló, subo original:", compressErr);
      }

      // Path con carpeta del negocio: la política de Storage exige que la
      // carpeta raíz sea el ID de un negocio propio. La extensión sale del
      // archivo realmente subido (webp si la compresión funcionó; si falló,
      // la del original) para que coincida con su contentType.
      const ext =
        toUpload.type.split("/").pop() ||
        file.name.split(".").pop()?.toLowerCase() ||
        "jpg";
      const path = `${businessId}/${Date.now()}.${ext}`;

      const { error: upError } = await supabaseBrowser.storage
        .from("business-photos")
        .upload(path, toUpload, { contentType: toUpload.type });
      if (upError) throw upError;

      const {
        data: { publicUrl },
      } = supabaseBrowser.storage.from("business-photos").getPublicUrl(path);

      const { error: insError } = await supabaseBrowser
        .from("business_photos")
        .insert({
          business_id: businessId,
          url: publicUrl,
          is_cover: photos.length === 0, // la primera foto es portada
          position: photos.length,
        });
      if (insError) {
        // La fila no se creó: borramos el archivo recién subido para no
        // dejar huérfanos en el storage
        await supabaseBrowser.storage.from("business-photos").remove([path]);
        throw insError;
      }

      await refresh();
    } catch (err: any) {
      console.error(err);
      setError("No pudimos subir la foto. Probá con una imagen más liviana.");
    } finally {
      setUploading(false);
    }
  };

  const setCover = async (photoId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    // Guardamos la portada actual por si hay que restaurarla
    const prevCoverId = photos.find((p) => p.is_cover)?.id ?? null;

    try {
      const { error: clearError } = await supabaseBrowser
        .from("business_photos")
        .update({ is_cover: false })
        .eq("business_id", businessId);
      if (clearError) throw clearError;

      const { error: coverError } = await supabaseBrowser
        .from("business_photos")
        .update({ is_cover: true })
        .eq("id", photoId);
      if (coverError) {
        // No quedó ninguna portada: intentamos volver a la anterior
        if (prevCoverId) {
          await supabaseBrowser
            .from("business_photos")
            .update({ is_cover: true })
            .eq("id", prevCoverId);
        }
        throw coverError;
      }

      await refresh();
    } catch (err) {
      console.error(err);
      setError("No pudimos cambiar la portada. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: BusinessPhoto) => {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      // Primero la fila: si falla, el archivo sigue intacto en el storage
      const { error: delError } = await supabaseBrowser
        .from("business_photos")
        .delete()
        .eq("id", photo.id);
      if (delError) throw delError;

      // Después el archivo, solo si está en la carpeta del negocio (best-effort)
      const marker = "/business-photos/";
      const idx = photo.url.indexOf(marker);
      if (idx !== -1) {
        const path = decodeURIComponent(photo.url.slice(idx + marker.length));
        const { error: storageError } = await supabaseBrowser.storage
          .from("business-photos")
          .remove([path]);
        if (storageError) {
          console.error("Error borrando el archivo del storage", storageError);
        }
      }

      await refresh();
    } catch (err) {
      console.error(err);
      setError("No pudimos borrar la foto. Probá de nuevo.");
    } finally {
      setBusy(false);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative overflow-hidden rounded-xl border border-gray-100"
          >
            <img
              src={photo.url}
              alt=""
              loading="lazy"
              className="h-28 w-full object-cover"
            />
            {photo.is_cover && (
              <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                Portada
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1.5 opacity-0 transition group-hover:opacity-100">
              {!photo.is_cover && confirmDeleteId !== photo.id && (
                <button
                  onClick={() => setCover(photo.id)}
                  disabled={busy}
                  className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-semibold disabled:opacity-60"
                >
                  Hacer portada
                </button>
              )}
              {confirmDeleteId === photo.id ? (
                <span className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => remove(photo)}
                    disabled={busy}
                    className="rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-60"
                  >
                    ¿Borrar?
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={busy}
                    className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-semibold"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(photo.id)}
                  disabled={busy}
                  className="ml-auto rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-60"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>
        ))}

        {!atLimit && (
          <label
            className={`flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 transition hover:border-primary hover:text-primary ${uploading ? "pointer-events-none opacity-50" : ""}`}
          >
            <span className="text-2xl">+</span>
            {uploading ? "Subiendo…" : "Agregar foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={upload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      {/* Venta cruzada: el plan gratuito llegó a su única foto */}
      {atLimit && !isFeatured && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ⭐ Tu plan incluye 1 foto. Con el <strong>plan Destacado</strong>{" "}
          podés subir hasta 4 y mostrar tu local, tus productos y tu equipo —
          activalo más abajo.
        </p>
      )}

      <p className="text-xs text-gray-400">
        {photos.length}/{maxPhotos} foto{maxPhotos === 1 ? "" : "s"} · JPG, PNG
        o WebP de hasta {MAX_SIZE_MB}MB (las optimizamos automáticamente al
        subirlas). La portada es la que se ve en el listado.
      </p>
    </div>
  );
}
