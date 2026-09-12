import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Timer.css";

function Timer() {
  const navigate = useNavigate();

  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const secs = totalSeconds % 60;

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0"),
    ].join(":");
  }

  function handleReset() {
    setRunning(false);
    setSeconds(0);
  }

  return (
    <main className="timer-page">

      {/* HEADER */}

      <header className="timer-header">
        <div>
          <p className="timer-eyebrow">
            LIFE RPG
          </p>

          <h1>Study Timer</h1>

          <p className="timer-subtitle">
            Focus on your lecture. Track your time.
          </p>
        </div>

        <button
          className="timer-back-button"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>
      </header>

      {/* TIMER CARD */}

      <section className="timer-card">

        <div className="timer-label">
          STOPWATCH
        </div>

        <div className="timer-display">
          {formatTime(seconds)}
        </div>

        <div className="timer-status">
          {running ? "Timer is running" : "Timer paused"}
        </div>

        <div className="timer-controls">

          <button
            className="timer-primary-button"
            onClick={() =>
              setRunning((current) => !current)
            }
          >
            {running ? "⏸ Pause" : "▶ Start"}
          </button>

          <button
            className="timer-reset-button"
            onClick={handleReset}
          >
            ↻ Reset
          </button>

        </div>

      </section>

      {/* INFORMATION */}

      <section className="timer-info">

        <div className="timer-info-card">
          <div className="timer-info-icon">
            🎓
          </div>

          <h2>Study Smarter</h2>

          <p>
            Use the stopwatch while attending lectures,
            studying, coding, or completing any focused
            activity.
          </p>
        </div>

        <div className="timer-info-card">
          <div className="timer-info-icon">
            ⚔️
          </div>

          <h2>Build Your Character</h2>

          <p>
            Complete your quests after finishing your
            real-world activities and earn XP and Gold.
          </p>
        </div>

      </section>

    </main>
  );
}

export default Timer;