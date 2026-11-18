import { describe, expect, it } from "vitest";
import { analyzeIdFrame, measureFrameMotion } from "./idScannerQuality";

const width = 160;
const height = 100;

function createClearFrame() {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const insideCard = x >= 8 && x < 152 && y >= 7 && y < 93;
      const hasText = insideCard && y % 9 >= 4 && y % 9 <= 5 && x > 24 && x < 138;
      const shade = hasText ? 35 : insideCard ? 184 : 80;
      const index = (y * width + x) * 4;
      rgba[index] = shade;
      rgba[index + 1] = shade;
      rgba[index + 2] = shade;
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}

describe("ID camera frame quality checks", () => {
  it("accepts a clear, aligned, well-lit document frame", () => {
    const analysis = analyzeIdFrame(createClearFrame(), width, height);

    expect(analysis.checks).toEqual({
      edgesVisible: true,
      aligned: true,
      focused: true,
      lighting: true,
      glare: true,
    });
  });

  it("flags a frame without visible card edges as not aligned", () => {
    const rgba = createClearFrame();
    rgba.fill(160);
    const analysis = analyzeIdFrame(rgba, width, height);

    expect(analysis.checks.edgesVisible).toBe(false);
    expect(analysis.checks.aligned).toBe(false);
    expect(analysis.checks.focused).toBe(false);
  });

  it("rejects low light and strong clipped highlights", () => {
    const dimFrame = createClearFrame();
    dimFrame.fill(30);
    expect(analyzeIdFrame(dimFrame, width, height).checks.lighting).toBe(false);

    const glareFrame = createClearFrame();
    for (let pixel = 0; pixel < (width * height) / 3; pixel += 1) {
      const index = pixel * 4;
      glareFrame[index] = 255;
      glareFrame[index + 1] = 255;
      glareFrame[index + 2] = 255;
    }
    expect(analyzeIdFrame(glareFrame, width, height).checks.glare).toBe(false);
  });

  it("measures camera-frame movement between downscaled samples", () => {
    const first = new Uint8Array(64).fill(100);
    const still = new Uint8Array(64).fill(103);
    const moved = new Uint8Array(64).fill(140);

    expect(measureFrameMotion(still, first)).toBe(3);
    expect(measureFrameMotion(moved, first)).toBe(40);
    expect(measureFrameMotion(new Uint8Array(0), new Uint8Array(0))).toBe(
      Number.POSITIVE_INFINITY
    );
  });
});
