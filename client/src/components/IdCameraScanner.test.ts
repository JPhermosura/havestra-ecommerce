import { describe, expect, it, vi } from "vitest";
import {
  getCameraErrorMessage,
  requestCameraStream,
} from "./IdCameraScanner";

const cameraStream = {
  getTracks: () => [],
  getVideoTracks: () => [],
} as MediaStream;

function namedError(name: string) {
  return Object.assign(new Error(name), { name });
}

describe("ID scanner camera initialization", () => {
  it("tries the environment camera first, then falls back to any video camera", async () => {
    const getUserMedia = vi
      .fn<MediaDevices["getUserMedia"]>()
      .mockRejectedValueOnce(namedError("NotFoundError"))
      .mockResolvedValueOnce(cameraStream);

    await expect(
      requestCameraStream({ getUserMedia }, true)
    ).resolves.toBe(cameraStream);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: "environment" },
      },
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, {
      audio: false,
      video: true,
    });
  });

  it("does not assume an environment camera on desktop", async () => {
    const getUserMedia = vi.fn<MediaDevices["getUserMedia"]>().mockResolvedValue(
      cameraStream
    );

    await requestCameraStream({ getUserMedia }, false);

    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: true });
  });

  it("does not retry after camera permission is denied", async () => {
    const getUserMedia = vi
      .fn<MediaDevices["getUserMedia"]>()
      .mockRejectedValue(namedError("NotAllowedError"));

    await expect(requestCameraStream({ getUserMedia }, true)).rejects.toMatchObject({
      name: "NotAllowedError",
    });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it("provides distinct messages for permission, missing camera, and busy camera errors", () => {
    expect(
      getCameraErrorMessage(namedError("NotAllowedError"), true, null)
    ).toContain("permission was denied");
    expect(
      getCameraErrorMessage(namedError("NotFoundError"), true, 0)
    ).toContain("No camera was detected");
    expect(
      getCameraErrorMessage(namedError("NotReadableError"), true, 1)
    ).toContain("already in use");
  });

  it("reports insecure contexts and unavailable camera support clearly", () => {
    expect(
      getCameraErrorMessage(namedError("NotFoundError"), false, null)
    ).toContain("secure connection");
    expect(getCameraErrorMessage(namedError("TypeError"), true, null)).toContain(
      "does not support camera access"
    );
  });
});
