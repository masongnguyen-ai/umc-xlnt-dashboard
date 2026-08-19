const KEY = "umc_theme";

export function getTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "light";
  const cur = document.documentElement.getAttribute("data-theme");
  if (cur === "light" || cur === "dark") return cur;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  return "light";
}

export function applyTheme(theme: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
  return getTheme();
}
