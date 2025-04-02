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

// Temporarily skip detection tests in CI
// Passing locally but failing in GitHub Actions
describe("/detections integration tests", () => {
  beforeAll(async () => {
    // Ensure the test plate is added to the watchlist before running detection tests
    console.log("Adding test plate to watchlist...");
    const response = await request(API_URL)
      .post("/plates")
      .set("x-api-key", VALID_API_KEY)
      .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

    expect(response.statusCode).toBe(200);
    console.log("Test plate added.");
  });

  afterAll(async () => {
    // Clean up test plate from the watchlist
    console.log("Removing test plate from watchlist...");
    const response = await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Plate removed from watchlist" });
    console.log("Test plate deleted.");
  });

  // ============== Test Plate Detection ==============
  it("should return match: true for a plate in the watchlist", async () => {
    const response = await request(API_URL).get(
      `/detections/${TEST_PLATE_NUMBER}`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("match", true);
    expect(response.body).toHaveProperty("image_id");
  });

  it("should return match: false for a plate not in the watchlist", async () => {
    const response = await request(API_URL).get(`/detections/NOT_IN_LIST`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ match: false });
  });

  // ============== Test Missing Plate Number ==============
  it("should return error when missing plate_number", async () => {
    const response = await request(API_URL).get(`/detections/`);

    expect(response.statusCode).toBe(403); // 403 Forbidden
  });
});
