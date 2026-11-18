import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const storageReferencePrefix = "supabase:";
const objectKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i;

export class IdDocumentStorageUnavailableError extends Error {
  constructor() {
    super("Private ID document storage is unavailable.");
    this.name = "IdDocumentStorageUnavailableError";
  }
}

export class IdDocumentObjectNotFoundError extends Error {
  constructor() {
    super("Private ID document was not found.");
    this.name = "IdDocumentObjectNotFoundError";
  }
}

type StorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

type BucketStorageApi = {
  getBucket: (bucket: string) => Promise<{
    data: { public: boolean } | null;
    error: unknown;
  }>;
};

function hasSupabaseConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    environment.SUPABASE_URL ||
      environment.SUPABASE_SERVICE_ROLE_KEY ||
      environment.SUPABASE_ID_DOCUMENTS_BUCKET
  );
}

export function shouldUseSupabaseIdDocumentStorage(
  environment: NodeJS.ProcessEnv = process.env
) {
  return environment.NODE_ENV === "production" || hasSupabaseConfiguration(environment);
}

export function getSupabaseIdDocumentReference(key: string) {
  return `${storageReferencePrefix}${key}`;
}

export function getSupabaseIdDocumentObjectKey(reference: string) {
  if (!reference.startsWith(storageReferencePrefix)) return null;
  const key = reference.slice(storageReferencePrefix.length);
  return objectKeyPattern.test(key) ? key : null;
}

function getStorageConfig(): StorageConfig {
  const urlValue = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_ID_DOCUMENTS_BUCKET?.trim();
  if (!urlValue || !serviceRoleKey || !bucket) {
    throw new IdDocumentStorageUnavailableError();
  }

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new IdDocumentStorageUnavailableError();
  }
  if (
    (process.env.NODE_ENV === "production" &&
      (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(bucket)
  ) {
    throw new IdDocumentStorageUnavailableError();
  }

  return {
    url: url.origin,
    serviceRoleKey,
    bucket,
  };
}

function getStorageClient(config: StorageConfig) {
  try {
    return createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  } catch {
    throw new IdDocumentStorageUnavailableError();
  }
}

async function assertPrivateBucket(storage: BucketStorageApi, bucket: string) {
  try {
    const { data, error } = await storage.getBucket(bucket);
    if (error || data?.public !== false) {
      throw new IdDocumentStorageUnavailableError();
    }
  } catch {
    throw new IdDocumentStorageUnavailableError();
  }
}

export async function uploadSupabaseIdDocument(buffer: Buffer) {
  const config = getStorageConfig();
  const client = getStorageClient(config);
  await assertPrivateBucket(client.storage, config.bucket);

  const objectKey = `${randomUUID()}.jpg`;
  try {
    const { error } = await client.storage.from(config.bucket).upload(
      objectKey,
      new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }),
      {
        cacheControl: "0",
        contentType: "image/jpeg",
        upsert: false,
      }
    );
    if (error) throw new IdDocumentStorageUnavailableError();
  } catch {
    throw new IdDocumentStorageUnavailableError();
  }

  return getSupabaseIdDocumentReference(objectKey);
}

export async function downloadSupabaseIdDocument(reference: string) {
  const objectKey = getSupabaseIdDocumentObjectKey(reference);
  if (!objectKey) throw new IdDocumentObjectNotFoundError();

  const config = getStorageConfig();
  const client = getStorageClient(config);
  await assertPrivateBucket(client.storage, config.bucket);
  try {
    const { data, error } = await client.storage.from(config.bucket).download(objectKey);
    if (error) {
      if ("statusCode" in error && String(error.statusCode) === "404") {
        throw new IdDocumentObjectNotFoundError();
      }
      throw new IdDocumentStorageUnavailableError();
    }
    return Buffer.from(await data.arrayBuffer());
  } catch (error) {
    if (error instanceof IdDocumentObjectNotFoundError) throw error;
    throw new IdDocumentStorageUnavailableError();
  }
}

export async function deleteSupabaseIdDocument(reference: string) {
  const objectKey = getSupabaseIdDocumentObjectKey(reference);
  if (!objectKey) return;

  const config = getStorageConfig();
  const client = getStorageClient(config);
  await assertPrivateBucket(client.storage, config.bucket);
  try {
    const { error } = await client.storage.from(config.bucket).remove([objectKey]);
    if (error) throw new IdDocumentStorageUnavailableError();
  } catch {
    throw new IdDocumentStorageUnavailableError();
  }
}
