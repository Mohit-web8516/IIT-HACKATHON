import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getOrCreateCharacter } from "../services/character";
import { supabase } from "../lib/supabase";
import "./Dashboard.css";
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

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
    ).padStart(2, "0")}:${String(remainingSeconds).padStart(
      2,
      "0"
    )}`;
  }

  // ==========================================================
  // COUNTDOWN
  // ==========================================================

  const [countdownMinutes, setCountdownMinutes] = useState(25);
  const [countdownSeconds, setCountdownSeconds] = useState(
    25 * 60
  );
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
  // AUTH TOKEN
  // ==========================================================

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(
        "Authentication session expired. Please login again."
      );
    }

    return session.access_token;
  }

  // ==========================================================
  // LOAD CHARACTER + ACTIVITIES
  // ==========================================================

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    async function loadData() {
      try {
        const characterData = await getOrCreateCharacter(user.id);

        setCharacter(characterData);

        const token = await getAccessToken();

        const response = await fetch(`${API_URL}/api/tasks`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Authentication failed. Please login again."
            );
          }

          throw new Error("Failed to fetch activities");
        }

        const questData = await response.json();

        setQuests(questData || []);
      } catch (err) {
        console.error("DASHBOARD LOAD ERROR:", err);
        setError(err.message);
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
      const token = await getAccessToken();

      const response = await fetch(
        `${API_URL}/api/tasks/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to delete activity"
        );
      }

      setQuests((prev) =>
        prev.filter((quest) => quest.id !== id)
      );
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
      const token = await getAccessToken();

      const response = await fetch(
        `${API_URL}/api/tasks/${id}/complete`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to complete activity"
        );
      }

      setQuests((prev) =>
        prev.map((quest) =>
          quest.id === id ? result : quest
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

          <p>
            We couldn't load your RPG character.
          </p>
        </div>
      </main>
    );
  }

  const xpProgress = Math.min(
    (character.xp / 100) * 100,
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

        {/* ==================================================
            HEADER
        ================================================== */}

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

        {/* ==================================================
            CHARACTER
        ================================================== */}

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

        {/* ==================================================
            DASHBOARD GRID
        ================================================== */}

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
                          character.strength,
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
                          character.intellect,
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
                          character.discipline,
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
                          character.endurance,
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
                  {character.current_streak}
                </strong>

                <p>
                  days current streak
                </p>
              </div>

            </div>

            <div className="streak-best">

              <span>Best streak</span>

              <strong>
                {character.longest_streak} days
              </strong>

            </div>

          </div>

          {/* ==================================================
              TRACK YOUR PROGRESS
          ================================================== */}

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

          {/* ==================================================
              ACTIVITIES — ONLY ONE SECTION
          ================================================== */}

          <div
            className="dashboard-card activity-card"
            style={{ gridColumn: "1 / -1" }}
          >

            {/* HEADER */}

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

            {/* SUMMARY */}

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

            {/* EMPTY STATE */}

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

              /* ACTIVITY LIST */

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

                    {/* STATUS */}

                    <div className="activity-icon">
                      {quest.completed
                        ? "✓"
                        : "⚔️"}
                    </div>

                    {/* INFORMATION */}

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

                    {/* XP */}

                    <div className="activity-reward">
                      ⭐ {quest.xp_reward} XP
                    </div>

                    {/* COMPLETE + DELETE */}

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