"use client";
const KEY = "osce.coachName";

export function loadCoachName(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveCoachName(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* private mode: name just isn't remembered */
  }
}
