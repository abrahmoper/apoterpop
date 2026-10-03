/**
 * Booking arithmetic.
 *
 * Kept free of any database or Cloudflare import so the booking card can run
 * the same numbers on the client as the server action does on the way in. If
 * these two ever disagree, the guest sees one price and pays another.
 */
import { monthsBetween, nightsBetween } from "./utils";
import type { RentalType } from "./types";

/** Kiray's cut, charged to the guest and shown as a separate line. */
export const SERVICE_FEE_RATE = 0.05;

export interface Quote {
  rentalType: RentalType;
  /** Months for a lease, nights for a stay. */
  units: number;
  unitPrice: number;
  subtotal: number;
  serviceFee: number;
  deposit: number;
  total: number;
  /** Due before moving in — the number that actually surprises people. */
  dueNow: number;
  currency: string;
  valid: boolean;
  /** A message key, when the dates do not work. */
  problem: "dates" | "min_stay" | null;
}

export interface QuoteInput {
  rentalType: RentalType;
  price: number;
  currency?: string;
  depositMonths?: number;
  minStayMonths?: number;
  minNights?: number;
  from: string;
  to: string;
}

export function unitsBetween(rentalType: RentalType, from: string, to: string): number {
  return rentalType === "monthly" ? monthsBetween(from, to) : nightsBetween(from, to);
}

export function quote(input: QuoteInput): Quote {
  const currency = input.currency ?? "ETB";
  const monthly = input.rentalType === "monthly";
  const units = unitsBetween(input.rentalType, input.from, input.to);

  const empty: Quote = {
    rentalType: input.rentalType,
    units: 0,
    unitPrice: input.price,
    subtotal: 0,
    serviceFee: 0,
    deposit: 0,
    total: 0,
    dueNow: 0,
    currency,
    valid: false,
    problem: "dates",
  };

  if (!input.from || !input.to || units <= 0) return empty;

  const minimum = monthly ? (input.minStayMonths ?? 1) : (input.minNights ?? 1);
  if (units < minimum) return { ...empty, units, problem: "min_stay" };

  const subtotal = round(input.price * units);
  const serviceFee = round(subtotal * SERVICE_FEE_RATE);
  // Deposits are a monthly-lease convention in Ethiopia; nightly stays have none.
  const deposit = monthly ? round(input.price * (input.depositMonths ?? 0)) : 0;
  const total = round(subtotal + serviceFee + deposit);

  return {
    rentalType: input.rentalType,
    units,
    unitPrice: input.price,
    subtotal,
    serviceFee,
    deposit,
    total,
    // A lease is paid month by month, so only the first month, the fee and the
    // deposit are due up front. A nightly stay is paid in full.
    dueNow: monthly ? round(input.price + serviceFee + deposit) : total,
    currency,
    valid: true,
    problem: null,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
