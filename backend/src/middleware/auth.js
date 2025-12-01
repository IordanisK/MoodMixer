import { admin } from "../firebaseAdmin.js";

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "No or invalid Authorization header" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // contains uid, email, etc.
    next();
  } catch (err) {
    console.error("Error verifying Firebase token:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
}
