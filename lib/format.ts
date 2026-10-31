const KST_TIME_ZONE = "Asia/Seoul";
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getDateParts(value: Date | string | number): DateParts {
  if (typeof value === "string") {
    const match = DATE_ONLY_PATTERN.exec(value);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("유효한 날짜를 입력해 주세요.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function toUtcDay(parts: DateParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function formatDate(value: Date | string | number) {
  const { year, month, day } = getDateParts(value);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}.`;
}

export function formatDateTime(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("유효한 일시를 입력해 주세요.");
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}.${values.month}.${values.day}. ${values.hour}:${values.minute}`;
}

export function formatWon(value: bigint | number) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new RangeError("금액은 안전한 정수 범위로 입력해 주세요.");
  }

  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value)}원`;
}

export function dDay(
  target: Date | string | number,
  today: Date | string | number = new Date(),
) {
  const difference = Math.round(
    (toUtcDay(getDateParts(target)) - toUtcDay(getDateParts(today))) /
      (24 * 60 * 60 * 1000),
  );

  if (difference === 0) {
    return "D-day";
  }

  return difference > 0 ? `D-${difference}` : `D+${Math.abs(difference)}`;
}
