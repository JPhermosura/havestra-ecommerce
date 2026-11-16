import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const placeholderImage =
  "https://via.placeholder.com/300x300.png?text=No+Image+Available";

export function normalizeImageUrl(src?: string) {
  const rawSrc = String(src || "")
    .trim()
    .replace(/\\/g, "/");
  if (
    !rawSrc ||
    rawSrc.toLowerCase() === "null" ||
    rawSrc.toLowerCase() === "undefined"
  ) {
    return placeholderImage;
  }

  if (
    rawSrc.startsWith("http://") ||
    rawSrc.startsWith("https://") ||
    rawSrc.startsWith("data:")
  ) {
    return rawSrc;
  }

  if (rawSrc.startsWith("//")) {
    return `https:${rawSrc}`;
  }

  if (rawSrc.startsWith("/img/") || rawSrc.startsWith("img/")) {
    return rawSrc.startsWith("/") ? rawSrc : `/${rawSrc}`;
  }

  if (typeof window !== "undefined") {
    if (rawSrc.startsWith("/")) {
      return `${window.location.origin}${rawSrc}`;
    }
    return `${window.location.origin}/${rawSrc}`;
  }

  return placeholderImage;
}

export function resolveProductImageUrl(src?: string, title?: string) {
  return normalizeImageUrl(src);
}
