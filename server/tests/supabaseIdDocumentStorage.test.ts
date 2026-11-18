import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import {
  deleteSupabaseIdDocument,
  downloadSupabaseIdDocument,
  IdDocumentObjectNotFoundError,
  IdDocumentStorageUnavailableError,
  uploadSupabaseIdDocument,
} from "../services/supabaseIdDocumentStorage.js";
import { readPrivateIdImage, savePrivateIdImage } from "../services/idDocuments.js";

const storageBucket = {
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
};
const storage = {
  getBucket: vi.fn(),
  from: vi.fn(() => storageBucket),
};
const client = { storage };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://example-project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.stubEnv("SUPABASE_ID_DOCUMENTS_BUCKET", "seller-id-documents");
  vi.mocked(createClient).mockReturnValue(client as never);
  storage.getBucket.mockResolvedValue({ data: { public: false }, error: null });
  storageBucket.upload.mockResolvedValue({ data: { path: "unused" }, error: null });
  storageBucket.download.mockResolvedValue({
    data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    error: null,
  });
  storageBucket.remove.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("private Supabase ID document storage", () => {
  it("fails closed in production when Supabase settings are absent", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_ID_DOCUMENTS_BUCKET", "");

    await expect(savePrivateIdImage(Buffer.from("test"))).rejects.toBeInstanceOf(
      IdDocumentStorageUnavailableError
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses to upload to a public or unverifiable bucket", async () => {
    storage.getBucket.mockResolvedValue({ data: { public: true }, error: null });

    await expect(uploadSupabaseIdDocument(Buffer.from("test"))).rejects.toBeInstanceOf(
      IdDocumentStorageUnavailableError
    );
    expect(storageBucket.upload).not.toHaveBeenCalled();
  });

  it("does not send the service-role key to non-Supabase production hosts", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.invalid");

    await expect(uploadSupabaseIdDocument(Buffer.from("test"))).rejects.toBeInstanceOf(
      IdDocumentStorageUnavailableError
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("stores normalized bytes in the verified private bucket without exposing a URL", async () => {
    const reference = await uploadSupabaseIdDocument(Buffer.from("synthetic test document"));

    expect(reference).toMatch(
      /^supabase:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i
    );
    expect(reference).not.toMatch(/^https?:\/\//i);
    expect(storage.getBucket).toHaveBeenCalledWith("seller-id-documents");
    expect(storageBucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(/\.jpg$/),
      expect.any(Blob),
      expect.objectContaining({ contentType: "image/jpeg", upsert: false })
    );
  });

  it("downloads and deletes private objects through the server-side client", async () => {
    const reference = "supabase:123e4567-e89b-42d3-a456-426614174000.jpg";

    await expect(downloadSupabaseIdDocument(reference)).resolves.toEqual(
      Buffer.from([1, 2, 3])
    );
    await deleteSupabaseIdDocument(reference);

    expect(storageBucket.download).toHaveBeenCalledWith(
      "123e4567-e89b-42d3-a456-426614174000.jpg"
    );
    expect(storageBucket.remove).toHaveBeenCalledWith([
      "123e4567-e89b-42d3-a456-426614174000.jpg",
    ]);
  });

  it("rejects malformed references and never reads legacy local files in production", async () => {
    await expect(downloadSupabaseIdDocument("supabase:../../private.jpg")).rejects.toBeInstanceOf(
      IdDocumentObjectNotFoundError
    );
    await expect(
      readPrivateIdImage("123e4567-e89b-42d3-a456-426614174000.jpg")
    ).rejects.toThrow("ID document is unavailable.");
    expect(storageBucket.download).not.toHaveBeenCalled();
  });
});
