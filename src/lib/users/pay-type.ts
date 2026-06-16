import type { PayType, User } from "@/types/flow";

export function normalizePayType(value: unknown, role?: User["role"]): PayType {
  if (value === "hourly" || value === "salary") return value;
  if (role === "employee") return "hourly";
  return "salary";
}

/** Hourly field staff must use the shift clock. */
export function requiresShiftClock(user: Pick<User, "role" | "pay_type">): boolean {
  if (user.role !== "employee") return false;
  return normalizePayType(user.pay_type, user.role) === "hourly";
}

export function isHourlyEmployee(user: Pick<User, "role" | "pay_type">): boolean {
  return user.role === "employee" && normalizePayType(user.pay_type, user.role) === "hourly";
}

export function isSalaryEmployee(user: Pick<User, "role" | "pay_type">): boolean {
  return user.role === "employee" && normalizePayType(user.pay_type, user.role) === "salary";
}

export function payTypeLabel(payType: PayType | null | undefined): string {
  if (payType === "salary") return "Salary";
  return "Hourly";
}
