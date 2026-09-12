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
  // GET AUTH SESSION
  // =========================================================

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Authentication failed. Please login again.");
    }

    return session.access_token;
  }

  // =========================================================
  // LOAD QUESTS
  // =========================================================

  async function loadQuests() {
    try {
      setLoading(true);
      setError("");

      const token = await getAccessToken();

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/tasks`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        throw new Error("Authentication failed. Please login again.");
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));

        throw new Error(
          result.error || "Failed to fetch quests"
        );
      }

      const data = await response.json();

      setQuests(Array.isArray(data) ? data : []);
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

      const token = await getAccessToken();

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/tasks`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            difficulty,
            xp_reward: Number(xpReward),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to create quest"
        );
      }

      setQuests((previous) => [
        result,
        ...previous,
      ]);

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

      setError(
        err.message || "Failed to create quest"
      );
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

      const token = await getAccessToken();

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/tasks/${taskId}/complete`,
        {
          method: "PATCH",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please login again."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to complete quest"
        );
      }

      // Update quest in UI immediately
      setQuests((previous) =>
        previous.map((quest) =>
          quest.id === taskId
            ? result.quest
            : quest
        )
      );

      // Show reward
      if (result.reward) {
        setRewardMessage(
          `🎉 Quest Complete! +${result.reward.xp} XP  +${result.reward.gold} Gold`
        );
      } else {
        setRewardMessage(
          "🎉 Quest completed successfully!"
        );
      }

      // If level increased
      if (
        result.character &&
        result.character.level
      ) {
        setSuccess(
          `Character Level: ${result.character.level}`
        );
      }

      setTimeout(() => {
        setRewardMessage("");
        setSuccess("");
      }, 5000);
    } catch (err) {
      console.error(
        "COMPLETE QUEST ERROR:",
        err
      );

      setError(
        err.message ||
          "Failed to complete quest"
      );
    } finally {
      setCompletingId(null);
    }
  }

  // =========================================================
  // DIFFICULTY XP
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

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="quests-header">

        <div>

          <p className="quests-eyebrow">
            LIFE RPG
          </p>

          <h1>
            Your Quests
          </h1>

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


      {/* =====================================================
          CREATE QUEST
          ===================================================== */}

      <section className="quest-create-card">

        <p className="section-label">
          NEW QUEST
        </p>

        <h2>
          Create a Quest
        </h2>


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
                setDescription(
                  event.target.value
                )
              }
              maxLength={500}
            />

          </div>


          {/* DIFFICULTY + XP */}

          <div className="form-row">

            <div className="form-group">

              <label>
                Difficulty
              </label>

              <div className="difficulty-options">

                <button
                  type="button"
                  className={`difficulty-button ${
                    difficulty === "Easy"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleDifficultyChange(
                      "Easy"
                    )
                  }
                >
                  Easy
                </button>

                <button
                  type="button"
                  className={`difficulty-button ${
                    difficulty === "Medium"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleDifficultyChange(
                      "Medium"
                    )
                  }
                >
                  Medium
                </button>

                <button
                  type="button"
                  className={`difficulty-button ${
                    difficulty === "Hard"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleDifficultyChange(
                      "Hard"
                    )
                  }
                >
                  Hard
                </button>

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
                  setXpReward(
                    event.target.value
                  )
                }
              />

            </div>

          </div>


          {/* REWARD PREVIEW */}

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


      {/* =====================================================
          QUEST LIST
          ===================================================== */}

      <section className="quests-list-section">

        <div className="quests-list-header">

          <div>

            <p className="section-label">
              YOUR JOURNEY
            </p>

            <h2>
              All Quests
            </h2>

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


        {/* NO QUESTS */}

        {quests.length === 0 ? (

          <div className="empty-quests">

            <div className="empty-icon">
              ⚔️
            </div>

            <h3>
              No quests yet
            </h3>

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
                      {quest.difficulty ===
                      "Easy"
                        ? 5
                        : quest.difficulty ===
                          "Medium"
                        ? 10
                        : 20}{" "}
                      Gold
                    </span>

                  </div>

                </div>


                {/* COMPLETE BUTTON */}

                {quest.completed ? (

                  <span className="completed-badge">
                    ✓ Completed
                  </span>

                ) : (

                  <button
                    className="complete-quest-button"
                    disabled={
                      completingId ===
                      quest.id
                    }
                    onClick={() =>
                      handleCompleteQuest(
                        quest.id
                      )
                    }
                  >
                    {completingId ===
                    quest.id
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