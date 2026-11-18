import { describe, expect, it, vi } from "vitest";
import {
  canCaptureFrame,
  getCameraErrorMessage,
  requestCameraStream,
  type ScanQuality,
} from "./IdCameraScanner";

const cameraStream = {
  getTracks: () => [],
  getVideoTracks: () => [],
} as MediaStream;

function namedError(name: string) {
  return Object.assign(new Error(name), { name });
}

const failedQuality: ScanQuality = {
  checks: {
    edgesVisible: false,
    aligned: false,
    focused: false,
    lighting: false,
    glare: false,
  },
  edgeContinuity: { top: 0, right: 0, bottom: 0, left: 0 },
  blurScore: 0,
  brightness: 0,
  glareRatio: 1,
  motion: Number.POSITIVE_INFINITY,
  stableProgress: 0,
};

const passingQuality: ScanQuality = {
  checks: {
    edgesVisible: true,
    aligned: true,
    focused: true,
    lighting: true,
    glare: true,
  },
  edgeContinuity: { top: 1, right: 1, bottom: 1, left: 1 },
  blurScore: 100,
  brightness: 120,
  glareRatio: 0,
  motion: 0,
  stableProgress: 1,
};

describe("ID scanner capture controls", () => {
  it("allows manual capture without quality analysis or stable-motion results", () => {
    expect(canCaptureFrame(true, null, true, false)).toBe(true);
    expect(canCaptureFrame(true, failedQuality, true, false)).toBe(true);
    expect(canCaptureFrame(true, null, false, false)).toBe(false);
    expect(canCaptureFrame(true, null, true, true)).toBe(false);
  });

  it("keeps automatic capture gated on passing quality checks and stability", () => {
    expect(canCaptureFrame(false, null, true, false)).toBe(false);
    expect(canCaptureFrame(false, failedQuality, true, false)).toBe(false);
    expect(canCaptureFrame(false, passingQuality, true, false)).toBe(true);
  });
});

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
