import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandMark from "@/components/BrandMark";
import {
  analyzeIdFrame,
  measureFrameMotion,
  type IdFrameAnalysis,
} from "@/lib/idScannerQuality";

type FrameChecks = IdFrameAnalysis["checks"];
export type ScanQuality = {
  checks: FrameChecks;
  edgeContinuity: IdFrameAnalysis["edgeContinuity"];
  blurScore: number;
  brightness: number;
  glareRatio: number;
  motion: number;
  stableProgress: number;
};

const ANALYSIS_WIDTH = 160;
const AUTO_CAPTURE_STABLE_MS = 1500;
const STABLE_MOTION_THRESHOLD = 7;

export function canCaptureFrame(
  manual: boolean,
  quality: ScanQuality | null,
  cameraReady: boolean,
  isCapturing: boolean
) {
  if (!cameraReady || isCapturing) return false;
  if (manual) return true;
  return Boolean(
    quality &&
      Object.values(quality.checks).every(Boolean) &&
      quality.motion <= STABLE_MOTION_THRESHOLD &&
      quality.stableProgress >= 1
  );
}

type CameraDevice = {
  deviceId: string;
  label: string;
};

const PERMISSION_DENIED_MESSAGE =
  "Camera permission was denied. Allow camera access in your browser settings, then retry.";
const UNSUPPORTED_CAMERA_MESSAGE =
  "This browser does not support camera access. Use Upload from Device instead.";
const INSECURE_CONTEXT_MESSAGE =
  "Camera access requires a secure connection (HTTPS or localhost). Use Upload from Device instead.";

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

export function getCameraErrorMessage(
  error: unknown,
  secureContext: boolean,
  cameraCount: number | null
) {
  if (!secureContext) return INSECURE_CONTEXT_MESSAGE;

  switch (getErrorName(error)) {
    case "NotAllowedError":
      return PERMISSION_DENIED_MESSAGE;
    case "SecurityError":
      return "Camera access is blocked by browser settings or this site's permissions policy.";
    case "NotFoundError":
      return "No camera was detected. Connect a camera or use Upload from Device.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is already in use or could not be opened. Close other camera apps and retry.";
    case "OverconstrainedError":
      return cameraCount === 0
        ? "No camera was detected. Connect a camera or use Upload from Device."
        : "That camera is unavailable. Select another camera or retry.";
    case "TypeError":
      return UNSUPPORTED_CAMERA_MESSAGE;
    default:
      return "Camera could not be started. Retry or use Upload from Device.";
  }
}

export async function requestCameraStream(
  mediaDevices: Pick<MediaDevices, "getUserMedia">,
  preferEnvironment: boolean,
  deviceId?: string
) {
  const videoSize = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
  if (deviceId) {
    return mediaDevices.getUserMedia({
      audio: false,
      video: { ...videoSize, deviceId: { exact: deviceId } },
    });
  }

  if (preferEnvironment) {
    try {
      return await mediaDevices.getUserMedia({
        audio: false,
        video: { ...videoSize, facingMode: { ideal: "environment" } },
      });
    } catch (error) {
      const errorName = getErrorName(error);
      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        throw error;
      }
    }
  }

  return mediaDevices.getUserMedia({ audio: false, video: true });
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

function mapDisplayRectToSource(
  video: HTMLVideoElement,
  containerRect: DOMRect,
  displayRect: DOMRect
) {
  const scale = Math.max(
    containerRect.width / video.videoWidth,
    containerRect.height / video.videoHeight
  );
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  const offsetX = (containerRect.width - renderedWidth) / 2;
  const offsetY = (containerRect.height - renderedHeight) / 2;
  const x = (displayRect.left - containerRect.left - offsetX) / scale;
  const y = (displayRect.top - containerRect.top - offsetY) / scale;
  const width = displayRect.width / scale;
  const height = displayRect.height / scale;
  const left = Math.max(0, Math.min(video.videoWidth, x));
  const top = Math.max(0, Math.min(video.videoHeight, y));
  const right = Math.max(left, Math.min(video.videoWidth, x + width));
  const bottom = Math.max(top, Math.min(video.videoHeight, y + height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export default function IdCameraScanner({
  documentType,
  sideLabel,
  onAccept,
  onClose,
  onUseUpload,
}: {
  documentType: string;
  sideLabel: string;
  onAccept: (file: File) => Promise<boolean>;
  onClose: () => void;
  onUseUpload: () => void;
}) {
  const isPassport = documentType.toLowerCase() === "passport";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);
  const frameRequestRef = useRef<number | null>(null);
  const lastAnalysisAtRef = useRef(0);
  const lastLuminanceRef = useRef<Uint8Array | null>(null);
  const stableSinceRef = useRef(0);
  const qualityRef = useRef<ScanQuality | null>(null);
  const captureLockRef = useRef(false);
  const autoCapturePausedRef = useRef(false);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "error">(
    "starting"
  );
  const [cameraError, setCameraError] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [quality, setQuality] = useState<ScanQuality | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const clearStream = useCallback((updateState = true) => {
    generationRef.current += 1;
    const activeStream = streamRef.current;
    streamRef.current = null;
    stopTracks(activeStream);
    if (updateState) setStream(null);
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    clearStream();
    const requestId = ++generationRef.current;
    setCameraState("starting");
    setCameraError("");
    setQuality(null);
    qualityRef.current = null;
    lastLuminanceRef.current = null;
    stableSinceRef.current = 0;
    captureLockRef.current = false;
    autoCapturePausedRef.current = false;

    const secureContext =
      typeof window !== "undefined" && window.isSecureContext;
    if (!secureContext) {
      setCameraState("error");
      setCameraError(INSECURE_CONTEXT_MESSAGE);
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setCameraState("error");
      setCameraError(UNSUPPORTED_CAMERA_MESSAGE);
      return;
    }

    try {
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          if (requestId !== generationRef.current) return;
          if (permission.state === "denied") {
            setCameraState("error");
            setCameraError(PERMISSION_DENIED_MESSAGE);
            return;
          }
        } catch {
          // Permission queries are optional; getUserMedia remains authoritative.
        }
      }

      const nextStream = await requestCameraStream(
        navigator.mediaDevices,
        !deviceId && isMobileDevice(),
        deviceId
      );
      if (requestId !== generationRef.current) {
        stopTracks(nextStream);
        return;
      }
      if (!nextStream.getVideoTracks().some(track => track.readyState === "live")) {
        stopTracks(nextStream);
        throw new DOMException("No live video track was returned.", "NotFoundError");
      }
      streamRef.current = nextStream;
      setStream(nextStream);

      const activeDeviceId =
        nextStream.getVideoTracks()[0]?.getSettings().deviceId || deviceId || "";
      setSelectedCameraId(activeDeviceId);
      if (typeof navigator.mediaDevices.enumerateDevices === "function") {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (
            requestId !== generationRef.current ||
            streamRef.current !== nextStream
          ) {
            return;
          }
          const cameras = devices
            .filter(device => device.kind === "videoinput")
            .map((device, index) => ({
              deviceId: device.deviceId,
              label: device.label || `Camera ${index + 1}`,
            }));
          setCameraDevices(cameras);
          if (
            activeDeviceId &&
            cameras.some(camera => camera.deviceId === activeDeviceId)
          ) {
            setSelectedCameraId(activeDeviceId);
          }
        } catch {
          // A live stream remains usable when device enumeration is unavailable.
        }
      }
    } catch (error) {
      if (requestId !== generationRef.current) return;
      setCameraState("error");
      let cameraCount: number | null = null;
      if (typeof navigator.mediaDevices.enumerateDevices === "function") {
        try {
          cameraCount = (await navigator.mediaDevices.enumerateDevices()).filter(
            device => device.kind === "videoinput"
          ).length;
        } catch {
          cameraCount = null;
        }
      }
      if (requestId !== generationRef.current) return;
      setCameraError(getCameraErrorMessage(error, secureContext, cameraCount));
    }
  }, [clearStream]);

  useEffect(() => {
    void startCamera();
    return () => {
      if (frameRequestRef.current !== null)
        cancelAnimationFrame(frameRequestRef.current);
      clearStream(false);
    };
  }, [clearStream, startCamera]);

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    const videoTracks = stream.getVideoTracks();
    let frameReadyTimeout = 0;
    const onVideoReady = () => {
      if (
        streamRef.current !== stream ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        return;
      }
      window.clearTimeout(frameReadyTimeout);
      setCameraState("ready");
    };
    const onTrackEnded = () => {
      if (streamRef.current !== stream) return;
      clearStream();
      setCameraState("error");
      setCameraError("The camera disconnected. Retry or use Upload from Device.");
    };
    videoTracks.forEach(track => track.addEventListener("ended", onTrackEnded));
    frameReadyTimeout = window.setTimeout(() => {
      if (
        streamRef.current !== stream ||
        (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0)
      ) {
        return;
      }
      clearStream();
      setCameraState("error");
      setCameraError("The camera preview could not start. Try uploading an image.");
    }, 5000);
    video.addEventListener("loadeddata", onVideoReady);
    video.srcObject = stream;
    void video
      .play()
      .then(() => {
        if (streamRef.current !== stream) return;
        if (!videoTracks.some(track => track.readyState === "live")) {
          clearStream();
          setCameraState("error");
          setCameraError("No active camera stream is available. Retry or upload an image.");
          return;
        }
        onVideoReady();
      })
      .catch(() => {
        if (streamRef.current !== stream) return;
        clearStream();
        setCameraState("error");
        setCameraError("The camera preview could not start. Try uploading an image.");
      });
    return () => {
      videoTracks.forEach(track =>
        track.removeEventListener("ended", onTrackEnded)
      );
      video.removeEventListener("loadeddata", onVideoReady);
      window.clearTimeout(frameReadyTimeout);
      video.srcObject = null;
    };
  }, [clearStream, stream]);

  useEffect(() => {
    if (!capturedPreview) return;
    return () => URL.revokeObjectURL(capturedPreview);
  }, [capturedPreview]);

  const captureFrame = useCallback(
    async (manual: boolean) => {
      const video = videoRef.current;
      const preview = previewRef.current;
      const guide = guideRef.current;
      const latestQuality = qualityRef.current;
      if (
        captureLockRef.current ||
        !video ||
        !preview ||
        !guide ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight ||
        !canCaptureFrame(manual, latestQuality, cameraState === "ready", false)
      ) {
        return;
      }

      captureLockRef.current = true;
      setIsCapturing(true);
      try {
        const containerRect = preview.getBoundingClientRect();
        const guideRect = guide.getBoundingClientRect();
        const crop = mapDisplayRectToSource(video, containerRect, guideRect);
        if (crop.width < 1 || crop.height < 1) {
          throw new Error("Keep the full ID inside the scanning frame.");
        }

        if (!manual) {
          const qualityCanvas = document.createElement("canvas");
          qualityCanvas.width = ANALYSIS_WIDTH;
          qualityCanvas.height = Math.max(
            24,
            Math.round(ANALYSIS_WIDTH / (crop.width / crop.height))
          );
          const qualityContext = qualityCanvas.getContext("2d", {
            willReadFrequently: true,
          });
          if (!qualityContext) {
            throw new Error("Could not check the captured image quality.");
          }
          qualityContext.drawImage(
            video,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            0,
            0,
            qualityCanvas.width,
            qualityCanvas.height
          );
          const freshAnalysis = analyzeIdFrame(
            qualityContext.getImageData(
              0,
              0,
              qualityCanvas.width,
              qualityCanvas.height
            ).data,
            qualityCanvas.width,
            qualityCanvas.height
          );
          const previousLuminance = lastLuminanceRef.current;
          const freshMotion = previousLuminance
            ? measureFrameMotion(freshAnalysis.luminance, previousLuminance)
            : Number.POSITIVE_INFINITY;
          const freshChecksPass = Object.values(freshAnalysis.checks).every(
            Boolean
          );
          if (!freshChecksPass || freshMotion > STABLE_MOTION_THRESHOLD) {
            captureLockRef.current = false;
            stableSinceRef.current = 0;
            const freshQuality: ScanQuality = {
              checks: freshAnalysis.checks,
              edgeContinuity: freshAnalysis.edgeContinuity,
              blurScore: freshAnalysis.blurScore,
              brightness: freshAnalysis.brightness,
              glareRatio: freshAnalysis.glareRatio,
              motion: freshMotion,
              stableProgress: 0,
            };
            qualityRef.current = freshQuality;
            setQuality(freshQuality);
            return;
          }
        }

        const scale = Math.min(1, 1600 / Math.max(crop.width, crop.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(crop.width * scale));
        canvas.height = Math.max(1, Math.round(crop.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not prepare the camera image.");
        context.drawImage(
          video,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            result =>
              result
                ? resolve(result)
                : reject(new Error("Could not create the captured ID image.")),
            "image/jpeg",
            0.92
          );
        });
        const file = new File([blob], `id-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const objectUrl = URL.createObjectURL(file);
        setCapturedFile(file);
        setCapturedPreview(objectUrl);
        clearStream();
      } catch (error) {
        captureLockRef.current = false;
        if (!manual) {
          autoCapturePausedRef.current = true;
          setCameraError(
            "Automatic image checks are unavailable. You can still capture manually."
          );
        } else {
          setCameraError(
            error instanceof Error
              ? error.message
              : "Could not capture the ID. Adjust the frame and try again."
          );
        }
      } finally {
        setIsCapturing(false);
      }
    },
    [cameraState, clearStream]
  );

  useEffect(() => {
    if (cameraState !== "ready" || !stream || capturedFile) return;
    let active = true;
    const canvas = analysisCanvasRef.current;
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
    } catch {
      context = null;
    }
    if (!canvas || !context) {
      autoCapturePausedRef.current = true;
      setCameraError(
        "Automatic image checks are unavailable. You can still capture manually."
      );
      return;
    }

    const analyzeNextFrame = (now: number) => {
      if (!active || autoCapturePausedRef.current) return;
      if (
        now - lastAnalysisAtRef.current >= 250 &&
        videoRef.current?.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA &&
        previewRef.current &&
        guideRef.current
      ) {
        lastAnalysisAtRef.current = now;
        const video = videoRef.current;
        const containerRect = previewRef.current.getBoundingClientRect();
        const guideRect = guideRef.current.getBoundingClientRect();
        const crop = mapDisplayRectToSource(video, containerRect, guideRect);
        if (crop.width >= 1 && crop.height >= 1) {
          try {
            const analysisHeight = Math.max(
              24,
              Math.round(ANALYSIS_WIDTH / (crop.width / crop.height))
            );
            canvas.width = ANALYSIS_WIDTH;
            canvas.height = analysisHeight;
            context.drawImage(
              video,
              crop.x,
              crop.y,
              crop.width,
              crop.height,
              0,
              0,
              canvas.width,
              canvas.height
            );
            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const analysis = analyzeIdFrame(
              imageData.data,
              canvas.width,
              canvas.height
            );
            const previous = lastLuminanceRef.current;
            const motion = previous
              ? measureFrameMotion(analysis.luminance, previous)
              : Number.POSITIVE_INFINITY;
            lastLuminanceRef.current = analysis.luminance;
            const checksPass = Object.values(analysis.checks).every(Boolean);
            const stable = motion <= STABLE_MOTION_THRESHOLD;
            if (checksPass && stable) {
              if (!stableSinceRef.current) stableSinceRef.current = now;
            } else {
              stableSinceRef.current = 0;
            }
            const stableDuration = stableSinceRef.current
              ? now - stableSinceRef.current
              : 0;
            const nextQuality: ScanQuality = {
              checks: analysis.checks,
              edgeContinuity: analysis.edgeContinuity,
              blurScore: analysis.blurScore,
              brightness: analysis.brightness,
              glareRatio: analysis.glareRatio,
              motion,
              stableProgress: Math.min(
                1,
                stableDuration / AUTO_CAPTURE_STABLE_MS
              ),
            };
            qualityRef.current = nextQuality;
            setQuality(nextQuality);

            if (
              checksPass &&
              stable &&
              stableDuration >= AUTO_CAPTURE_STABLE_MS &&
              !captureLockRef.current
            ) {
              void captureFrame(false);
            }
          } catch {
            autoCapturePausedRef.current = true;
            setCameraError(
              "Automatic image checks are unavailable. You can still capture manually."
            );
            return;
          }
        }
      }
      frameRequestRef.current = requestAnimationFrame(analyzeNextFrame);
    };

    frameRequestRef.current = requestAnimationFrame(analyzeNextFrame);
    return () => {
      active = false;
      if (frameRequestRef.current !== null)
        cancelAnimationFrame(frameRequestRef.current);
    };
  }, [cameraState, capturedFile, captureFrame, stream]);

  const acceptCapture = async () => {
    if (!capturedFile || isAccepting) return;
    setIsAccepting(true);
    try {
      if (await onAccept(capturedFile)) onClose();
    } finally {
      setIsAccepting(false);
    }
  };

  const checksPass =
    quality !== null && Object.values(quality.checks).every(Boolean);
  const canCaptureManually = canCaptureFrame(
    true,
    quality,
    cameraState === "ready",
    isCapturing
  );
  const checkItems = [
    { key: "edgesVisible", label: "All edges visible" },
    { key: "aligned", label: "Aligned in frame" },
    { key: "focused", label: "In focus" },
    { key: "lighting", label: "Good lighting" },
    { key: "glare", label: "Low glare" },
  ] as const;
  const countdownSeconds = quality
    ? Math.max(
        0,
        (AUTO_CAPTURE_STABLE_MS * (1 - quality.stableProgress)) / 1000
      )
    : AUTO_CAPTURE_STABLE_MS / 1000;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#f5f7ef]/95 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          clearStream();
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="id-camera-title"
        className={`relative my-auto w-full overflow-hidden rounded-[22px] shadow-[0_18px_50px_rgba(27,48,31,0.2)] ${
          capturedFile
            ? "max-w-md border border-[#e1e4d8] bg-[#fffefa]"
            : "max-w-md border border-[#3b4738] bg-[#20271e] text-white"
        }`}
      >
        {capturedFile ? (
          <div className="relative overflow-hidden px-5 pb-5 pt-8 text-center sm:px-7 sm:pb-7">
            <BrandMark className="pointer-events-none absolute -bottom-5 -right-4 h-28 w-28 rotate-[20deg] text-[#4d8b55]/10" />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#21814a] to-[#48a160] text-white shadow-[0_6px_18px_rgba(33,129,74,0.25)]">
              <CheckCircle className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <h2
              id="id-camera-title"
              className="mt-3 text-2xl font-bold tracking-tight text-[#17231b]"
            >
              Photo Captured!
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Please review your {sideLabel}.
            </p>
            <div className="mt-5 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl border border-[#e4e6de] bg-[#f3f4ee] p-2">
              <img
                src={capturedPreview}
                alt={`Captured ${sideLabel} preview`}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
            <p className="sr-only" role="status">
              The image will not be uploaded until you accept it and submit
              your registration.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isAccepting}
                onClick={() => {
                  setCapturedFile(null);
                  setCapturedPreview("");
                  void startCamera();
                }}
                className="min-h-11 rounded-xl border-[#c9cec2] bg-white text-[#202920]"
              >
                <RefreshCw className="h-4 w-4" />
                Retake
              </Button>
              <Button
                type="button"
                disabled={isAccepting}
                onClick={() => void acceptCapture()}
                className="min-h-11 rounded-xl bg-[#205b35] text-white hover:bg-[#17472a]"
              >
                {isAccepting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Use Photo
              </Button>
            </div>
            <button
              type="button"
              disabled={isAccepting}
              onClick={() => {
                clearStream();
                onClose();
              }}
              className="relative mt-3 min-h-8 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <header className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <BrandMark className="h-8 w-8 shrink-0 text-[#76bd63]" />
                <h2
                  id="id-camera-title"
                  className="truncate text-sm font-bold tracking-tight text-white sm:text-base"
                >
                  Havestra ID Scanner
                </h2>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#287b3d] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(58,220,108,0.25)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#9cffb1] shadow-[0_0_9px_#8cffaa]" />
                Auto Scan
              </span>
            </header>

            <p className="mb-4 mt-4 text-center text-sm font-semibold text-white sm:text-base">
              {sideLabel.toLowerCase().includes("back")
                ? "Now scan the back side of your ID"
                : isPassport
                  ? "Position your passport page inside the frame"
                  : "Position your ID inside the frame"}
            </p>

            {cameraDevices.length > 1 && (
              <label className="mb-3 flex items-center gap-3 text-xs font-medium text-white/85">
                <span className="shrink-0">Camera</span>
                <select
                  aria-label="Select camera"
                  value={selectedCameraId}
                  onChange={event => {
                    const deviceId = event.currentTarget.value;
                    setSelectedCameraId(deviceId);
                    void startCamera(deviceId);
                  }}
                  className="min-h-9 min-w-0 flex-1 rounded-lg border border-white/20 bg-[#18221a] px-3 text-white outline-none focus:border-[#8bf18e]"
                >
                  {cameraDevices.map((camera, index) => (
                    <option key={camera.deviceId || index} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div
              ref={previewRef}
              className="relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#172019]"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                ref={guideRef}
                aria-hidden="true"
                className="absolute inset-x-[8%] inset-y-[12%] rounded-xl shadow-[0_0_0_999px_rgba(10,24,14,0.34)]"
              >
                {[
                  "left-0 top-0 rounded-tl-xl border-l-[4px] border-t-[4px]",
                  "right-0 top-0 rounded-tr-xl border-r-[4px] border-t-[4px]",
                  "bottom-0 left-0 rounded-bl-xl border-b-[4px] border-l-[4px]",
                  "bottom-0 right-0 rounded-br-xl border-b-[4px] border-r-[4px]",
                ].map(corner => (
                  <span
                    key={corner}
                    className={`absolute h-8 w-8 border-[#13f18d] shadow-[0_0_10px_#13f18d] ${corner}`}
                  />
                ))}
                <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-[#10251a]/80 px-3 py-1 text-[10px] font-semibold text-white">
                  {isPassport ? "Information page" : sideLabel}
                </span>
              </div>
              {cameraState === "starting" && (
                <div
                  role="status"
                  className="absolute inset-0 flex items-center justify-center bg-[#10251a]/55 text-sm font-medium text-white"
                >
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Starting camera…
                </div>
              )}
              {cameraState === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#172019]/90 px-5 text-center">
                  <AlertTriangle className="h-7 w-7 text-[#f4d28a]" />
                  <p className="text-sm font-semibold text-white">
                    Camera unavailable
                  </p>
                  <p className="text-xs leading-5 text-white/75">
                    {cameraError || "Allow camera access or upload an image."}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex min-h-7 items-center justify-center gap-2 text-center text-xs text-white/90 sm:text-sm">
              {checksPass ? (
                <CheckCircle className="h-5 w-5 shrink-0 text-[#78e59b]" />
              ) : (
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-white/40" />
              )}
              <p aria-live="polite">
                {isCapturing
                  ? "Capturing your ID…"
                  : !quality
                    ? "Align the ID inside the frame"
                    : !checksPass
                      ? "Keep all edges visible and adjust focus and lighting"
                      : quality.stableProgress < 1
                        ? `ID detected • Capturing in ${countdownSeconds.toFixed(1)}…`
                        : "ID detected • Capturing now…"}
              </p>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"
              role="progressbar"
              aria-label="Automatic capture stability"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((quality?.stableProgress || 0) * 100)}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#18d678] to-[#8bf18e] transition-[width] duration-200"
                style={{
                  width: `${(quality?.stableProgress || 0) * 100}%`,
                }}
              />
            </div>
            <ul className="sr-only" aria-label="Live image quality checks">
              {checkItems.map(item => (
                <li key={item.key}>
                  {item.label}:{" "}
                  {quality?.checks[item.key] ? "passed" : "not passed"}
                </li>
              ))}
              <li>
                Stable for 1.5 seconds:{" "}
                {quality?.stableProgress === 1 ? "yes" : "no"}
              </li>
            </ul>

            {cameraError && cameraState !== "error" && (
              <p role="alert" className="mt-2 text-center text-xs text-[#ffd4b8]">
                {cameraError}
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cameraState === "error" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startCamera(selectedCameraId || undefined)}
                  className="min-h-10 rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Camera
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={!canCaptureManually}
                  onClick={() => void captureFrame(true)}
                  className="min-h-12 rounded-xl bg-[#e6f4e3] text-sm font-bold text-[#21472e] hover:bg-white"
                >
                  <Camera className="h-4 w-4" />
                  MANUAL CAPTURE
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onUseUpload();
                  clearStream();
                  onClose();
                }}
                className="min-h-10 rounded-xl border-white/30 bg-transparent text-xs font-semibold text-white hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Upload from Device
              </Button>
            </div>
            <button
              type="button"
              onClick={() => {
                clearStream();
                onClose();
              }}
              className="mt-2 min-h-8 w-full text-xs font-medium text-white/60 hover:text-white"
            >
              Cancel scan
            </button>
            <canvas ref={analysisCanvasRef} className="hidden" />
          </div>
        )}
      </section>
    </div>
  );
}
