import { describe, expect, it } from "vitest";
import { resolveMongoUri } from "../utils/databaseConfig.js";

describe("database configuration", () => {
  it("uses the local default only outside production", () => {
    expect(resolveMongoUri({ NODE_ENV: "development" })).toBe(
      "mongodb://127.0.0.1:27017/havestra"
    );
    expect(
      resolveMongoUri({
        NODE_ENV: "development",
        MONGO_URI: "mongodb://db.example/havestra",
      })
    ).toBe("mongodb://db.example/havestra");
  });

  it("requires a remote MONGODB_URI in production", () => {
    expect(() => resolveMongoUri({ NODE_ENV: "production" })).toThrow(
      "MONGODB_URI must be configured in production."
    );
    expect(() =>
      resolveMongoUri({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://localhost:27017/havestra",
      })
    ).toThrow("Production MONGODB_URI must point to a remote database.");
    expect(() =>
      resolveMongoUri({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb://[::1]:27017/havestra",
      })
    ).toThrow("Production MONGODB_URI must point to a remote database.");
    expect(
      resolveMongoUri({
        NODE_ENV: "production",
        MONGODB_URI: "mongodb+srv://cluster.example/havestra",
      })
    ).toBe("mongodb+srv://cluster.example/havestra");
  });
});
