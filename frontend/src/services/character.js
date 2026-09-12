import { supabase } from "../lib/supabase";


// ========================================
// GET OR CREATE CHARACTER
// ========================================

export async function getOrCreateCharacter(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  // Try to find existing character
  const { data: existingCharacter, error: fetchError } =
    await supabase
      .from("characters")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

  if (fetchError) {
    console.error("Error fetching character:", fetchError);
    throw fetchError;
  }

  // Character already exists
  if (existingCharacter) {
    return existingCharacter;
  }

  // Create new character
  const newCharacter = {
    user_id: userId,

    level: 1,
    xp: 0,
    gold: 0,

    strength: 1,
    intellect: 1,
    discipline: 1,
    endurance: 1,

    current_streak: 0,
    longest_streak: 0,
  };

  const { data, error: createError } =
    await supabase
      .from("characters")
      .insert(newCharacter)
      .select()
      .single();

  if (createError) {
    console.error("Error creating character:", createError);
    throw createError;
  }

  return data;
}


// ========================================
// GET CHARACTER
// ========================================

export async function getCharacter(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error getting character:", error);
    throw error;
  }

  return data;
}


// ========================================
// UPDATE CHARACTER
// ========================================

export async function updateCharacter(userId, updates) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("characters")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating character:", error);
    throw error;
  }

  return data;
}