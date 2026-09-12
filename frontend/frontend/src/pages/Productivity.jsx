import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import "./Productivity.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatHistoryDuration(seconds) {
  const total = Number(seconds) || 0;

  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function formatHistoryDate(dateString) {
  if (!dateString) return "Unknown date";

  return new Date(dateString).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Productivity() {
  const navigate = useNavigate();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  // =========================================================
  // GENERAL STATE
  // =========================================================

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [sessionTitle, setSessionTitle] = useState(
    "Focused Study Session"
  );

  const [sessionType, setSessionType] = useState("study");

  const [savingSession, setSavingSession] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // =========================================================
  // STOPWATCH
  // =========================================================

  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);

  const stopwatchRef = useRef(null);

  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchRef.current = setInterval(() => {
        setStopwatchSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (stopwatchRef.current) {
        clearInterval(stopwatchRef.current);
      }
    };
  }, [stopwatchRunning]);

  function toggleStopwatch() {
    setSuccess("");
    setError("");

    setStopwatchRunning((prev) => !prev);
  }

  function resetStopwatch() {
    setStopwatchRunning(false);
    setStopwatchSeconds(0);
    setSuccess("");
    setError("");
  }

  // =========================================================
  // COUNTDOWN TIMER
  // =========================================================

  const [countdownSeconds, setCountdownSeconds] = useState(
    25 * 60
  );

  const [countdownRunning, setCountdownRunning] =
    useState(false);

  const [countdownInput, setCountdownInput] = useState(25);

  const [countdownInitialSeconds, setCountdownInitialSeconds] =
    useState(25 * 60);

  const countdownRef = useRef(null);

  const countdownFinishedRef = useRef(false);

  useEffect(() => {
    if (countdownRunning) {
      countdownFinishedRef.current = false;

      countdownRef.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);

            setCountdownRunning(false);

            countdownFinishedRef.current = true;

            return 0;
          }

          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [countdownRunning]);

  // =========================================================
  // LOAD STUDY HISTORY
  // =========================================================

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        navigate("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/study-sessions`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load study history"
        );
      }

      setHistory(result || []);
    } catch (err) {
      console.error(
        "LOAD STUDY HISTORY ERROR:",
        err
      );

      setError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    loadHistory();
  }, [user, authLoading]);

  // =========================================================
  // SAVE STUDY SESSION
  // =========================================================

  async function saveStudySession(durationSeconds, type) {
    const duration = Math.floor(Number(durationSeconds));

    if (!Number.isFinite(duration) || duration <= 0) {
      setError(
        "You need to study for at least 1 second to save a session."
      );
      return;
    }

    try {
      setSavingSession(true);
      setError("");
      setSuccess("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        navigate("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/study-sessions`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            title:
              sessionTitle.trim() ||
              "Focused Study Session",

            duration_seconds: duration,

            session_type: type || sessionType,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to save study session"
        );
      }

      // Add new session to history immediately
      if (result.session) {
        setHistory((current) => [
          result.session,
          ...current,
        ]);
      } else {
        await loadHistory();
      }

      // Show XP reward
      const earnedXP =
        result.reward?.xp ||
        result.session?.xp_earned ||
        0;

      setSuccess(
        `🎉 Study session completed! +${earnedXP} XP`
      );

      // Reset stopwatch after successful save
      if (type === "stopwatch") {
        setStopwatchSeconds(0);
        setStopwatchRunning(false);
      }

      // Reset countdown after successful save
      if (type === "countdown") {
        const minutes = Number(countdownInput) || 25;

        setCountdownRunning(false);
        setCountdownSeconds(minutes * 60);
        setCountdownInitialSeconds(minutes * 60);
      }
    } catch (err) {
      console.error(
        "SAVE STUDY SESSION ERROR:",
        err
      );

      setError(err.message);
    } finally {
      setSavingSession(false);
    }
  }

  // =========================================================
  // COUNTDOWN COMPLETION
  // =========================================================

  useEffect(() => {
    if (
      countdownSeconds === 0 &&
      countdownFinishedRef.current
    ) {
      countdownFinishedRef.current = false;

      const completedDuration =
        countdownInitialSeconds;

      saveStudySession(
        completedDuration,
        "countdown"
      );
    }
  }, [countdownSeconds]);

  // =========================================================
  // COUNTDOWN CONTROLS
  // =========================================================

  function startCountdown() {
    setSuccess("");
    setError("");

    if (countdownSeconds > 0) {
      setCountdownRunning(true);
    }
  }

  function pauseCountdown() {
    setCountdownRunning(false);
  }

  function resetCountdown() {
    setCountdownRunning(false);

    countdownFinishedRef.current = false;

    const minutes = Number(countdownInput);

    if (
      Number.isFinite(minutes) &&
      minutes > 0
    ) {
      const seconds = Math.floor(minutes * 60);

      setCountdownSeconds(seconds);
      setCountdownInitialSeconds(seconds);
    } else {
      setCountdownInput(25);
      setCountdownSeconds(25 * 60);
      setCountdownInitialSeconds(25 * 60);
    }

    setSuccess("");
    setError("");
  }

  function setPreset(minutes) {
    setCountdownRunning(false);

    countdownFinishedRef.current = false;

    setCountdownInput(minutes);

    const seconds = minutes * 60;

    setCountdownSeconds(seconds);
    setCountdownInitialSeconds(seconds);

    setSuccess("");
    setError("");
  }

  function handleCustomTimeChange(e) {
    const value = e.target.value;

    setCountdownInput(value);

    const minutes = Number(value);

    if (
      Number.isFinite(minutes) &&
      minutes > 0
    ) {
      const seconds = Math.floor(minutes * 60);

      setCountdownSeconds(seconds);
      setCountdownInitialSeconds(seconds);
    }
  }

  // =========================================================
  // STOPWATCH SAVE
  // =========================================================

  function handleSaveStopwatch() {
    saveStudySession(
      stopwatchSeconds,
      "stopwatch"
    );
  }

  // =========================================================
  // LOGGED OUT / LOADING
  // =========================================================

  if (authLoading) {
    return (
      <main className="productivity-page">
        <div className="loading-screen">
          Loading...
        </div>
      </main>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <main className="productivity-page">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="productivity-header">

        <div>
          <p className="productivity-eyebrow">
            LIFE RPG
          </p>

          <h1>
            Study Timer
          </h1>

          <p className="productivity-subtitle">
            Focus on your lecture. Track your time.
          </p>
        </div>

        <button
          className="back-button"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ← Dashboard
        </button>

      </header>

      {/* =====================================================
          SESSION DETAILS
          ===================================================== */}

      <section className="session-details-card">

        <div>
          <p className="timer-label">
            STUDY SESSION
          </p>

          <h2>
            Record Your Focus
          </h2>

          <p className="session-help">
            Give your session a name and choose
            what you're working on.
          </p>
        </div>

        <div className="session-form">

          <div className="session-field">

            <label htmlFor="session-title">
              Session title
            </label>

            <input
              id="session-title"
              type="text"
              value={sessionTitle}
              onChange={(e) =>
                setSessionTitle(e.target.value)
              }
              placeholder="e.g. DBMS Revision"
              disabled={savingSession}
            />

          </div>

          <div className="session-field">

            <label htmlFor="session-type">
              Session type
            </label>

            <select
              id="session-type"
              value={sessionType}
              onChange={(e) =>
                setSessionType(e.target.value)
              }
              disabled={savingSession}
            >
              <option value="study">
                📚 Study
              </option>

              <option value="lecture">
                🎓 Lecture
              </option>

              <option value="coding">
                💻 Coding
              </option>

              <option value="reading">
                📖 Reading
              </option>
            </select>

          </div>

        </div>

      </section>

      {/* =====================================================
          MESSAGES
          ===================================================== */}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* =====================================================
          TIMERS GRID
          ===================================================== */}

      <div className="timers-grid">

        {/* ===================================================
            STOPWATCH
            =================================================== */}

        <section className="timer-card">

          <p className="timer-label">
            STOPWATCH
          </p>

          <div className="timer-display">
            {formatTime(stopwatchSeconds)}
          </div>

          <p className="timer-status">
            {stopwatchRunning
              ? "Timer running"
              : stopwatchSeconds > 0
              ? "Timer paused"
              : "Ready to focus"}
          </p>

          <div className="timer-actions">

            <button
              className="primary-button"
              onClick={toggleStopwatch}
              disabled={savingSession}
            >
              {stopwatchRunning
                ? "❚❚ Pause"
                : "▶ Start"}
            </button>

            <button
              className="secondary-button"
              onClick={resetStopwatch}
              disabled={
                savingSession ||
                stopwatchSeconds === 0
              }
            >
              ↻ Reset
            </button>

          </div>

          {/* SAVE SESSION */}

          {!stopwatchRunning &&
            stopwatchSeconds > 0 && (
              <button
                className="save-session-button"
                onClick={handleSaveStopwatch}
                disabled={savingSession}
              >
                {savingSession
                  ? "Saving..."
                  : "✓ Complete & Earn XP"}
              </button>
            )}

        </section>

        {/* ===================================================
            COUNTDOWN TIMER
            =================================================== */}

        <section className="timer-card countdown-card">

          <p className="timer-label">
            COUNTDOWN TIMER
          </p>

          <div className="timer-display">
            {formatTime(countdownSeconds)}
          </div>

          <p className="timer-status">

            {countdownSeconds === 0
              ? "Time's up! 🎉 Saving session..."
              : countdownRunning
              ? "Focus session running"
              : "Timer paused"}

          </p>

          {/* PRESETS */}

          <div className="preset-section">

            <p className="preset-title">
              Quick Sessions
            </p>

            <div className="preset-buttons">

              <button
                className="preset-button"
                onClick={() => setPreset(15)}
                disabled={countdownRunning}
              >
                15 min
              </button>

              <button
                className="preset-button"
                onClick={() => setPreset(25)}
                disabled={countdownRunning}
              >
                25 min
              </button>

              <button
                className="preset-button"
                onClick={() => setPreset(45)}
                disabled={countdownRunning}
              >
                45 min
              </button>

              <button
                className="preset-button"
                onClick={() => setPreset(60)}
                disabled={countdownRunning}
              >
                60 min
              </button>

            </div>

          </div>

          {/* CUSTOM TIME */}

          <div className="custom-time">

            <label htmlFor="countdown-minutes">
              Custom minutes
            </label>

            <input
              id="countdown-minutes"
              type="number"
              min="1"
              max="600"
              value={countdownInput}
              disabled={
                countdownRunning ||
                savingSession
              }
              onChange={handleCustomTimeChange}
            />

          </div>

          {/* CONTROLS */}

          <div className="timer-actions">

            {!countdownRunning ? (
              <button
                className="primary-button"
                onClick={startCountdown}
                disabled={
                  countdownSeconds === 0 ||
                  savingSession
                }
              >
                ▶ Start
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={pauseCountdown}
                disabled={savingSession}
              >
                ❚❚ Pause
              </button>
            )}

            <button
              className="secondary-button"
              onClick={resetCountdown}
              disabled={savingSession}
            >
              ↻ Reset
            </button>

          </div>

        </section>

      </div>

      {/* =====================================================
          PRODUCTIVITY INFO
          ===================================================== */}

      <div className="productivity-grid">

        <div className="info-card">

          <div className="info-icon">
            🎓
          </div>

          <h2>
            Lecture Mode
          </h2>

          <p>
            Use the stopwatch when you want to
            track how long you actually study.
          </p>

        </div>

        <div className="info-card">

          <div className="info-icon">
            ⏳
          </div>

          <h2>
            Focus Sessions
          </h2>

          <p>
            Use the countdown timer for structured
            study sessions like 25-minute Pomodoro
            sessions.
          </p>

        </div>

        <div className="info-card">

          <div className="info-icon">
            ⚡
          </div>

          <h2>
            Earn XP
          </h2>

          <p>
            Every 5 minutes of focused study earns
            XP and contributes to your RPG progression.
          </p>

        </div>

      </div>

      {/* =====================================================
          STUDY HISTORY
          ===================================================== */}

      <section className="study-history-card">

        <div className="history-header">

          <div>
            <p className="timer-label">
              YOUR JOURNEY
            </p>

            <h2>
              Study History
            </h2>
          </div>

          <div className="history-count">
            {history.length}{" "}
            {history.length === 1
              ? "session"
              : "sessions"}
          </div>

        </div>

        {loadingHistory ? (
          <div className="history-empty">
            Loading study history...
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">

            <div className="history-empty-icon">
              📚
            </div>

            <h3>
              No study sessions yet
            </h3>

            <p>
              Complete your first focus session
              and your progress will appear here.
            </p>

          </div>
        ) : (
          <div className="history-list">

            {history.map((session) => (

              <div
                className="history-item"
                key={session.id}
              >

                <div className="history-icon">
                  {session.session_type ===
                  "coding"
                    ? "💻"
                    : session.session_type ===
                      "lecture"
                    ? "🎓"
                    : session.session_type ===
                      "reading"
                    ? "📖"
                    : "📚"}
                </div>

                <div className="history-content">

                  <h3>
                    {session.title}
                  </h3>

                  <p>
                    {formatHistoryDate(
                      session.created_at
                    )}
                  </p>

                </div>

                <div className="history-duration">

                  <strong>
                    {formatHistoryDuration(
                      session.duration_seconds
                    )}
                  </strong>

                  <span>
                    Duration
                  </span>

                </div>

                <div className="history-xp">
                  +{session.xp_earned || 0} XP
                </div>

              </div>

            ))}

          </div>
        )}

      </section>

    </main>
  );
}

export default Productivity;