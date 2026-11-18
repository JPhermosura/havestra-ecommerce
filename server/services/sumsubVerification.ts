import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const apiBaseUrl = "https://api.sumsub.com";

export type SumsubSettings = {
  appToken: string;
  secretKey: string;
  levelName: string;
  webhookSecret: string;
};

export type SumsubDocumentInput = {
  externalUserId: string;
  name: string;
  phone: string;
  idType: string;
  front: Buffer;
  back?: Buffer;
  applicantId?: string;
  onApplicantId?: (applicantId: string) => Promise<void> | void;
};

export function getSumsubSettings(): SumsubSettings | null {
  const { SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY, SUMSUB_LEVEL_NAME, SUMSUB_WEBHOOK_SECRET } = process.env;
  if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY || !SUMSUB_LEVEL_NAME || !SUMSUB_WEBHOOK_SECRET) {
    return null;
  }
  return {
    appToken: SUMSUB_APP_TOKEN,
    secretKey: SUMSUB_SECRET_KEY,
    levelName: SUMSUB_LEVEL_NAME,
    webhookSecret: SUMSUB_WEBHOOK_SECRET,
  };
}

function signRequest(
  settings: SumsubSettings,
  timestamp: string,
  method: string,
  uri: string,
  body: Buffer
) {
  return createHmac("sha256", settings.secretKey)
    .update(timestamp)
    .update(method.toUpperCase())
    .update(uri)
    .update(body)
    .digest("hex");
}

async function sumsubRequest<T>(
  settings: SumsubSettings,
  method: string,
  uri: string,
  body = Buffer.alloc(0),
  contentType = "application/json",
  extraHeaders: Record<string, string> = {}
): Promise<{ data: T; headers: Headers }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signRequest(settings, timestamp, method, uri, body);
  const response = await fetch(`${apiBaseUrl}${uri}`, {
    method,
    headers: {
      "X-App-Token": settings.appToken,
      "X-App-Access-Sig": signature,
      "X-App-Access-Ts": timestamp,
      ...extraHeaders,
      ...(body.length ? { "Content-Type": contentType } : {}),
    },
    ...(body.length ? { body: new Uint8Array(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Sumsub request failed with HTTP ${response.status}`);
  }
  const data = response.status === 204 ? ({} as T) : await response.json() as T;
  return { data, headers: response.headers };
}

function toInternationalPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("09") && digits.length === 11) return `+63${digits.slice(1)}`;
  if (digits.startsWith("639") && digits.length === 12) return `+${digits}`;
  return undefined;
}

function getDocumentType(idType: string) {
  if (idType === "Driver's License") return "DRIVERS";
  if (idType === "Passport") return "PASSPORT";
  if (idType === "Other") return "OTHER";
  return "ID_CARD";
}

function createMultipartDocument(
  metadata: { idDocType: string; idDocSubType: string; country: string },
  image: Buffer
) {
  const boundary = `----Havestra${randomUUID()}`;
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Disposition: form-data; name="content"; filename="document.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    "utf8"
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    body: Buffer.concat([prefix, image, suffix]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function submitSumsubVerification(
  settings: SumsubSettings,
  input: SumsubDocumentInput
): Promise<string> {
  let applicantId = input.applicantId;
  if (!applicantId) {
    const nameParts = input.name.trim().split(/\s+/);
    const firstName = nameParts.shift() || input.name.trim();
    const fixedInfo: Record<string, string> = {
      firstName,
      country: "PHL",
    };
    if (nameParts.length) fixedInfo.lastName = nameParts.join(" ");
    const phone = toInternationalPhone(input.phone);
    const createBody = Buffer.from(JSON.stringify({
      externalUserId: input.externalUserId,
      fixedInfo,
      ...(phone ? { phone } : {}),
    }));
    const { data } = await sumsubRequest<{ id: string }>(
      settings,
      "POST",
      `/resources/applicants?levelName=${encodeURIComponent(settings.levelName)}`,
      createBody
    );
    applicantId = data.id;
    await input.onApplicantId?.(applicantId);
  }

  const idDocType = getDocumentType(input.idType);
  const documents: Array<[string, Buffer]> = [["FRONT_SIDE", input.front]];
  if (input.back) documents.push(["BACK_SIDE", input.back]);
  for (const [side, image] of documents) {
    const multipart = createMultipartDocument(
      { idDocType, idDocSubType: side, country: "PHL" },
      image
    );
    const { data } = await sumsubRequest<{ errors?: unknown[]; warnings?: unknown[] }>(
      settings,
      "POST",
      `/resources/applicants/${encodeURIComponent(applicantId)}/info/idDoc`,
      multipart.body,
      multipart.contentType,
      { "X-Return-Doc-Warnings": "true" }
    );
    if (data.errors?.length || data.warnings?.length) {
      throw new Error("The verification provider marked an ID document as inconclusive.");
    }
  }

  await sumsubRequest(
    settings,
    "POST",
    `/resources/applicants/${encodeURIComponent(applicantId)}/status/pending?reason=registration`
  );
  return applicantId;
}

export async function deactivateSumsubApplicant(
  settings: SumsubSettings,
  applicantId: string
) {
  await sumsubRequest(
    settings,
    "PATCH",
    `/resources/applicants/${encodeURIComponent(applicantId)}/presence/deactivated`
  );
}

const digestAlgorithms: Record<string, string> = {
  HMAC_SHA1_HEX: "sha1",
  HMAC_SHA256_HEX: "sha256",
  HMAC_SHA512_HEX: "sha512",
};

export function verifySumsubWebhookDigest(
  rawBody: Buffer,
  digestHeader: string | undefined,
  algorithmHeader: string | undefined,
  secret: string
) {
  if (!digestHeader || !algorithmHeader) return false;
  const algorithm = digestAlgorithms[algorithmHeader];
  if (!algorithm) return false;

  const calculated = createHmac(algorithm, secret).update(rawBody).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(digestHeader, "hex");
  } catch {
    return false;
  }
  return supplied.length === calculated.length && timingSafeEqual(supplied, calculated);
}