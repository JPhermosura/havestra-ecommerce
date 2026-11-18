export type FulfillmentStatus =
  | "Pending"
  | "In Transit"
  | "Delivered"
  | "Cancelled";

const allowedTransitions: Record<string, readonly FulfillmentStatus[]> = {
  Pending: ["In Transit", "Cancelled"],
  "In Transit": ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

export function isValidFulfillmentTransition(
  current: string,
  next: FulfillmentStatus
) {
  return (
    current === next ||
    allowedTransitions[current]?.includes(next) === true
  );
}

export function normalizeFulfillmentStatus(
  statuses: Array<string | undefined>
): FulfillmentStatus {
  const normalized = statuses
    .filter((status): status is string => Boolean(status))
    .map(status => status.toLowerCase());

  if (normalized.some(status => status.includes("cancel"))) return "Cancelled";
  if (normalized.some(status => status.includes("deliver"))) return "Delivered";
  if (
    normalized.some(
      status =>
        status.includes("transit") ||
        status.includes("ship") ||
        status.includes("out for")
    )
  ) {
    return "In Transit";
  }
  return "Pending";
}
