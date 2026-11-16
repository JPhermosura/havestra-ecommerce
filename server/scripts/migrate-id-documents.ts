import "dotenv/config";
import mongoose from "mongoose";
import { UserModel } from "../models/User.js";
import { ID_DOCUMENT_RETENTION_DAYS } from "../../shared/const.js";
import {
  deletePrivateIdImage,
  savePrivateIdImage,
  validateAndNormalizeIdImage,
} from "../services/idDocuments.js";

function decodeLegacyImage(value: string | undefined) {
  if (!value) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function migrate() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGODB_URI or MONGO_URI is required");
  await mongoose.connect(mongoUri);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const users = await UserModel.find({
    $or: [
      { idFrontImage: { $exists: true, $ne: "" } },
      { idBackImage: { $exists: true, $ne: "" } },
    ],
  }).select("+idFrontImage +idBackImage +idFrontDocumentId +idBackDocumentId");

  for (const user of users) {
    if (user.idFrontDocumentId && user.idBackDocumentId && !user.idFrontImage && !user.idBackImage) {
      skipped += 1;
      continue;
    }

    const front = decodeLegacyImage(user.idFrontImage);
    const back = decodeLegacyImage(user.idBackImage);
    if (!front || !back) {
      failed += 1;
      continue;
    }

    const newKeys: string[] = [];
    const oldKeys = [user.idFrontDocumentId, user.idBackDocumentId];
    let userSaved = false;
    try {
      const [frontBuffer, backBuffer] = await Promise.all([
        validateAndNormalizeIdImage(front.buffer, front.mimeType),
        validateAndNormalizeIdImage(back.buffer, back.mimeType),
      ]);
      const frontKey = await savePrivateIdImage(frontBuffer);
      newKeys.push(frontKey);
      const backKey = await savePrivateIdImage(backBuffer);
      newKeys.push(backKey);

      user.idFrontDocumentId = frontKey;
      user.idBackDocumentId = backKey;
      user.idFrontImage = undefined;
      user.idBackImage = undefined;
      user.idVerificationStatus = user.isIdVerified ? "verified" : "pending_review";
      user.idSubmittedAt = user.idSubmittedAt || user.createdAt || new Date();
      user.idDocumentsExpiresAt = new Date(Date.now() + ID_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      await user.save();
      userSaved = true;
      await Promise.allSettled(oldKeys.map(deletePrivateIdImage));
      migrated += 1;
    } catch {
      if (!userSaved) await Promise.all(newKeys.map(deletePrivateIdImage));
      failed += 1;
    }
  }

  console.log(`ID document migration finished: migrated=${migrated}, skipped=${skipped}, failed=${failed}`);
  await mongoose.disconnect();
  if (failed > 0) process.exitCode = 1;
}

migrate().catch(async error => {
  console.error("ID document migration failed", {
    errorName: error instanceof Error ? error.name : "Error",
  });
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});