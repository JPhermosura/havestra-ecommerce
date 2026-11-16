export const MAX_ID_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateIdImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("Choose a JPEG, PNG, or WebP ID photo."));
      return;
    }
    if (file.size > MAX_ID_IMAGE_BYTES) {
      reject(new Error("Each ID photo must be 5 MB or smaller."));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error("Could not read that ID photo. Choose a clear image."));
    };
    image.onload = () => {
      if (Math.min(image.width, image.height) < 180 || Math.max(image.width, image.height) < 320) {
        URL.revokeObjectURL(previewUrl);
        reject(new Error("The ID photo is too small. Retake it with the full ID in focus."));
        return;
      }
      resolve(previewUrl);
    };
    image.src = previewUrl;
  });
}