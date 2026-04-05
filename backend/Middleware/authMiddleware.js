import jwt from "jsonwebtoken";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  return typeof secret === "string" && secret.trim().length > 0 ? secret : null;
};

const protect = (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Not authorized to access this route" });
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({
      message: "Server authentication is not configured (missing JWT secret)",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res
      .status(401)
      .json({ message: "Not authorized to access this route" });
  }
};

// Admin only middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as an admin" });
  }
};

const allowRoles =
  (...roles) =>
  (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: "Not authorized for this action" });
  };

export { protect, admin, allowRoles };
