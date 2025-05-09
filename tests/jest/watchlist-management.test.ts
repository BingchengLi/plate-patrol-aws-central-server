import request from "supertest";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://xat4qx9kpj.execute-api.us-east-2.amazonaws.com";
const STAGE = process.env.STAGE || "dev";
const API_URL = `${API_BASE_URL}/${STAGE}`;

const VALID_API_KEY =
  process.env.VALID_API_KEY || "RbC1Fostw07gDZQNEhqYz1UEKySIRKwE7mkMf7Hs";
const INVALID_API_KEY = "invalid-api-key";
const TEST_PLATE_NUMBER = "ABC123";
const TEST_REASON = "Suspicious vehicle";

describe("/plates integration tests", () => {
  afterAll(async () => {
    // Clean up the test plate from the watchlist
    const response = await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_API_KEY);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Plate removed from watchlist" });
    console.log("Test plate deleted from the watchlist");
  });

  // ============== Test Unauthorized Requests ==============
  it("should return 403 for missing API key", async () => {
    const response = await request(API_URL)
      .post("/plates")
      .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("should return 403 for invalid API key", async () => {
    const response = await request(API_URL)
      .post("/plates")
      .set("x-api-key", INVALID_API_KEY)
      .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  // ============== Test Adding to Watchlist ==============
  describe("Add plate to watchlist", () => {
    it("should successfully add a plate to the watchlist", async () => {
      const response = await request(API_URL)
        .post("/plates")
        .set("x-api-key", VALID_API_KEY)
        .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Plate added to watchlist"
      );
    });

    // ============== Test Duplicate Plate Addition ==============
    it("should return an error when adding a duplicate plate", async () => {
      const response = await request(API_URL)
        .post("/plates")
        .set("x-api-key", VALID_API_KEY)
        .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty(
        "message",
        "Plate already exists, skipping insert."
      );
    });
  });

  // ============== Test Retrieving Watchlist ==============
  it("should retrieve the list of plates in the watchlist", async () => {
    const response = await request(API_URL)
      .get("/plates")
      .set("x-api-key", VALID_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ plate_number: TEST_PLATE_NUMBER }),
      ])
    );
  });

  // ============== Test Adding Without Required Fields ==============
  it("should return 400 when missing plate_number", async () => {
    const response = await request(API_URL)
      .post("/plates")
      .set("x-api-key", VALID_API_KEY)
      .send({ reason: TEST_REASON });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "Missing required fields: plate_number, reason",
    });
  });

  // ============== Test Adding Without Reason ==============
  it("should return 400 when missing reason", async () => {
    const response = await request(API_URL)
      .post("/plates")
      .set("x-api-key", VALID_API_KEY)
      .send({ plate_number: TEST_PLATE_NUMBER });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "Missing required fields: plate_number, reason",
    });
  });
});
