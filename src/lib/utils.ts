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
