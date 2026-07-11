import type { APIRoute } from "astro";
import { createSupabaseServer } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const supabase = createSupabaseServer(context);
  await supabase.auth.signOut();
  return context.redirect("/app/login");
};
