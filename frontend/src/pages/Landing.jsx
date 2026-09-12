import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <main className="landing-page">

      <nav className="navbar">
        <div className="logo">
          ⚔️ QuestForge        </div>

        <button
          className="nav-login"
          onClick={() => navigate("/login")}
        >
          Login
        </button>
      </nav>

      <section className="hero">

        <div className="hero-badge">
          TURN YOUR LIFE INTO A GAME
        </div>

        <h1>
          Build your life.
          <br />
          <span>Level up yourself.</span>
        </h1>

        <p>
          Turn your daily goals into quests,
          earn XP, build your attributes,
          maintain streaks and become the
          strongest version of yourself.
        </p>

        <div className="hero-buttons">

          <button
            className="primary-button large-button"
            onClick={() =>
              navigate("/signup")
            }
          >
            Start Your Adventure
          </button>

          <button
            className="secondary-button"
            onClick={() =>
              navigate("/login")
            }
          >
            I already have an account
          </button>

        </div>

      </section>

      <section className="feature-grid">

        <div className="feature-card">
          <span>⚔️</span>
          <h3>Daily Quests</h3>
          <p>
            Convert real-life tasks into
            meaningful quests.
          </p>
        </div>

        <div className="feature-card">
          <span>⭐</span>
          <h3>Earn XP</h3>
          <p>
            Complete quests and level up
            your character.
          </p>
        </div>

        <div className="feature-card">
          <span>🔥</span>
          <h3>Build Streaks</h3>
          <p>
            Stay consistent and create
            powerful habits.
          </p>
        </div>

      </section>

    </main>
  );
}

export default Landing;