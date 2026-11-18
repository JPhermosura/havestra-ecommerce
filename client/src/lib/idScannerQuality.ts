export type EdgeContinuity = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type IdFrameAnalysis = {
  luminance: Uint8Array;
  brightness: number;
  blurScore: number;
  glareRatio: number;
  darkRatio: number;
  edgeContinuity: EdgeContinuity;
  checks: {
    edgesVisible: boolean;
    aligned: boolean;
    focused: boolean;
    lighting: boolean;
    glare: boolean;
  };
};

const EDGE_CONTRAST_THRESHOLD = 22;
const EDGE_VISIBLE_THRESHOLD = 0.55;
const EDGE_ALIGNMENT_THRESHOLD = 0.72;
const MIN_BLUR_SCORE = 38;

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function measureEdgeContinuity(
  luminance: Uint8Array,
  width: number,
  height: number
): EdgeContinuity {
  const horizontalSamples: number[] = [];
  const verticalSamples: number[] = [];
  const horizontalInset = Math.max(1, Math.round(width * 0.025));
  const horizontalInner = Math.max(horizontalInset + 1, Math.round(width * 0.1));
  const verticalInset = Math.max(1, Math.round(height * 0.025));
  const verticalInner = Math.max(verticalInset + 1, Math.round(height * 0.1));
  const sampleCount = 24;
  const hasContrast = (first: number, second: number) =>
    Math.abs(first - second) >= EDGE_CONTRAST_THRESHOLD ? 1 : 0;

  for (let sample = 2; sample < sampleCount - 2; sample += 1) {
    const ratio = sample / (sampleCount - 1);
    const y = Math.round(ratio * (height - 1));
    const x = Math.round(ratio * (width - 1));
    horizontalSamples.push(
      hasContrast(
        luminance[y * width + horizontalInset],
        luminance[y * width + horizontalInner]
      ),
      hasContrast(
        luminance[y * width + width - 1 - horizontalInset],
        luminance[y * width + width - 1 - horizontalInner]
      )
    );
    verticalSamples.push(
      hasContrast(
        luminance[verticalInset * width + x],
        luminance[verticalInner * width + x]
      ),
      hasContrast(
        luminance[(height - 1 - verticalInset) * width + x],
        luminance[(height - 1 - verticalInner) * width + x]
      )
    );
  }

  return {
    left: average(horizontalSamples.filter((_, index) => index % 2 === 0)),
    right: average(horizontalSamples.filter((_, index) => index % 2 === 1)),
    top: average(verticalSamples.filter((_, index) => index % 2 === 0)),
    bottom: average(verticalSamples.filter((_, index) => index % 2 === 1)),
  };
}

function measureBlur(luminance: Uint8Array, width: number, height: number) {
  let laplacianTotal = 0;
  let laplacianSquaredTotal = 0;
  let sampleCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const laplacian =
        4 * luminance[index] -
        luminance[index - 1] -
        luminance[index + 1] -
        luminance[index - width] -
        luminance[index + width];
      laplacianTotal += laplacian;
      laplacianSquaredTotal += laplacian * laplacian;
      sampleCount += 1;
    }
  }
  if (!sampleCount) return 0;
  const mean = laplacianTotal / sampleCount;
  return Math.max(0, laplacianSquaredTotal / sampleCount - mean * mean);
}

export function analyzeIdFrame(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): IdFrameAnalysis {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 24 ||
    height < 24 ||
    rgba.length !== width * height * 4
  ) {
    throw new RangeError("The camera analysis frame has invalid dimensions.");
  }

  const luminance = new Uint8Array(width * height);
  let brightnessTotal = 0;
  let darkPixels = 0;
  let glarePixels = 0;

  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
    const light = Math.round(
      0.299 * rgba[source] + 0.587 * rgba[source + 1] + 0.114 * rgba[source + 2]
    );
    luminance[target] = light;
    brightnessTotal += light;
    if (light < 45) darkPixels += 1;
    if (light >= 250) glarePixels += 1;
  }

  const brightness = brightnessTotal / luminance.length;
  const darkRatio = darkPixels / luminance.length;
  const glareRatio = glarePixels / luminance.length;
  const blurScore = measureBlur(luminance, width, height);
  const edgeContinuity = measureEdgeContinuity(luminance, width, height);
  const edgeScores = Object.values(edgeContinuity);

  return {
    luminance,
    brightness,
    blurScore,
    glareRatio,
    darkRatio,
    edgeContinuity,
    checks: {
      edgesVisible: edgeScores.every(score => score >= EDGE_VISIBLE_THRESHOLD),
      aligned: edgeScores.every(score => score >= EDGE_ALIGNMENT_THRESHOLD),
      focused: blurScore >= MIN_BLUR_SCORE,
      lighting: brightness >= 65 && brightness <= 235 && darkRatio <= 0.35,
      glare: glareRatio <= 0.18,
    },
  };
}

export function measureFrameMotion(
  current: Uint8Array,
  previous: Uint8Array
): number {
  if (current.length !== previous.length || current.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let differenceTotal = 0;
  let sampleCount = 0;
  for (let index = 0; index < current.length; index += 4) {
    differenceTotal += Math.abs(current[index] - previous[index]);
    sampleCount += 1;
  }
  return differenceTotal / sampleCount;
}
