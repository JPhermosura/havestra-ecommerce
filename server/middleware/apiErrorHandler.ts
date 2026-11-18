import type { ErrorRequestHandler } from "express";

type RequestError = {
  status?: number;
  type?: string;
};

const apiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestError = error as RequestError;
  if (
    requestError?.type === "entity.parse.failed" ||
    requestError?.status === 400
  ) {
    return res.status(400).json({ error: "Malformed request body." });
  }
  if (
    requestError?.type === "entity.too.large" ||
    requestError?.status === 413
  ) {
    return res.status(413).json({ error: "Request body is too large." });
  }

  console.error("[HTTP] Unhandled request error", {
    errorName: error instanceof Error ? error.name : "Error",
  });
  return res.status(500).json({ error: "Internal server error." });
};

export default apiErrorHandler;
