// Generates a human-friendly, sortable order number like LMD-20260819-4F2C
export function generateOrderNumber(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `LMD-${yyyy}${mm}${dd}-${rand}`;
}
