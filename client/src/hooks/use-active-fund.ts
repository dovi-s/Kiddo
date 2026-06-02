import { safeLocalSet } from "@/lib/local-cache";
const STORAGE_KEY = "kiddo_active_fund_id";
export const ACTIVE_FUND_CHANGE_EVENT = "kiddo:active-fund-change";
export const ADD_FUND_EVENT = "kiddo:add-fund";

export function getActiveFundId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setActiveFundId(id: string): void {
  try {
    if (id) {
      safeLocalSet(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(ACTIVE_FUND_CHANGE_EVENT, { detail: { id } }));
  } catch {}
}
