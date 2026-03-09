// src/utils/helpers.js
export function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.opacity = 1;
  setTimeout(() => (toast.style.opacity = 0), 2000);
}