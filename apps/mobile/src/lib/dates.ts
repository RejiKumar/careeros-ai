function pad(number: number): string {
  return String(number).padStart(2, "0");
}

function isValidDate(month: number, day: number, year: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

export function toISODate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const mdy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy !== null) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    if (!isValidDate(month, day, year)) {
      return null;
    }
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso !== null) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidDate(month, day, year)) {
      return null;
    }
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match === null) {
    return value;
  }
  return `${match[2]}/${match[3]}/${match[1]}`;
}