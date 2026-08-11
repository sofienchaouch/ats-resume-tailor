import type { NextFunction, Request, Response } from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import firebaseAppletConfig from "../firebase-applet-config.json" with { type: "json" };

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
    }
  }
}

// ID token verification only needs the project's public certs, not a full
// service account key, so this is safe to initialize unconditionally.
if (!getApps().length) {
  initializeApp({ projectId: firebaseAppletConfig.projectId });
}

// Verifies a Firebase ID token if present and attaches req.user. Never rejects —
// unauthenticated requests fall through to requireServerKey, which decides
// per-route whether a signed-in user or a BYO API key is required.
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    try {
      req.user = await getAuth().verifyIdToken(token);
    } catch (err) {
      console.error("[Auth] Failed to verify ID token:", err instanceof Error ? err.message : err);
    }
  }
  next();
}

// Gate for routes that call the AI provider and therefore cost money.
// Signed-in users may use the server's own Gemini key; guests must supply
// their own key via the x-gemini-key header (already folded into
// req.body.aiConfig.apiKey by the middleware in server.ts).
export function requireServerKey(req: Request, res: Response, next: NextFunction) {
  const hasOwnKey = Boolean(req.body?.aiConfig?.apiKey && String(req.body.aiConfig.apiKey).trim() !== "");
  if (!req.user && !hasOwnKey) {
    return res.status(401).json({
      error: "Sign in or provide your own AI API key in Settings to use this feature.",
      code: "AUTH_OR_KEY_REQUIRED",
      statusCode: 401,
    });
  }
  next();
}
