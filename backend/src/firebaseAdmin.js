import admin from "firebase-admin";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  let credential;

  // Check for service account in environment variable (Cloud Run)
  // Support both base64-encoded (from GitHub Actions) and plain JSON formats
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      credential = admin.credential.cert(serviceAccount);
      console.log("Using Firebase service account from base64-encoded environment variable");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_B64 env var:", e);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
      console.log("Using Firebase service account from environment variable");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", e);
    }
  }

  // Fallback to file-based service account (local development)
  if (!credential) {
    try {
      const serviceAccountPath = path.join(
        __dirname,
        "..",
        "firebase-service-account.json"
      );
      const serviceAccount = JSON.parse(
        readFileSync(serviceAccountPath, "utf8")
      );
      credential = admin.credential.cert(serviceAccount);
      console.log("Using Firebase service account from file");
    } catch (e) {
      console.error("Failed to load Firebase service account file:", e);
      throw new Error(
        "Firebase Admin initialization failed. Need either FIREBASE_SERVICE_ACCOUNT env var or firebase-service-account.json file"
      );
    }
  }

  admin.initializeApp({
    credential,
  });
}

const db = admin.firestore();

export { admin, db };
