import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import "./Quests.css";

function Quests() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [xpReward, setXpReward] = useState(10);

  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rewardMessage, setRewardMessage] = useState("");

  // =========================================================
  // LOAD QUESTS DIRECTLY FROM SUPABASE
  // =========================================================

  async function loadQuests() {
    try {
      setLoading(true);
      setError("");

      if (!user?.id) {
        throw new Error("User is not authenticated.");
      }

      const { data, error: fetchError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("SUPABASE LOAD QUESTS ERROR:", fetchError);
        throw new Error(fetchError.message);
      }

      setQuests(data || []);
    } catch (err) {
      console.error("LOAD QUESTS ERROR:", err);
      setError(err.message || "Failed to fetch quests");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    loadQuests();
  }, [user, authLoading, navigate]);

  // =========================================================
  // CREATE QUEST
  // =========================================================

  async function handleCreateQuest(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Quest title is required.");
      return;
    }

    try {
      setCreating(true);

      if (!user?.id) {
        throw new Error("User is not authenticated.");
      }

      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim(),
          difficulty,
          xp_reward: Number(xpReward) || 10,
          completed: false,
        })
        .select("*")
        .single();

      if (insertError) {
        console.error("CREATE QUEST SUPABASE ERROR:", insertError);
        throw new Error(insertError.message);
      }

      setQuests((previous) => [data, ...previous]);

      setTitle("");
      setDescription("");
      setDifficulty("Easy");
      setXpReward(10);

      setSuccess("Quest created successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error("CREATE QUEST ERROR:", err);
      setError(err.message || "Failed to create quest");
    } finally {
      setCreating(false);
    }
  }

  // =========================================================
  // COMPLETE QUEST
  // =========================================================

  async function handleCompleteQuest(taskId) {
    try {
      setCompletingId(taskId);
      setError("");
      setSuccess("");
      setRewardMessage("");

      if (!user?.id) {
        throw new Error("User is not authenticated.");
      }

      // -------------------------------------------------------
      // GET QUEST
      // -------------------------------------------------------

      const { data: quest, error: questError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .single();

      if (questError || !quest) {
        throw new Error("Quest not found.");
      }

      if (quest.completed) {
        throw new Error("Quest is already completed.");
      }

      // -------------------------------------------------------
      // MARK QUEST COMPLETED
      // -------------------------------------------------------

      const { data: completedQuest, error: completeError } =
        await supabase
          .from("tasks")
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .eq("user_id", user.id)
          .select("*")
          .single();

      if (completeError) {
        console.error(
          "COMPLETE QUEST SUPABASE ERROR:",
          completeError
        );
        throw new Error(completeError.message);
      }

      // -------------------------------------------------------
      // GET CHARACTER
      // -------------------------------------------------------

      const { data: character, error: characterError } =
        await supabase
          .from("characters")
          .select("*")
          .eq("user_id", user.id)
          .single();

      if (characterError || !character) {
        throw new Error(
          "Character not found. Please refresh the dashboard."
        );
      }

      // -------------------------------------------------------
      // CALCULATE XP
      // -------------------------------------------------------

      const earnedXP = Number(quest.xp_reward) || 10;

      let newXP = Number(character.xp || 0) + earnedXP;
      let newLevel = Number(character.level || 1);

      const oldLevel = newLevel;

      while (newXP >= 100) {
        newXP -= 100;
        newLevel += 1;
      }

      // -------------------------------------------------------
      // GOLD
      // -------------------------------------------------------

      let earnedGold = 5;

      if (quest.difficulty === "Medium") {
        earnedGold = 10;
      }

      if (quest.difficulty === "Hard") {
        earnedGold = 20;
      }

      const newGold =
        Number(character.gold || 0) + earnedGold;

      // -------------------------------------------------------
      // SUPER CHARACTER
      // -------------------------------------------------------

      const superCharacterUnlocked =
        character.super_character_unlocked ||
        newLevel >= 5;

      // -------------------------------------------------------
      // UPDATE CHARACTER
      // -------------------------------------------------------

      const { data: updatedCharacter, error: updateError } =
        await supabase
          .from("characters")
          .update({
            xp: newXP,
            level: newLevel,
            gold: newGold,
            super_character_unlocked:
              superCharacterUnlocked,
          })
          .eq("user_id", user.id)
          .select("*")
          .single();

      if (updateError) {
        console.error(
          "UPDATE CHARACTER ERROR:",
          updateError
        );

        // Try to keep the quest completed even if character
        // update fails.
        throw new Error(updateError.message);
      }

      // -------------------------------------------------------
      // UPDATE UI
      // -------------------------------------------------------

      setQuests((previous) =>
        previous.map((item) =>
          item.id === taskId
            ? completedQuest
            : item
        )
      );

      setRewardMessage(
        `🎉 Quest Complete! +${earnedXP} XP  +${earnedGold} Gold`
      );

      if (newLevel > oldLevel) {
        setSuccess(
          `🎊 Level Up! You are now Level ${newLevel}!`
        );
      }

      // Store latest character locally so dashboard can
      // refresh correctly when user returns.
      if (updatedCharacter) {
        localStorage.setItem(
          "questforge_character",
          JSON.stringify(updatedCharacter)
        );
      }

      setTimeout(() => {
        setRewardMessage("");
        setSuccess("");
      }, 5000);
    } catch (err) {
      console.error("COMPLETE QUEST ERROR:", err);

      setError(
        err.message || "Failed to complete quest"
      );
    } finally {
      setCompletingId(null);
    }
  }

  // =========================================================
  // DIFFICULTY
  // =========================================================

  function handleDifficultyChange(value) {
    setDifficulty(value);

    if (value === "Easy") {
      setXpReward(10);
    }

    if (value === "Medium") {
      setXpReward(25);
    }

    if (value === "Hard") {
      setXpReward(50);
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (authLoading || loading) {
    return (
      <main className="quests-page">
        <div className="quest-loading">
          Loading your quests...
        </div>
      </main>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <main className="quests-page">
      {/* HEADER */}

      <header className="quests-header">
        <div>
          <p className="quests-eyebrow">
            LIFE RPG
          </p>

          <h1>Your Quests</h1>

          <p className="quests-subtitle">
            Complete real-life challenges and
            grow your character.
          </p>
        </div>

        <button
          className="back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>
      </header>

      {/* CREATE QUEST */}

      <section className="quest-create-card">
        <p className="section-label">
          NEW QUEST
        </p>

        <h2>Create a Quest</h2>

        <form
          className="quest-form"
          onSubmit={handleCreateQuest}
        >
          {/* TITLE */}

          <div className="form-group">
            <label htmlFor="quest-title">
              Quest Title
            </label>

            <input
              id="quest-title"
              type="text"
              placeholder="e.g. Complete DBMS revision"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              maxLength={100}
            />
          </div>

          {/* DESCRIPTION */}

          <div className="form-group">
            <label htmlFor="quest-description">
              Description
            </label>

            <textarea
              id="quest-description"
              placeholder="What do you need to accomplish?"
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              maxLength={500}
            />
          </div>

          {/* DIFFICULTY + XP */}

          <div className="form-row">
            <div className="form-group">
              <label>Difficulty</label>

              <div className="difficulty-options">
                {["Easy", "Medium", "Hard"].map(
                  (level) => (
                    <button
                      key={level}
                      type="button"
                      className={`difficulty-button ${
                        difficulty === level
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        handleDifficultyChange(level)
                      }
                    >
                      {level}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="xp-reward">
                XP Reward
              </label>

              <input
                id="xp-reward"
                type="number"
                min="1"
                max="1000"
                value={xpReward}
                onChange={(event) =>
                  setXpReward(event.target.value)
                }
              />
            </div>
          </div>

          {/* REWARD */}

          <div className="quest-reward">
            <span className="reward-label">
              Completion Reward
            </span>

            <span className="reward-value">
              ⭐ {xpReward} XP
            </span>

            <span className="reward-value">
              🪙{" "}
              {difficulty === "Easy"
                ? 5
                : difficulty === "Medium"
                ? 10
                : 20}{" "}
              Gold
            </span>
          </div>

          {/* ERROR */}

          {error && (
            <div className="quest-error">
              {error}
            </div>
          )}

          {/* SUCCESS */}

          {success && (
            <div className="quest-success">
              {success}
            </div>
          )}

          {/* CREATE */}

          <button
            type="submit"
            className="create-quest-button"
            disabled={creating}
          >
            {creating
              ? "Creating Quest..."
              : "Create Quest"}
          </button>
        </form>
      </section>

      {/* QUEST LIST */}

      <section className="quests-list-section">
        <div className="quests-list-header">
          <div>
            <p className="section-label">
              YOUR JOURNEY
            </p>

            <h2>All Quests</h2>
          </div>

          <span className="quest-count">
            {quests.length}{" "}
            {quests.length === 1
              ? "Quest"
              : "Quests"}
          </span>
        </div>

        {/* REWARD MESSAGE */}

        {rewardMessage && (
          <div className="quest-success reward-message">
            {rewardMessage}
          </div>
        )}

        {/* EMPTY */}

        {quests.length === 0 ? (
          <div className="empty-quests">
            <div className="empty-icon">
              ⚔️
            </div>

            <h3>No quests yet</h3>

            <p>
              Create your first quest and
              start building your character.
            </p>
          </div>
        ) : (
          <div className="quests-list">
            {quests.map((quest) => (
              <div
                key={quest.id}
                className={`quest-card ${
                  quest.completed
                    ? "completed"
                    : ""
                }`}
              >
                <div className="quest-content">
                  <h3 className="quest-title">
                    {quest.title}
                  </h3>

                  {quest.description && (
                    <p className="quest-description">
                      {quest.description}
                    </p>
                  )}

                  <div className="quest-meta">
                    <span>
                      {quest.difficulty}
                    </span>

                    <span className="xp">
                      ⭐ {quest.xp_reward} XP
                    </span>

                    <span className="gold">
                      🪙{" "}
                      {quest.difficulty === "Easy"
                        ? 5
                        : quest.difficulty ===
                          "Medium"
                        ? 10
                        : 20}{" "}
                      Gold
                    </span>
                  </div>
                </div>

                {/* COMPLETE */}

                {quest.completed ? (
                  <span className="completed-badge">
                    ✓ Completed
                  </span>
                ) : (
                  <button
                    className="complete-quest-button"
                    disabled={
                      completingId === quest.id
                    }
                    onClick={() =>
                      handleCompleteQuest(
                        quest.id
                      )
                    }
                  >
                    {completingId === quest.id
                      ? "Completing..."
                      : "Complete Quest"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Quests;