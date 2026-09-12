const supabase = require("../config/supabase");

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: "ERROR",
        message: "Authorization header is required",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "ERROR",
        message: "Invalid authorization format",
      });
    }

    const token = authHeader.replace(
      "Bearer ",
      ""
    );

    if (!token) {
      return res.status(401).json({
        status: "ERROR",
        message: "Access token is required",
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error(
        "AUTH ERROR:",
        error?.message
      );

      return res.status(401).json({
        status: "ERROR",
        message: "Invalid or expired token",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error
    );

    return res.status(401).json({
      status: "ERROR",
      message: "Authentication failed",
    });
  }
}

module.exports = requireAuth;