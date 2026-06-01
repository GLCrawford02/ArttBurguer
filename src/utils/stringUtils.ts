export const normalizeString = (str: string | undefined | null) => {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};
