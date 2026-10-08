export const THEMES = [
  { id: "teal", name: "Midnight Teal", colors: ["#0f1a1f", "#4fd1d9", "#3ddc97"] },
  { id: "sunset", name: "Sunset", colors: ["#1f1410", "#ff8a4c", "#ffcf5c"] },
  { id: "forest", name: "Forest", colors: ["#0e1a12", "#6ee38f", "#c4e86b"] },
  { id: "rose", name: "Rose", colors: ["#1e1116", "#ff6b9a", "#ffb26b"] },
  { id: "ocean", name: "Deep Ocean", colors: ["#0b1324", "#5aa9ff", "#5ce1e6"] },
  { id: "light", name: "Daylight", colors: ["#f6f8f9", "#0f8f9a", "#18a36b"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
const KEY = "vc-theme";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "teal";
  return (localStorage.getItem(KEY) as ThemeId) || "teal";
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = id;
  localStorage.setItem(KEY, id);
}
