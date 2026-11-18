import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { createWorker } from "tesseract.js";
import { UserModel } from "../models/User.js";
import { deactivateSumsubApplicant, getSumsubSettings } from "./sumsubVerification.js";

const require = createRequire(import.meta.url);
const englishData = require("@tesseract.js-data/eng") as {
  langPath: string;
  gzip: boolean;
};

const defaultMaxFileBytes = 5 * 1024 * 1024;
export const maxIdFileBytes = Math.max(
  256 * 1024,
  Math.min(10 * 1024 * 1024, Number(process.env.MAX_FILE_SIZE) || defaultMaxFileBytes)
);
const maxPixels = 32_000_000;
const privateDirectory = path.resolve(
  process.env.ID_DOCUMENTS_DIR || path.join(homedir(), ".havestra", "id-documents")
);
const workspaceDirectory = path.resolve(process.cwd());
const documentKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i;

export type IdImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export class IdImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdImageValidationError";
  }
}

export function assertPrivateStoragePath() {
  const relative = path.relative(workspaceDirectory, privateDirectory);
  const isInsideWorkspace =
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  if (isInsideWorkspace) {
    throw new Error("ID document storage must be outside the workspace served by the development server");
  }
}

export async function validateAndNormalizeIdImage(
  buffer: Buffer,
  declaredMimeType: string
): Promise<Buffer> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new IdImageValidationError("The ID image is empty.");
  }
  if (buffer.length > maxIdFileBytes) {
    const maximumSizeMb = (maxIdFileBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "");
    throw new IdImageValidationError(`Each ID photo must be ${maximumSizeMb} MB or smaller.`);
  }

  const pipeline = sharp(buffer, { failOn: "error", limitInputPixels: maxPixels });
  let metadata: Metadata;
  try {
    metadata = await pipeline.metadata();
  } catch {
    throw new IdImageValidationError("The uploaded file is not a readable image.");
  }

  const acceptedTypes: Record<string, IdImageMimeType> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const actualMimeType = metadata.format ? acceptedTypes[metadata.format] : undefined;
  if (!actualMimeType || actualMimeType !== declaredMimeType) {
    throw new IdImageValidationError("Use a JPEG, PNG, or WebP image file.");
  }
  if (!metadata.width || !metadata.height || metadata.width < 240 || metadata.height < 180) {
    throw new IdImageValidationError(
      "The ID photo is too small to review. Retake it with the full ID in focus."
    );
  }

  try {
    return await pipeline
      .rotate()
      .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new IdImageValidationError("The uploaded image could not be decoded.");
  }
}

export async function savePrivateIdImage(buffer: Buffer): Promise<string> {
  assertPrivateStoragePath();
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 });

  const key = `${randomUUID()}.jpg`;
  const destination = path.join(privateDirectory, key);
  const temporary = `${destination}.tmp`;
  try {
    await writeFile(temporary, buffer, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
    return key;
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readPrivateIdImage(key: string): Promise<Buffer> {
  assertPrivateStoragePath();
  if (!documentKeyPattern.test(key)) {
    throw new IdImageValidationError("Invalid ID document reference.");
  }
  return readFile(path.join(privateDirectory, key));
}

export async function deletePrivateIdImage(key?: string) {
  if (!key || !documentKeyPattern.test(key)) return;
  await rm(path.join(privateDirectory, key), { force: true });
}

export async function purgeExpiredIdDocuments() {
  const expiredUsers = await UserModel.find({
    idDocumentsExpiresAt: { $lte: new Date() },
  }).select("+idFrontDocumentId +idBackDocumentId +idFrontImage +idBackImage +idProviderApplicantId");

  for (const user of expiredUsers) {
    if (user.idProviderApplicantId) {
      const provider = getSumsubSettings();
      if (provider) {
        try {
          await deactivateSumsubApplicant(provider, user.idProviderApplicantId);
        } catch {
          console.error("[IDRetention] Provider deactivation failed", { count: 1 });
        }
      }
    }
    await Promise.all([
      deletePrivateIdImage(user.idFrontDocumentId),
      deletePrivateIdImage(user.idBackDocumentId),
    ]);
    await UserModel.updateOne(
      { _id: user._id, idDocumentsExpiresAt: { $lte: new Date() } },
      {
        $unset: {
          idFrontDocumentId: 1,
          idBackDocumentId: 1,
          idFrontImage: 1,
          idBackImage: 1,
          idDocumentsExpiresAt: 1,
          idProviderApplicantId: 1,
          idProviderLastEventAt: 1,
          idNameConsistent: 1,
          idConsentAt: 1,
          idConsentVersion: 1,
        },
      }
    );
  }
  return expiredUsers.length;
}

let ocrWorkerPromise: ReturnType<typeof createWorker> | undefined;

async function getOcrWorker() {
  ocrWorkerPromise ??= createWorker("eng", undefined, {
    langPath: englishData.langPath,
    gzip: englishData.gzip,
    logger: () => undefined,
  });
  return ocrWorkerPromise;
}

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function checkNameConsistency(
  images: [Buffer, ...Buffer[]],
  applicantName: string
): Promise<boolean | null> {
  try {
    const worker = await getOcrWorker();
    const results = await Promise.all(images.map(image => worker.recognize(image)));
    const recognizedText = normalizeName(results.map(result => result.data.text).join(" "));
    const nameTokens = normalizeName(applicantName)
      .split(" ")
      .filter(token => token.length > 1);

    if (recognizedText.length < 8 || nameTokens.length === 0) return null;
    return nameTokens.every(token => recognizedText.includes(token));
  } catch {
    return null;
  }
}