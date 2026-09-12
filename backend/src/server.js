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

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Life RPG backend is running",
  });
});


// ============================================================
// DATABASE TEST
// ============================================================

app.get("/api/test-db", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("shop_items")
      .select("*");

    if (error) {
      return res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }

    res.json({
      status: "OK",
      message: "Supabase connected successfully",
      data,
    });
  } catch (error) {
    console.error("DATABASE ERROR:", error);

    res.status(500).json({
      status: "ERROR",
      error: error.message,
    });
  }
});


// ============================================================
// AUTH TEST
// ============================================================

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    status: "OK",
    user: {
      id: req.user.id,
      email: req.user.email,
    },
  });
});


// ============================================================
// GET USER QUESTS / ACTIVITIES
// ============================================================

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("GET TASKS ERROR:", error);

      return res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }

    res.json(data || []);
  } catch (error) {
    console.error("GET TASKS ERROR:", error);

    res.status(500).json({
      status: "ERROR",
      error: "Failed to fetch quests",
    });
  }
});


// ============================================================
// CREATE QUEST / ACTIVITY
// ============================================================

app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      title,
      description,
      xp_reward,
      difficulty,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        status: "ERROR",
        error: "Quest title is required",
      });
    }

    const allowedDifficulties = [
      "Easy",
      "Medium",
      "Hard",
    ];

    const selectedDifficulty =
      allowedDifficulties.includes(difficulty)
        ? difficulty
        : "Easy";

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: title.trim(),
        description: description || "",
        xp_reward: Number(xp_reward) || 10,
        difficulty: selectedDifficulty,
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

    res.status(201).json(data);
  } catch (error) {
    console.error("CREATE TASK ERROR:", error);

    res.status(500).json({
      status: "ERROR",
      error: "Failed to create quest",
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

      const { data: task, error: taskError } =
        await supabase
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

      if (task.completed) {
        return res.status(400).json({
          status: "ERROR",
          error: "Quest is already completed",
        });
      }

      const { data, error } = await supabase
        .from("tasks")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("COMPLETE TASK ERROR:", error);

        return res.status(500).json({
          status: "ERROR",
          error: error.message,
        });
      }

      res.json(data);
    } catch (error) {
      console.error("COMPLETE TASK ERROR:", error);

      res.status(500).json({
        status: "ERROR",
        error: "Failed to complete quest",
      });
    }
  }
);


// ============================================================
// DELETE QUEST / ACTIVITY
// ============================================================

app.delete(
  "/api/tasks/:id",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const taskId = req.params.id;

      const { data, error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("DELETE TASK ERROR:", error);

        return res.status(500).json({
          status: "ERROR",
          error: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          status: "ERROR",
          error: "Quest not found",
        });
      }

      res.json({
        status: "OK",
        message: "Quest deleted successfully",
        data,
      });
    } catch (error) {
      console.error("DELETE TASK ERROR:", error);

      res.status(500).json({
        status: "ERROR",
        error: "Failed to delete quest",
      });
    }
  }
);


// ============================================================
// GET USER TIMERS
// ============================================================

app.get("/api/timers", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("timer_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("GET TIMERS ERROR:", error);

      return res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }

    res.json(data || []);
  } catch (error) {
    console.error("GET TIMERS ERROR:", error);

    res.status(500).json({
      status: "ERROR",
      error: "Failed to fetch timers",
    });
  }
});


// ============================================================
// CREATE TIMER
// ============================================================

app.post("/api/timers", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      timer_type,
      duration_seconds,
    } = req.body;

    if (
      timer_type !== "stopwatch" &&
      timer_type !== "countdown"
    ) {
      return res.status(400).json({
        status: "ERROR",
        error: "Invalid timer type",
      });
    }

    const duration = Math.max(
      0,
      Number(duration_seconds) || 0
    );

    const { data, error } = await supabase
      .from("timer_sessions")
      .insert({
        user_id: userId,
        timer_type,
        duration_seconds: duration,
        remaining_seconds: duration,
        status: "idle",
      })
      .select()
      .single();

    if (error) {
      console.error("CREATE TIMER ERROR:", error);

      return res.status(500).json({
        status: "ERROR",
        error: error.message,
      });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error("CREATE TIMER ERROR:", error);

    res.status(500).json({
      status: "ERROR",
      error: "Failed to create timer",
    });
  }
});


// ============================================================
// UPDATE TIMER
// ============================================================

app.patch(
  "/api/timers/:id",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const timerId = req.params.id;

      const {
        status,
        remaining_seconds,
        duration_seconds,
        started_at,
      } = req.body;

      const updates = {};

      if (status !== undefined) {
        updates.status = status;
      }

      if (remaining_seconds !== undefined) {
        updates.remaining_seconds = Math.max(
          0,
          Number(remaining_seconds)
        );
      }

      if (duration_seconds !== undefined) {
        updates.duration_seconds = Math.max(
          0,
          Number(duration_seconds)
        );
      }

      if (started_at !== undefined) {
        updates.started_at = started_at;
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("timer_sessions")
        .update(updates)
        .eq("id", timerId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("UPDATE TIMER ERROR:", error);

        return res.status(500).json({
          status: "ERROR",
          error: error.message,
        });
      }

      res.json(data);
    } catch (error) {
      console.error("UPDATE TIMER ERROR:", error);

      res.status(500).json({
        status: "ERROR",
        error: "Failed to update timer",
      });
    }
  }
);


// ============================================================
// DELETE TIMER
// ============================================================

app.delete(
  "/api/timers/:id",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const timerId = req.params.id;

      const { error } = await supabase
        .from("timer_sessions")
        .delete()
        .eq("id", timerId)
        .eq("user_id", userId);

      if (error) {
        console.error("DELETE TIMER ERROR:", error);

        return res.status(500).json({
          status: "ERROR",
          error: error.message,
        });
      }

      res.json({
        status: "OK",
        message: "Timer deleted successfully",
      });
    } catch (error) {
      console.error("DELETE TIMER ERROR:", error);

      res.status(500).json({
        status: "ERROR",
        error: "Failed to delete timer",
      });
    }
  }
);


// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});