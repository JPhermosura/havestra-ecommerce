const localMongoUri = "mongodb://127.0.0.1:27017/havestra";

function isLocalMongoHost(uri: string) {
  let hostname: string;
  try {
    hostname = new URL(uri).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    throw new Error("MONGODB_URI must be a valid MongoDB connection string.");
  }

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "localhost.localdomain" ||
    hostname === "::1" ||
    /^127\./.test(hostname)
  );
}

export function resolveMongoUri(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.NODE_ENV === "production") {
    const mongoUri = environment.MONGODB_URI?.trim();
    if (!mongoUri) {
      throw new Error("MONGODB_URI must be configured in production.");
    }
    if (isLocalMongoHost(mongoUri)) {
      throw new Error(
        "Production MONGODB_URI must point to a remote database."
      );
    }
    return mongoUri;
  }

  return (
    environment.MONGODB_URI?.trim() ||
    environment.MONGO_URI?.trim() ||
    localMongoUri
  );
}
