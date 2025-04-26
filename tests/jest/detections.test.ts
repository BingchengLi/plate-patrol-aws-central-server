import request from "supertest";
import dotenv from "dotenv";
import { after } from "node:test";

// Load environment variables
dotenv.config();

const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://xat4qx9kpj.execute-api.us-east-2.amazonaws.com";
const STAGE = process.env.STAGE || "dev";
const API_URL = `${API_BASE_URL}/${STAGE}`;

const VALID_WATCHLIST_API_KEY =
  process.env.VALID_API_KEY || "RbC1Fostw07gDZQNEhqYz1UEKySIRKwE7mkMf7Hs";
const VALID_DASHCAM_API_KEY =
  process.env.VALID_DASHCAM_API_KEY ||
  "pXceWVib2h1ej16WgIaWs2JQzLk6RXUJ8mGylFFo";
const INVALID_API_KEY = "invalid-api-key";

const TEST_PLATE_NUMBER = "TEST123";
const TEST_REASON = "Testing plate management";
const FAKE_WEBHOOK_URL = "https://fakewebhook.site/test123";
const FAKE_WEBHOOK_URL_2 = "https://fakewebhook.site/test456";

describe("Internal Watchlist Management API Tests", () => {
  afterAll(async () => {
    // Clean up the plate
    await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY);
  });

  it("should add a plate to the watchlist (POST /plates)", async () => {
    const response = await request(API_URL)
      .post("/plates")
      .set("x-api-key", VALID_WATCHLIST_API_KEY)
      .send({
        plate_number: TEST_PLATE_NUMBER,
        reason: TEST_REASON,
        webhook_url: FAKE_WEBHOOK_URL,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toMatch(/created|updated/i);
  });

  it("should get all plates in the watchlist (GET /plates)", async () => {
    const response = await request(API_URL)
      .get("/plates")
      .set("x-api-key", VALID_WATCHLIST_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toContain(TEST_PLATE_NUMBER);
  });

  it("should delete a plate from the watchlist (DELETE /plates/{plate_number})", async () => {
    const response = await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toMatch(/removed|deleted/i);
  });
});

describe("External Webhook Registration API Tests", () => {
  afterAll(async () => {
    // Clean up the plate
    await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY);
  });

  it("should register a webhook (POST /plates/{plate_number}/webhooks)", async () => {
    const response = await request(API_URL)
      .post(`/plates/${TEST_PLATE_NUMBER}/webhooks`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY) // API Key still required
      .send({ webhook_url: FAKE_WEBHOOK_URL });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toMatch(/registered|created/i);

    // Verify the webhook URL is stored
    const getResponse = await request(API_URL)
      .get(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body.plate_number).toBe(TEST_PLATE_NUMBER);
    expect(getResponse.body.webhooks.length).toBe(1);
    expect(getResponse.body.webhooks[0]).toBe(FAKE_WEBHOOK_URL);
  });

  it("should remove a webhook (DELETE /plates/{plate_number}/webhooks)", async () => {
    // First add another webhook so we have two to remove
    await request(API_URL)
      .post(`/plates/${TEST_PLATE_NUMBER}/webhooks`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY)
      .send({ webhook_url: FAKE_WEBHOOK_URL_2 });

    // Now remove one of them
    const response = await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}/webhooks`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY)
      .send({ webhook_url: FAKE_WEBHOOK_URL });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Webhook removed");

    // Verify the webhook URL is removed
    let getResponse = await request(API_URL)
      .get(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY);
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.body.plate_number).toBe(TEST_PLATE_NUMBER);
    expect(getResponse.body.webhooks.length).toBe(1);
    expect(getResponse.body.webhooks[0]).toBe(FAKE_WEBHOOK_URL_2);

    // Now remove the other one
    const response2 = await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}/webhooks`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY)
      .send({ webhook_url: FAKE_WEBHOOK_URL_2 });
    expect(response2.statusCode).toBe(200);
    expect(response2.body.message).toBe("Plate deleted");

    // Verify the webhook URL is removed
    getResponse = await request(API_URL)
      .get(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY);
    console.log(getResponse.body);
    expect(getResponse.statusCode).toBe(404);
  });
});

describe("Authentication/Validation Failures", () => {
  it("should return 403 for invalid API key on internal endpoint", async () => {
    const response = await request(API_URL)
      .get("/plates")
      .set("x-api-key", INVALID_API_KEY);

    expect(response.statusCode).toBe(403);
  });

  it("should return 403 for missing API key on public endpoint", async () => {
    const response = await request(API_URL).post(
      `/plates/${TEST_PLATE_NUMBER}/webhooks`
    );

    expect(response.statusCode).toBe(403);
  });

  it("should return error if webhook_url is not provided on public endpoint", async () => {
    const response = await request(API_URL)
      .post(`/plates/${TEST_PLATE_NUMBER}/webhooks`)
      .set("x-api-key", VALID_WATCHLIST_API_KEY)
      .send({}); // missing webhook_url
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("webhook_url is required");
  });

  it("should fail gracefully when missing plate_number", async () => {
    const response = await request(API_URL)
      .post(`/plates/`) // bad request
      .set("x-api-key", VALID_WATCHLIST_API_KEY)
      .send({});

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });
});
