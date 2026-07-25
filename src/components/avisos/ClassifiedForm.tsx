import { useState } from "react";
import imageCompression from "browser-image-compression";
import { ImagePlus, X } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import {
  CLASSIFIED_CATEGORIES,
  formatPriceText,
} from "../../lib/repositories/classified.repository";

type Existing = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_text: string | null;
  whatsapp: string | null;
  author_name: string;
  photo_url: string | null;
};

type Props = {
  /** Nombre de la cuenta de Google, editable por el vecino. */
  defaultName?: string;
  /** Id del usuario: la foto se sube a una carpeta con su nombre. */
  userId: string;
  /** Si viene, el formulario edita ese aviso en vez de crear uno nuevo. */
  existing?: Existing;
};

const MAX_SIZE_MB = 10;

// Misma receta que las fotos de negocios: se comprime en el navegador antes
// de subir (las fotos de celular pesan varios MB) y se guarda en WebP, para
// servirlas crudas sin gastar cuota de optimización de imágenes.
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  fileType: "image/webp",
};

/**
 * Formulario de aviso, para crear o editar. Hace falta estar logueado (la
 * página ya lo verifica). Crear va por /api/avisos; editar escribe directo
 * con el cliente de sesión, porque la RLS ya limita al dueño. En los dos
 * casos el aviso queda pendiente de moderación. "company" es el honeypot.
 */
export default function ClassifiedForm({
  defaultName = "",
  userId,
  existing,
}: Props) {
  const isEdit = Boolean(existing);
  const [category, setCategory] = useState(existing?.category ?? "venta");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [priceText, setPriceText] = useState(existing?.price_text ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [authorName, setAuthorName] = useState(
    existing?.author_name ?? defaultName,
  );
  const [whatsapp, setWhatsapp] = useState(existing?.whatsapp ?? "");
  const [company, setCompany] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    existing?.photo_url ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`La foto no puede pesar más de ${MAX_SIZE_MB} MB`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Si la compresión falla, se sube el original (ya validado a 10 MB)
      let toUpload: File | Blob = file;
      try {
        toUpload = await imageCompression(file, COMPRESSION_OPTIONS);
      } catch (compressErr) {
        console.error("Compresión falló, subo original:", compressErr);
      }

      // La carpeta raíz tiene que ser el id del usuario: así lo exige la
      // política de Storage (nadie pisa las fotos de otro).
      const ext = toUpload.type.split("/").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: upError } = await supabaseBrowser.storage
        .from("classified-photos")
        .upload(path, toUpload, { contentType: toUpload.type });
      if (upError) throw upError;

      const {
        data: { publicUrl },
      } = supabaseBrowser.storage.from("classified-photos").getPublicUrl(path);

      setPhotoUrl(publicUrl);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "No pudimos subir la foto, probá de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!photoUrl) return;
    const path = photoUrl.split("/classified-photos/")[1];
    setPhotoUrl(null);
    if (path) {
      await supabaseBrowser.storage.from("classified-photos").remove([path]);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      if (existing) {
        // Editar: la RLS ya limita al dueño y obliga a que vuelva a quedar
        // pendiente, así que se escribe directo, sin endpoint.
        const { data, error: updateError } = await supabaseBrowser
          .from("classifieds")
          .update({
            category,
            title: title.trim(),
            description: description.trim() || null,
            price_text: formatPriceText(priceText),
            whatsapp: whatsapp.replace(/[^\d]/g, ""),
            author_name: authorName.trim(),
            photo_url: photoUrl,
            status: "pending",
            published_at: null,
          })
          .eq("id", existing.id)
          .select("id");

        if (updateError) throw new Error(updateError.message);
        if (!data || data.length === 0) {
          throw new Error("No pudimos guardar los cambios.");
        }
      } else {
        const res = await fetch("/api/avisos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            title,
            priceText,
            description,
            authorName,
            whatsapp,
            photoUrl,
            company,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || body?.error);
        }
      }

      setDone(true);
    } catch (err) {
      setError(
        (err as Error)?.message ||
          "No pudimos guardar tu aviso, probá de nuevo.",
      );
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-[20px] bg-bg-card p-8 text-center shadow-soft">
        <h2 className="mb-2 text-[19px] font-extrabold text-text-main">
          {isEdit
            ? "Guardamos los cambios"
            : "¡Listo! Tu aviso está en revisión"}
        </h2>
        <p className="mx-auto mb-5 max-w-md text-[14px] text-text-body">
          {isEdit
            ? "Como cambió, vuelve a pasar por la revisión rápida antes de verse en el barrio."
            : "Lo miramos para que no se cuele spam y queda publicado en el barrio durante 30 días."}
        </p>
        <a
          href="/avisos/mios"
          className="inline-block rounded-[14px] bg-primary px-6 py-3.5 text-[15px] font-semibold text-white"
        >
          Ver mis avisos
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 rounded-[20px] bg-bg-card p-6 shadow-soft sm:p-7"
    >
      <div>
        <label className="mb-2 block text-[13.5px] font-semibold text-text-main">
          ¿De qué se trata?
        </label>
        <div className="flex flex-wrap gap-2">
          {CLASSIFIED_CATEGORIES.map((option) => {
            const active = category === option.slug;
            return (
              <button
                key={option.slug}
                type="button"
                onClick={() => setCategory(option.slug)}
                aria-pressed={active}
                className={`rounded-full px-4 py-[9px] text-[13.5px] transition-colors ${
                  active
                    ? "bg-secondary font-semibold text-white"
                    : "border border-border font-medium text-text-body"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="titulo"
          className="mb-1.5 block text-[13.5px] font-semibold text-text-main"
        >
          Título
        </label>
        <input
          id="titulo"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bicicleta rodado 26 en buen estado"
          className="field"
        />
      </div>

      <div>
        <label
          htmlFor="precio"
          className="mb-1.5 block text-[13.5px] font-semibold text-text-main"
        >
          Precio <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <input
          id="precio"
          maxLength={40}
          value={priceText}
          onChange={(e) => setPriceText(e.target.value)}
          // Si escribió solo números, se muestra ya formateado como plata:
          // "85000" pasa a "$85.000". El texto libre queda igual.
          onBlur={() => setPriceText(formatPriceText(priceText) ?? "")}
          placeholder="$85.000 · A convenir · Gratis"
          className="field"
        />
      </div>

      <div>
        <label
          htmlFor="descripcion"
          className="mb-1.5 block text-[13.5px] font-semibold text-text-main"
        >
          Descripción{" "}
          <span className="font-normal text-text-muted">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          rows={4}
          maxLength={1500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Contá el estado, la zona, cómo coordinar la entrega…"
          className="field"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[13.5px] font-semibold text-text-main">
          Foto <span className="font-normal text-text-muted">(opcional)</span>
        </label>

        {photoUrl ? (
          <div className="relative w-fit">
            <img
              src={photoUrl}
              alt="Foto del aviso"
              className="h-[150px] w-[220px] rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={removePhoto}
              aria-label="Quitar la foto"
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-text-main shadow-soft"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <label
            className={`flex h-[110px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[rgba(14,26,18,.25)] text-[13.5px] text-text-muted transition-colors hover:border-primary ${
              uploading ? "opacity-60" : ""
            }`}
          >
            <ImagePlus size={22} className="text-primary" />
            {uploading ? "Subiendo…" : "Agregá una foto"}
            <span className="text-[12px]">
              Se ve mucho más si tu aviso tiene foto
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={uploadPhoto}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="nombre"
            className="mb-1.5 block text-[13.5px] font-semibold text-text-main"
          >
            Tu nombre
          </label>
          <input
            id="nombre"
            required
            maxLength={80}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Cómo te van a llamar los vecinos"
            className="field"
          />
        </div>

        <div>
          <label
            htmlFor="whatsapp"
            className="mb-1.5 block text-[13.5px] font-semibold text-text-main"
          >
            WhatsApp
          </label>
          <input
            id="whatsapp"
            required
            inputMode="tel"
            maxLength={20}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="11 5555 5555"
            className="field"
          />
        </div>
      </div>

      {/* Honeypot: oculto para las personas, irresistible para los bots */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {error && <p className="text-[13px] text-error">{error}</p>}

      <p className="text-[12.5px] text-text-muted">
        Tu WhatsApp queda visible para que te contacten. Revisamos los avisos
        antes de publicarlos y vencen a los 30 días: podés renovarlos con un
        click, y si no se renuevan se borran una semana después.
      </p>

      <button
        type="submit"
        disabled={sending}
        className="rounded-[14px] bg-primary p-4 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {sending
          ? "Guardando…"
          : isEdit
            ? "Guardar cambios"
            : "Publicar aviso"}
      </button>
    </form>
  );
}
