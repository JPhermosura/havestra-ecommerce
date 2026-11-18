import cors from "cors";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createCorsOptions, resolveServerHost } from "../utils/networkConfig.js";

describe("server network configuration", () => {
  it("binds development to loopback and keeps production container binding", () => {
    expect(resolveServerHost({ NODE_ENV: "development" })).toBe("127.0.0.1");
    expect(resolveServerHost({ NODE_ENV: "production" })).toBe("0.0.0.0");
    expect(
      resolveServerHost({ NODE_ENV: "development", HOST: "10.0.0.12" })
    ).toBe("10.0.0.12");
  });

  it("allows only explicitly configured CORS origins", async () => {
    const app = express();
    app.use(
      cors(
        createCorsOptions({
          CORS_ORIGINS: " https://shop.example,https://admin.example ",
        })
      )
    );
    app.get("/health", (_req, res) => res.json({ status: "ok" }));

    const allowed = await request(app)
      .get("/health")
      .set("Origin", "https://shop.example");
    const rejected = await request(app)
      .get("/health")
      .set("Origin", "https://unlisted.example");
    const serverRequest = await request(app).get("/health");

    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://shop.example"
    );
    expect(rejected.status).toBe(200);
    expect(rejected.headers["access-control-allow-origin"]).toBeUndefined();
    expect(serverRequest.status).toBe(200);
    expect(
      serverRequest.headers["access-control-allow-origin"]
    ).toBeUndefined();
  });
});
