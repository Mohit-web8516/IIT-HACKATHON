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
  res.status(200).json({
    status: "OK",
    message: "QuestForge API is running",
  });
});

// ============================================================
// GET ALL TASKS
// ============================================================

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET TASKS ERROR:", error);

      return res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error("GET TASKS ERROR:", error);

    return res.status(500).json({
      status: "ERROR",
      error: error.message || "Failed to fetch activities",
    });
  }
});

// ============================================================
// CREATE TASK
// ============================================================

app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      title,
      description,
      difficulty,
      xp_reward,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        status: "ERROR",
        error: "Quest title is required",
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description?.trim() || "",
        difficulty: difficulty || "Easy",
        xp_reward: Number(xp_reward) || 10,
        completed: false,
      })
      .select()
      .single();

    if (error) {
      console.error("CREATE TASK ERROR:", error);

      return res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error("CREATE TASK ERROR:", error);

    return res.status(500).json({
      status: "ERROR",
      error: error.message || "Failed to create quest",
    });
  }
});

// ============================================================
// DELETE TASK
// ============================================================

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) {
      console.error("DELETE TASK ERROR:", error);

      return res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }

    return res.status(200).json({
      status: "SUCCESS",
      message: "Quest deleted successfully",
    });
  } catch (error) {
    console.error("DELETE TASK ERROR:", error);

    return res.status(500).json({
      status: "ERROR",
      error: error.message || "Failed to delete activity",
    });
  }
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

      // FIND TASK
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

      // CHECK IF ALREADY COMPLETED
      if (task.completed) {
        return res.status(400).json({
          status: "ERROR",
          error: "Quest is already completed",
        });
      }

      // COMPLETE TASK
      const {
        data: completedTask,
        error: completeError,
      } = await supabase
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
        console.error(
          "COMPLETE TASK ERROR:",
          completeError
        );

        return res.status(500).json({
          status: "ERROR",
          error: completeError.message,
        });
      }

      // GET CHARACTER
      const {
        data: character,
        error: characterError,
      } = await supabase
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

      // ADD XP
      const earnedXP = Number(task.xp_reward) || 10;

      let newXP =
        Number(character.xp || 0) + earnedXP;

      let newLevel =
        Number(character.level || 1);

      const oldLevel = newLevel;

      while (newXP >= 100) {
        newXP -= 100;
        newLevel += 1;
      }

      // GOLD
      let earnedGold = 5;

      if (task.difficulty === "Medium") {
        earnedGold = 10;
      }

      if (task.difficulty === "Hard") {
        earnedGold = 20;
      }

      const newGold =
        Number(character.gold || 0) + earnedGold;

      // SUPER CHARACTER
      let superCharacterUnlocked =
        character.super_character_unlocked || false;

      if (newLevel >= 5) {
        superCharacterUnlocked = true;
      }

      // UPDATE CHARACTER
      const {
        data: updatedCharacter,
        error: updateError,
      } = await supabase
        .from("characters")
        .update({
          xp: newXP,
          level: newLevel,
          gold: newGold,
          super_character_unlocked:
            superCharacterUnlocked,
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) {
        console.error(
          "UPDATE CHARACTER ERROR:",
          updateError
        );

        return res.status(500).json({
          status: "ERROR",
          error: updateError.message,
        });
      }

      return res.status(200).json({
        ...completedTask,
        character: updatedCharacter,
        earnedXP,
        earnedGold,
        levelUp: newLevel > oldLevel,
        superCharacterUnlocked,
      });
    } catch (error) {
      console.error(
        "COMPLETE QUEST ERROR:",
        error
      );

      return res.status(500).json({
        status: "ERROR",
        error:
          error.message ||
          "Failed to complete quest",
      });
    }
  }
);

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    status: "ERROR",
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`QuestForge API running on port ${PORT}`);
});