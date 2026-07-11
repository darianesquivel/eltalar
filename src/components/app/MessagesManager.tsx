import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Message = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

type Props = {
  messages: Message[];
};

export default function MessagesManager({ messages }: Props) {
  const [items, setItems] = useState(messages);

  const remove = async (id: string) => {
    await supabaseBrowser.from("contact_messages").delete().eq("id", id);
    setItems((prev) => prev.filter((m) => m.id !== id));
  };

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
        No hay mensajes. Cuando alguien escriba desde el formulario de contacto
        aparece acá.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((m) => (
        <li key={m.id} className="rounded-2xl bg-white p-5 shadow-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                {m.name}{" "}
                <a
                  href={`mailto:${m.email}`}
                  className="font-normal text-primary hover:underline"
                >
                  {m.email}
                </a>
              </p>
              <p className="text-xs text-gray-400">
                {new Date(m.created_at).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <button
              onClick={() => remove(m.id)}
              className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              Borrar
            </button>
          </div>
          <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            {m.message}
          </p>
        </li>
      ))}
    </ul>
  );
}
