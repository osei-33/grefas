import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeGetLocalStorage(key: string, defaultValue = ""): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key) || defaultValue;
    }
  } catch (e) {
    console.warn(`Local storage read error for key ${key}:`, e);
  }
  return defaultValue;
}

export function safeSetLocalStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`Local storage write error for key ${key}:`, e);
  }
}

export function safeGetSessionStorage(key: string, defaultValue = ""): string {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(key) || defaultValue;
    }
  } catch (e) {
    console.warn(`Session storage read error for key ${key}:`, e);
  }
  return defaultValue;
}

export function safeSetSessionStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`Session storage write error for key ${key}:`, e);
  }
}

/**
 * Triggers a browser native desktop notification if permission is granted.
 * Requests permission if it hasn't been requested or decided yet.
 */
export function showBrowserNotification(title: string, body: string, icon = "/favicon.ico"): void {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  const trigger = () => {
    try {
      new Notification(title, {
        body,
        icon,
        tag: "grefas-notification",
      });
    } catch (e) {
      console.warn("Error displaying system notification:", e);
    }
  };

  if (Notification.permission === "granted") {
    trigger();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        trigger();
      }
    });
  }
}

/**
 * Highly optimized, intelligent client-side image compression.
 * Scales down large images to a maximum dimension while maintaining aspect ratio,
 * and recompresses to JPEG/PNG at optimal levels.
 * Falls back to the original file in case of any failures or unsupported formats.
 */
export function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<Blob | File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Scale while preserving aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          // Use white background for transparent images when converting to JPEG
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Render with preferred format (use JPEG for massive savings, or PNG if original was png/gif)
          const targetFormat = file.type === "image/png" || file.type === "image/gif" ? "image/png" : "image/jpeg";

          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                resolve(blob);
              } else {
                resolve(file); // Keep original if compression resulted in a larger file
              }
            },
            targetFormat,
            targetFormat === "image/jpeg" ? quality : undefined
          );
        } catch (e) {
          console.warn("Client-side image compression failed, uploading original:", e);
          resolve(file);
        }
      };
      
      img.onerror = () => {
        // If the browser cannot load the image object (e.g. HEIC or raw), resolve original
        resolve(file);
      };

      if (event.target?.result) {
        img.src = event.target.result as string;
      } else {
        resolve(file);
      }
    };

    reader.onerror = () => {
      resolve(file);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Utility to convert a Blob or File to a Base64 data URL.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        resolve('');
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


