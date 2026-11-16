export type IdVerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "pending_review"
  | "rejected";

export type VerificationStateUpdate = {
  status: IdVerificationStatus;
  isVerified: boolean;
  retryAllowed: boolean;
  verifiedAt: Date | undefined;
};

export function mapSumsubReviewState(
  reviewStatus: string,
  reviewAnswer: string,
  rejectType: string
): VerificationStateUpdate | null {
  if (reviewStatus === "completed" && reviewAnswer === "GREEN") {
    return { status: "verified", isVerified: true, retryAllowed: false, verifiedAt: new Date() };
  }
  if (reviewStatus === "completed" && reviewAnswer === "RED") {
    return {
      status: "rejected",
      isVerified: false,
      retryAllowed: rejectType === "RETRY",
      verifiedAt: undefined,
    };
  }
  if (["init", "pending", "queued", "prechecked", "awaitingService"].includes(reviewStatus)) {
    return { status: "pending", isVerified: false, retryAllowed: false, verifiedAt: undefined };
  }
  if (reviewStatus === "onHold") {
    return { status: "pending_review", isVerified: false, retryAllowed: false, verifiedAt: undefined };
  }
  return null;
}

export function canResubmitIdDocuments(status: string, retryAllowed: boolean) {
  return retryAllowed && (status === "rejected" || status === "pending_review");
}

export function isFreshProviderEvent(incoming: Date, previous?: Date | null) {
  return Number.isFinite(incoming.getTime()) && (!previous || incoming.getTime() > previous.getTime());
}

const userEditableProfileFields = ["name", "email", "phone", "address", "city", "country", "zipCode"] as const;

export function pickUserEditableProfileFields(body: Record<string, unknown>) {
  const update: Record<string, unknown> = {};
  for (const field of userEditableProfileFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  return update;
}