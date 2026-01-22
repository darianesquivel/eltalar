import { supabase } from "./supabase";

export async function submitContactForm({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}) {
  const { error } = await supabase.from("contact_messages").insert({
    name,
    email,
    message,
  });

  if (error) {
    throw error;
  }
}
