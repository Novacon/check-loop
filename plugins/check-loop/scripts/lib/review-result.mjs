// Transport completion is not a review verdict. Preserve the raw response for
// adjudication, but never classify a failed or empty run as a usable review.
function describeError(error) {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error.message === "string") return error.message;
  return JSON.stringify(error);
}

export function buildReviewResult(result, response) {
  const text = typeof response === "string" ? response : "";
  let error = describeError(result.error) || describeError(result.turn?.error);

  if (!error && result.status !== 0) {
    error = result.stderr?.trim() || "Codex did not complete the review.";
  }
  if (!error && response != null && typeof response !== "string") {
    error = "Codex returned malformed review text.";
  }
  if (!error && !text.trim()) {
    error = "Codex returned no review text. This is an incomplete review, not approval.";
  }

  return {
    threadId: result.threadId ?? null,
    response: text,
    model: result.model ?? null,
    effort: result.effort ?? null,
    status: error ? 1 : 0,
    error,
  };
}
