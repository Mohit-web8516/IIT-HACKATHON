import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { signIn } from "../services/auth";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await signIn(
        email.trim(),
        password
      );

      navigate("/dashboard");
    } catch (err) {
      setError(
        err.message ||
        "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">

      <div className="auth-card">

        <button
          className="back-button"
          onClick={() =>
            navigate("/")
          }
        >
          ← Back
        </button>

        <div className="auth-icon">
          ⚔️
        </div>

        <h1>
          Welcome Back,
          <br />
          Adventurer
        </h1>

        <p className="auth-subtitle">
          Continue your journey.
        </p>

        <form
          onSubmit={handleSubmit}
        >

          <label>Email</label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            required
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            required
          />

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading}
          >
            {loading
              ? "Entering..."
              : "Enter the Realm"}
          </button>

        </form>

        <p className="auth-footer">
          Don't have an account?{" "}
          <button
            onClick={() =>
              navigate("/signup")
            }
          >
            Sign up
          </button>
        </p>

      </div>

    </main>
  );
}

export default Login;