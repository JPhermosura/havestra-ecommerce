import { mkdir, open, rename, stat, chmod } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "./auth.js";

export type IdReviewAction = "VIEW" | "APPROVE" | "REJECT";

type IdReviewAuditEntry = {
  timestamp: string;
  reviewerUserId: string;
  action: IdReviewAction;
  targetUserId: string;
  reasonCode?: string;
};

const logDirectory = path.resolve(process.cwd(), "logs");
const logFile = path.join(logDirectory, "id-reviews.log");
const maxLogBytes = 5 * 1024 * 1024;
const retainedRotations = 5;
const allowedReasonCodes = new Set([
  "blurry_image",
  "name_mismatch",
  "expired_document",
  "unsupported_document",
  "other",
]);

let writeQueue = Promise.resolve();

function reportAuditFailure(error: unknown) {
  const filesystemError = error as NodeJS.ErrnoException;
  try {
    console.error("[Audit.IDReview] Audit log write failed; request processing will continue.", {
      errorName: error instanceof Error ? error.name : "Error",
      errorCode: filesystemError?.code || "UNKNOWN",
      operation: filesystemError?.syscall || "file operation",
    });
  } catch {
    // Logging failure must not propagate into the Express response lifecycle.
  }
}

async function rotateIfNeeded(incomingBytes: number) {
  await mkdir(logDirectory, { recursive: true, mode: 0o700 });
  await chmod(logDirectory, 0o700);

  let currentBytes = 0;
  try {
    currentBytes = (await stat(logFile)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (currentBytes + incomingBytes <= maxLogBytes) return;

  for (let index = retainedRotations; index >= 1; index -= 1) {
    const source = index === 1 ? logFile : `${logFile}.${index - 1}`;
    const destination = `${logFile}.${index}`;
    try {
      await rename(source, destination);
      await chmod(destination, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

async function appendIdReviewAudit(entry: IdReviewAuditEntry) {
  const line = `${JSON.stringify(entry)}\n`;
  await rotateIfNeeded(Buffer.byteLength(line));
  const file = await open(logFile, "a", 0o600);
  try {
    await file.writeFile(line);
    await file.chmod(0o600);
  } finally {
    await file.close();
  }
}

export function auditIdReviewAction(action: IdReviewAction | "REVIEW") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    res.once("finish", () => {
      try {
        if (res.statusCode < 200 || res.statusCode >= 300) return;

        const reviewerUserId = req.user?._id?.toString();
        const targetUserId = req.params.id;
        if (!reviewerUserId || !targetUserId) {
          reportAuditFailure(new Error("Reviewer or target identifier is unavailable."));
          return;
        }

        const resolvedAction =
          action === "REVIEW" &&
          (res.locals.idReviewAction === "APPROVE" || res.locals.idReviewAction === "REJECT")
            ? res.locals.idReviewAction as IdReviewAction
            : action === "REVIEW"
            ? undefined
            : action;
        if (!resolvedAction) return;

        const entry: IdReviewAuditEntry = {
          timestamp: new Date().toISOString(),
          reviewerUserId,
          action: resolvedAction,
          targetUserId,
        };
        if (
          resolvedAction === "REJECT" &&
          typeof req.body?.reasonCode === "string" &&
          allowedReasonCodes.has(req.body.reasonCode)
        ) {
          entry.reasonCode = req.body.reasonCode;
        }

        writeQueue = writeQueue
          .then(() => appendIdReviewAudit(entry))
          .catch(reportAuditFailure);
      } catch (error) {
        reportAuditFailure(error);
      }
    });
    next();
  };
}

export async function flushIdReviewAuditWrites() {
  await writeQueue;
}
