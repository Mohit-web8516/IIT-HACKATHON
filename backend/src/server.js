require("dotenv").config();

const express = require("express");
const cors = require("cors");

const supabase = require("./config/supabase");
const requireAuth = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "QuestForge API is running",
  });
});


// ============================================================
// COMPLETE QUEST
// ============================================================

app.patch(
  "/api/tasks/:id/complete",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const taskId = req.params.id;

      // --------------------------------------------------------
      // FIND TASK
      // --------------------------------------------------------

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("user_id", userId)
        .single();

      if (taskError || !task) {
        return res.status(404).json({
          status: "ERROR",
          error: "Quest not found",
        });
      }

      // --------------------------------------------------------
      // CHECK IF ALREADY COMPLETED
      // --------------------------------------------------------

      if (task.completed) {
        return res.status(400).json({
          status: "ERROR",
          error: "Quest is already completed",
        });
      }

      // --------------------------------------------------------
      // COMPLETE TASK
      // --------------------------------------------------------

      const { data: completedTask, error: completeError } =
        await supabase
          .from("tasks")
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .eq("user_id", userId)
          .select()
          .single();

      if (completeError) {
        console.error("COMPLETE TASK ERROR:", completeError);

        return res.status(500).json({
          status: "ERROR",
          error: completeError.message,
        });
      }

      // ========================================================
      // GET CHARACTER
      // ========================================================

      const { data: character, error: characterError } =
        await supabase
          .from("characters")
          .select("*")
          .eq("user_id", userId)
          .single();

      if (characterError || !character) {
        return res.status(500).json({
          status: "ERROR",
          error: "Character not found",
        });
      }

      // ========================================================
      // ADD XP
      // ========================================================

      const earnedXP = Number(task.xp_reward) || 10;

      let newXP = Number(character.xp || 0) + earnedXP;
      let newLevel = Number(character.level || 1);

      // Every 100 XP = next level
      while (newXP >= 100) {
        newXP -= 100;
        newLevel += 1;
      }

      // ========================================================
      // SUPER CHARACTER UNLOCK
      // ========================================================

      let superCharacterUnlocked =
        character.super_character_unlocked || false;

      // Unlock Super Character at Level 5
      if (newLevel >= 5) {
        superCharacterUnlocked = true;
      }

      // ========================================================
      // UPDATE CHARACTER
      // ========================================================

      const { data: updatedCharacter, error: updateError } =
        await supabase
          .from("characters")
          .update({
            xp: newXP,
            level: newLevel,
            super_character_unlocked: superCharacterUnlocked,
          })
          .eq("user_id", userId)
          .select()
          .single();

      if (updateError) {
        console.error("UPDATE CHARACTER ERROR:", updateError);

        return res.status(500).json({
          status: "ERROR",
          error: updateError.message,
        });
      }

      // ========================================================
      // RESPONSE
      // ========================================================

      return res.json({
        status: "SUCCESS",
        task: completedTask,
        character: updatedCharacter,
        earnedXP,
        levelUp:
          newLevel > Number(character.level || 1),
        superCharacterUnlocked,
      });

    } catch (error) {
      console.error("COMPLETE QUEST ERROR:", error);

      return res.status(500).json({
        status: "ERROR",
        error: "Failed to complete quest",
      });
    }
  }
);


// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});