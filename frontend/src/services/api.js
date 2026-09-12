import { supabase } from "../lib/supabase";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://iit-hackathon-backend.onrender.com";

export async function apiRequest(
  endpoint,
  options = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (session?.access_token) {
    headers.Authorization =
      `Bearer ${session.access_token}`;
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error ||
      "API request failed"
    );
  }

  return data;
}