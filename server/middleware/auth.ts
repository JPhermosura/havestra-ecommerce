import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "havestra_secret";

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

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await UserModel.findById(payload.userId).select("-password");
    if (!user) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid authentication token" });
  }
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
