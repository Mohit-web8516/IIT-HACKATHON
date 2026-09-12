import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { signUp } from "../services/auth";

function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const data = await signUp(
        email.trim(),
        password
      );

      if (data.session) {
        navigate("/dashboard");
      } else {
        setSuccess(
          "Account created! Check your email if confirmation is required, then login."
        );
      }
    } catch (err) {
      setError(
        err.message ||
        "Signup failed"
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
          🛡️
        </div>

        <h1>
          Create Your
          <br />
          Character
        </h1>

        <p className="auth-subtitle">
          Your adventure starts here.
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
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            required
          />

          <label>
            Confirm Password
          </label>

          <input
            type="password"
            placeholder="Enter password again"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
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

          {success && (
            <div className="form-success">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create Character"}
          </button>

        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <button
            onClick={() =>
              navigate("/login")
            }
          >
            Login
          </button>
        </p>

      </div>

    </main>
  );
}

export default Signup;