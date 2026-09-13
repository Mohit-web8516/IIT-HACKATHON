import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getOrCreateCharacter } from "../services/character";
import { supabase } from "../lib/supabase";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [character, setCharacter] = useState(null);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // STOPWATCH
  // ==========================================================

  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);

  useEffect(() => {
    if (!stopwatchRunning) return;

    const interval = setInterval(() => {
      setStopwatchSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [stopwatchRunning]);

  function formatStopwatch(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(
      minutes
    ).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  // ==========================================================
  // COUNTDOWN
  // ==========================================================

  const [countdownMinutes, setCountdownMinutes] = useState(25);
  const [countdownSeconds, setCountdownSeconds] = useState(25 * 60);
  const [countdownRunning, setCountdownRunning] = useState(false);

  useEffect(() => {
    if (!countdownRunning) return;

    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          setCountdownRunning(false);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownRunning]);

  function formatCountdown(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  function changeCountdownMinutes(amount) {
    const newMinutes = Math.max(
      1,
      Math.min(180, Number(countdownMinutes) + amount)
    );

    setCountdownMinutes(newMinutes);
    setCountdownSeconds(newMinutes * 60);
    setCountdownRunning(false);
  }

  function setCustomCountdown(event) {
    const value = Number(event.target.value);

    if (!value || value < 1) return;

    const limitedValue = Math.min(value, 180);

    setCountdownMinutes(limitedValue);
    setCountdownSeconds(limitedValue * 60);
    setCountdownRunning(false);
  }

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        // Load / create character
        const characterData = await getOrCreateCharacter(user.id);

        if (!characterData) {
          throw new Error("Character could not be loaded.");
        }

        setCharacter(characterData);

        // ======================================================
        // LOAD ACTIVITIES DIRECTLY FROM SUPABASE
        // This removes dependency on the broken Render /api/tasks
        // ======================================================

        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (taskError) {
          console.error("SUPABASE TASK ERROR:", taskError);
          throw new Error(taskError.message);
        }

        setQuests(taskData || []);
      } catch (err) {
        console.error("DASHBOARD LOAD ERROR:", err);
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, authLoading, navigate]);

  // ==========================================================
  // DELETE ACTIVITY
  // ==========================================================

  async function deleteQuest(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this activity?"
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setQuests((prev) => prev.filter((quest) => quest.id !== id));
    } catch (err) {
      console.error("DELETE ACTIVITY ERROR:", err);
      alert(err.message);
    }
  }

  // ==========================================================
  // COMPLETE ACTIVITY
  // ==========================================================

  async function completeQuest(id) {
    try {
      const quest = quests.find((item) => item.id === id);

      if (!quest) {
        throw new Error("Activity not found.");
      }

      if (quest.completed) {
        return;
      }

      const earnedXP = Number(quest.xp_reward) || 10;

      // --------------------------------------------------------
      // COMPLETE TASK
      // --------------------------------------------------------

      const { data: completedTask, error: taskError } = await supabase
        .from("tasks")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (taskError) {
        throw new Error(taskError.message);
      }

      // --------------------------------------------------------
      // GET CHARACTER
      // --------------------------------------------------------

      const { data: currentCharacter, error: characterError } =
        await supabase
          .from("characters")
          .select("*")
          .eq("user_id", user.id)
          .single();

      if (characterError || !currentCharacter) {
        throw new Error("Character not found.");
      }

      // --------------------------------------------------------
      // XP
      // --------------------------------------------------------

      let newXP = Number(currentCharacter.xp || 0) + earnedXP;
      let newLevel = Number(currentCharacter.level || 1);

      const oldLevel = newLevel;

      while (newXP >= 100) {
        newXP -= 100;
        newLevel += 1;
      }

      // --------------------------------------------------------
      // GOLD
      // --------------------------------------------------------

      let earnedGold = 5;

      if (quest.difficulty === "Medium") {
        earnedGold = 10;
      }

      if (quest.difficulty === "Hard") {
        earnedGold = 20;
      }

      const newGold =
        Number(currentCharacter.gold || 0) + earnedGold;

      // --------------------------------------------------------
      // SUPER CHARACTER
      // --------------------------------------------------------

      let superCharacterUnlocked =
        currentCharacter.super_character_unlocked || false;

      if (newLevel >= 5) {
        superCharacterUnlocked = true;
      }

      // --------------------------------------------------------
      // UPDATE CHARACTER
      // --------------------------------------------------------

      const { data: updatedCharacter, error: updateError } =
        await supabase
          .from("characters")
          .update({
            xp: newXP,
            level: newLevel,
            gold: newGold,
            super_character_unlocked: superCharacterUnlocked,
          })
          .eq("user_id", user.id)
          .select()
          .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setCharacter(updatedCharacter);

      // Update task in UI
      setQuests((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...completedTask,
                character: updatedCharacter,
                earnedXP,
                earnedGold,
                levelUp: newLevel > oldLevel,
              }
            : item
        )
      );
    } catch (err) {
      console.error("COMPLETE ACTIVITY ERROR:", err);
      alert(err.message);
    }
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (authLoading || loading) {
    return (
      <main className="dashboard-page">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading your adventure...</p>
        </div>
      </main>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {
    return (
      <main className="dashboard-page">
        <div className="error-state">
          <div className="error-icon">⚠️</div>

          <h2>Something went wrong</h2>

          <p>{error}</p>

          <button
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="dashboard-page">
        <div className="error-state">
          <div className="error-icon">⚔️</div>

          <h2>Character not found</h2>

          <p>We couldn't load your RPG character.</p>
        </div>
      </main>
    );
  }

  // ==========================================================
  // DASHBOARD DATA
  // ==========================================================

  const xpProgress = Math.min(
    (Number(character.xp || 0) / 100) * 100,
    100
  );

  const completedQuests = quests.filter(
    (quest) => quest.completed
  ).length;

  const remainingQuests =
    quests.length - completedQuests;

  const availableXP = quests.reduce(
    (total, quest) =>
      total + Number(quest.xp_reward || 0),
    0
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">

        {/* HEADER */}

        <header className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">
              LIFE RPG
            </p>

            <h1>Your Adventure</h1>

            <p className="dashboard-subtitle">
              Build your character. Complete your quests.
              Level up your life.
            </p>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </header>

        {/* CHARACTER */}

        <section className="character-overview">
          <div className="character-card">

            <div className="character-icon">
              ⚔️
            </div>

            <div className="character-info">

              <div className="character-title-row">

                <div>
                  <p className="section-label">
                    YOUR CHARACTER
                  </p>

                  <h2>
                    Level {character.level} Adventurer
                  </h2>
                </div>

                <div className="next-level">
                  <span>Next Level</span>

                  <strong>
                    Level {Number(character.level) + 1}
                  </strong>
                </div>

              </div>

              <div className="xp-container">

                <div className="xp-label">
                  <span>XP</span>

                  <span>
                    {character.xp} / 100
                  </span>
                </div>

                <div className="xp-bar">
                  <div
                    className="xp-progress"
                    style={{
                      width: `${xpProgress}%`,
                    }}
                  />
                </div>

              </div>

            </div>

            <div className="gold-display">
              <span>🪙</span>

              <div>
                <p>GOLD</p>

                <strong>
                  {character.gold}
                </strong>
              </div>
            </div>

          </div>
        </section>

        {/* DASHBOARD GRID */}

        <section className="dashboard-grid">

          {/* ATTRIBUTES */}

          <div className="dashboard-card">

            <div className="card-header">

              <div>
                <p className="section-label">
                  CHARACTER
                </p>

                <h2>Attributes</h2>
              </div>

            </div>

            <div className="attributes-list">

              <div className="attribute">
                <span className="attribute-icon">
                  💪
                </span>

                <div className="attribute-content">

                  <div className="attribute-name">
                    <span>Strength</span>

                    <strong>
                      {character.strength}
                    </strong>
                  </div>

                  <div className="attribute-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          Number(character.strength || 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                </div>
              </div>

              <div className="attribute">
                <span className="attribute-icon">
                  🧠
                </span>

                <div className="attribute-content">

                  <div className="attribute-name">
                    <span>Intellect</span>

                    <strong>
                      {character.intellect}
                    </strong>
                  </div>

                  <div className="attribute-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          Number(character.intellect || 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                </div>
              </div>

              <div className="attribute">
                <span className="attribute-icon">
                  🎯
                </span>

                <div className="attribute-content">

                  <div className="attribute-name">
                    <span>Discipline</span>

                    <strong>
                      {character.discipline}
                    </strong>
                  </div>

                  <div className="attribute-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          Number(character.discipline || 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                </div>
              </div>

              <div className="attribute">
                <span className="attribute-icon">
                  ❤️
                </span>

                <div className="attribute-content">

                  <div className="attribute-name">
                    <span>Endurance</span>

                    <strong>
                      {character.endurance}
                    </strong>
                  </div>

                  <div className="attribute-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          Number(character.endurance || 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                </div>
              </div>

            </div>
          </div>

          {/* STREAK */}

          <div className="dashboard-card streak-card">

            <div>
              <p className="section-label">
                CONSISTENCY
              </p>

              <h2>Streak</h2>
            </div>

            <div className="streak-main">

              <span>🔥</span>

              <div>
                <strong>
                  {character.current_streak || 0}
                </strong>

                <p>
                  days current streak
                </p>
              </div>

            </div>

            <div className="streak-best">

              <span>Best streak</span>

              <strong>
                {character.longest_streak || 0} days
              </strong>

            </div>

          </div>

          {/* FOCUS */}

          <div
            className="dashboard-card focus-card"
            style={{ gridColumn: "1 / -1" }}
          >

            <div className="card-header">

              <div>
                <p className="section-label">
                  FOCUS
                </p>

                <h2>
                  Track Your Progress
                </h2>
              </div>

              <div className="focus-badge">
                🎯 Stay Focused
              </div>

            </div>

            <div className="timer-grid">

              {/* STOPWATCH */}

              <div className="timer-card stopwatch-card">

                <div className="timer-card-header">

                  <div className="timer-icon">
                    ⏱️
                  </div>

                  <div>
                    <h3>Stopwatch</h3>

                    <p>
                      Track how long you work
                    </p>
                  </div>

                </div>

                <div className="timer-display">
                  {formatStopwatch(stopwatchSeconds)}
                </div>

                <div className="timer-status">

                  <span
                    className={
                      stopwatchRunning
                        ? "status-dot active"
                        : "status-dot"
                    }
                  ></span>

                  {stopwatchRunning
                    ? "Recording your progress"
                    : "Ready to start"}

                </div>

                <div className="timer-actions">

                  {!stopwatchRunning ? (
                    <button
                      className="primary-button"
                      onClick={() =>
                        setStopwatchRunning(true)
                      }
                    >
                      ▶ Start
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() =>
                        setStopwatchRunning(false)
                      }
                    >
                      ⏸ Pause
                    </button>
                  )}

                  <button
                    className="secondary-button"
                    onClick={() => {
                      setStopwatchRunning(false);
                      setStopwatchSeconds(0);
                    }}
                  >
                    ↻ Reset
                  </button>

                </div>

              </div>

              {/* COUNTDOWN */}

              <div className="timer-card countdown-card">

                <div className="timer-card-header">

                  <div className="timer-icon">
                    ⏳
                  </div>

                  <div>
                    <h3>Countdown</h3>

                    <p>
                      Complete a focused session
                    </p>
                  </div>

                </div>

                <div className="timer-display">
                  {formatCountdown(countdownSeconds)}
                </div>

                <div className="quick-times">

                  {[5, 15, 25, 45].map(
                    (minutes) => (
                      <button
                        key={minutes}
                        disabled={countdownRunning}
                        className={
                          countdownMinutes === minutes
                            ? "time-button selected"
                            : "time-button"
                        }
                        onClick={() => {
                          setCountdownMinutes(minutes);
                          setCountdownSeconds(
                            minutes * 60
                          );
                          setCountdownRunning(false);
                        }}
                      >
                        {minutes}m
                      </button>
                    )
                  )}

                </div>

                <div className="custom-time">

                  <label>
                    Custom minutes
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={countdownMinutes}
                    disabled={countdownRunning}
                    onChange={setCustomCountdown}
                  />

                  <button
                    className="add-time-button"
                    disabled={countdownRunning}
                    onClick={() =>
                      changeCountdownMinutes(5)
                    }
                  >
                    +5
                  </button>

                </div>

                <div className="timer-actions">

                  {!countdownRunning ? (
                    <button
                      className="primary-button"
                      disabled={countdownSeconds === 0}
                      onClick={() =>
                        setCountdownRunning(true)
                      }
                    >
                      ▶ Start
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() =>
                        setCountdownRunning(false)
                      }
                    >
                      ⏸ Pause
                    </button>
                  )}

                  <button
                    className="secondary-button"
                    onClick={() => {
                      setCountdownRunning(false);
                      setCountdownSeconds(
                        countdownMinutes * 60
                      );
                    }}
                  >
                    ↻ Reset
                  </button>

                </div>

                {countdownSeconds === 0 && (
                  <p className="time-up">
                    ⏰ Time's up!
                  </p>
                )}

              </div>

            </div>
          </div>

          {/* ACTIVITIES */}

          <div
            className="dashboard-card activity-card"
            style={{ gridColumn: "1 / -1" }}
          >

            <div className="card-header activity-header">

              <div>
                <p className="section-label">
                  TODAY
                </p>

                <h2>Your Activities</h2>
              </div>

              <button
                className="primary-button"
                onClick={() => navigate("/quests")}
              >
                + Add Activity
              </button>

            </div>

            {quests.length > 0 && (
              <div className="activity-summary">

                <div className="activity-stat">
                  <strong>{quests.length}</strong>
                  <span>Total</span>
                </div>

                <div className="activity-stat">
                  <strong>{completedQuests}</strong>
                  <span>Completed</span>
                </div>

                <div className="activity-stat">
                  <strong>{remainingQuests}</strong>
                  <span>Remaining</span>
                </div>

                <div className="activity-stat">
                  <strong>{availableXP}</strong>
                  <span>Available XP</span>
                </div>

              </div>
            )}

            {quests.length === 0 ? (

              <div className="empty-activity">

                <div className="empty-activity-icon">
                  ⚔️
                </div>

                <h3>
                  No activities yet
                </h3>

                <p>
                  Create your first activity and
                  start building your character.
                </p>

                <button
                  className="primary-button"
                  onClick={() => navigate("/quests")}
                >
                  Create Activity
                </button>

              </div>

            ) : (

              <div className="activity-list">

                {quests.map((quest) => (

                  <div
                    className={`activity-item ${
                      quest.completed
                        ? "completed"
                        : ""
                    }`}
                    key={quest.id}
                  >

                    <div className="activity-icon">
                      {quest.completed
                        ? "✓"
                        : "⚔️"}
                    </div>

                    <div className="activity-info">

                      <strong>
                        {quest.title}
                      </strong>

                      {quest.description && (
                        <span>
                          {quest.description}
                        </span>
                      )}

                      <small>
                        {quest.difficulty} •{" "}
                        {quest.xp_reward} XP
                      </small>

                    </div>

                    <div className="activity-reward">
                      ⭐ {quest.xp_reward} XP
                    </div>

                    <div className="activity-actions">

                      {!quest.completed && (
                        <button
                          className="complete-button"
                          onClick={() =>
                            completeQuest(quest.id)
                          }
                        >
                          ✓ Complete
                        </button>
                      )}

                      <button
                        className="delete-button"
                        onClick={() =>
                          deleteQuest(quest.id)
                        }
                      >
                        🗑 Delete
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        </section>

      </div>
    </main>
  );
}

export default Dashboard;