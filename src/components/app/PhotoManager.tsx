import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import type { BusinessPhoto } from "../../lib/repositories/business.repository";

type Props = {
  businessId: string;
  initialPhotos: BusinessPhoto[];
  /** El plan Destacado permite hasta 4 fotos; el gratuito, 1. */
  isFeatured?: boolean;
};

const MAX_SIZE_MB = 2;

export default function PhotoManager({
  businessId,
  initialPhotos,
  isFeatured = false,
}: Props) {
  const [photos, setPhotos] = useState<BusinessPhoto[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Path con carpeta del negocio: la política de Storage exige que la
      // carpeta raíz sea el ID de un negocio propio.
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${businessId}/${Date.now()}.${ext}`;

      const { error: upError } = await supabaseBrowser.storage
        .from("business-photos")
        .upload(path, file, { contentType: file.type });
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
      if (insError) throw insError;

      await refresh();
    } catch (err: any) {
      console.error(err);
      setError("No pudimos subir la foto. Probá con una imagen más liviana.");
    } finally {
      setUploading(false);
    }
  };

  const setCover = async (photoId: string) => {
    await supabaseBrowser
      .from("business_photos")
      .update({ is_cover: false })
      .eq("business_id", businessId);
    await supabaseBrowser
      .from("business_photos")
      .update({ is_cover: true })
      .eq("id", photoId);
    await refresh();
  };

  const remove = async (photo: BusinessPhoto) => {
    // Borra el archivo del storage solo si está en la carpeta del negocio
    const marker = "/business-photos/";
    const idx = photo.url.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(photo.url.slice(idx + marker.length));
      await supabaseBrowser.storage.from("business-photos").remove([path]);
    }
    await supabaseBrowser.from("business_photos").delete().eq("id", photo.id);
    await refresh();
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
              {!photo.is_cover && (
                <button
                  onClick={() => setCover(photo.id)}
                  className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-semibold"
                >
                  Hacer portada
                </button>
              )}
              <button
                onClick={() => remove(photo)}
                className="ml-auto rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-semibold text-white"
              >
                Borrar
              </button>
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
        o WebP de hasta {MAX_SIZE_MB}MB. La portada es la que se ve en el
        listado.
      </p>
    </div>
  );
}
