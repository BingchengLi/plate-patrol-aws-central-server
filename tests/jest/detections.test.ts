import request from "supertest";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const STAGE = process.env.STAGE || "dev";
const API_URL = `${API_BASE_URL}/${STAGE}`;
console.log("API_URL: ", API_URL);

const VALID_API_KEY = process.env.VALID_API_KEY || "";
console.log("VALID_API_KEY: ", VALID_API_KEY);
const INVALID_API_KEY = "invalid-api-key";
const TEST_PLATE_NUMBER = "ABC123";
const TEST_REASON = "Suspicious vehicle";

describe("/detections integration tests", () => {
  beforeAll(async () => {
    // Ensure the test plate is added to the watchlist before running detection tests
    console.log("Adding test plate to watchlist...");
    const response = await request(API_URL)
      .put("/plates")
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

  // ============== Test Unauthorized Requests ==============
  it("should return 403 for missing API key", async () => {
    const response = await request(API_URL).get(`/detections/${TEST_PLATE_NUMBER}`);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "Unauthorized: Invalid API Key" });
  });

  it("should return 403 for invalid API key", async () => {
    const response = await request(API_URL)
      .get(`/detections/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", INVALID_API_KEY);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "Unauthorized: Invalid API Key" });
  });

  // ============== Test Plate Detection ==============
  it("should detect a plate in the watchlist", async () => {
    const response = await request(API_URL)
      .get(`/detections/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("match", true);
    expect(response.body).toHaveProperty("upload_url");
    expect(response.body).toHaveProperty("file_key");
  });

  it("should return match: false for a plate not in the watchlist", async () => {
    const response = await request(API_URL)
      .get(`/detections/NOT_IN_LIST`)
      .set("x-api-key", VALID_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ match: false });
  });

  // ============== Test Missing Plate Number ==============
  it("should return 400 when missing plate_number", async () => {
    const response = await request(API_URL)
      .get(`/detections/`) // Incorrectly formatted request
      .set("x-api-key", VALID_API_KEY);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "plate_number is required" });
  });
});
