import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.js";
import { getJwtSecret } from "../utils/jwtSecret.js";

const JWT_SECRET = getJwtSecret();

export interface AuthRequest extends Request {
  user?: any;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication token missing" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Authentication token missing" });
  }

  let payload: { userId: string };
  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return res.status(401).json({ error: "Invalid authentication token" });
  }

  let user;
  try {
    user = await UserModel.findById(payload.userId).select("-password");
  } catch (error) {
    console.error("[Auth] Failed to load the authenticated account", {
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res
      .status(500)
      .json({ error: "Unable to verify your account right now" });
  }
  if (!user) {
    return res.status(401).json({ error: "Invalid authentication token" });
  }
  if (user.isSuspended) {
    return res
      .status(403)
      .json({ error: "Account is suspended. Contact support." });
  }

  req.user = user;
  return next();
}

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (user.role !== role) {
      return res.status(403).json({ error: "Access denied" });
    }
    return next();
  };
}

export function requireVerifiedSeller(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "seller") {
    return res.status(403).json({ error: "Only seller accounts can publish products" });
  }
  const legacyVerified = user.isIdVerified === true && user.idVerificationStatus === "not_submitted";
  if (!user.isIdVerified || (user.idVerificationStatus !== "verified" && !legacyVerified)) {
    return res.status(403).json({ error: "Verify your identity before publishing products" });
  }
  if (!user.isSellerApproved) {
    return res.status(403).json({ error: "Your seller application must be approved before publishing products" });
  }
  return next();
}
