import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneNumber(phone: any): string {
  if (phone == null) return '';
  let p = String(phone).trim();
  // If it's 9 digits and starts with a valid Vietnamese network prefix (3, 5, 7, 8, 9), it likely lost its leading zero
  if (p.length === 9 && /^[35789]/.test(p)) {
    p = '0' + p;
  }
  return p;
}
