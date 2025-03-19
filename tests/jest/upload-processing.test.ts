import request from "supertest";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// Load environment variables
dotenv.config();

const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://xat4qx9kpj.execute-api.us-east-2.amazonaws.com";
const STAGE = process.env.STAGE || "dev";
const API_URL = `${API_BASE_URL}/${STAGE}`;

const VALID_API_KEY =
  process.env.VALID_API_KEY || "RbC1Fostw07gDZQNEhqYz1UEKySIRKwE7mkMf7Hs";
const TEST_PLATE_NUMBER = "TEST123";
const TEST_REASON = "Testing upload pipeline";
const TEST_IMAGE_PATH = path.join(__dirname, "../test-image.jpg");

const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.MATCH_LOG_TABLE || "match-log-dev";

// ============== Upload Processing Integration Test ==============
describe("/upload-processing integration test", () => {
  let uploadUrl: string;
  let fileKey: string;

  beforeAll(async () => {
    console.log("Adding test plate to watchlist...");

    const response = await request(API_URL)
      .post("/plates")
      .set("x-api-key", VALID_API_KEY)
      .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

    expect(response.statusCode).toBe(200);
  });

  afterAll(async () => {
    const response = await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Plate removed from watchlist" });
  });

  it("should retrieve a pre-signed upload URL", async () => {
    const response = await request(API_URL).get(
      `/detections/${TEST_PLATE_NUMBER}`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("match", true);
    expect(response.body).toHaveProperty("upload_url");
    expect(response.body).toHaveProperty("file_key");

    uploadUrl = response.body.upload_url;
    fileKey = response.body.file_key;
  });

  it("should upload an image using the pre-signed URL", async () => {
    const imageData = fs.readFileSync(TEST_IMAGE_PATH);
    console.log(`Uploading image to ${uploadUrl}`);
    const response = await request(uploadUrl)
      .put("/")
      .set("Content-Type", "image/jpeg")
      .send(imageData);

    expect(response.statusCode).toBe(200);
  });

  it("should verify that the match is logged in DynamoDB", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for event processing

    const { Item } = await dynamoDB.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { match_id: fileKey },
      })
    );

    expect(Item).toBeDefined();
    if (Item) {
      expect(Item.file_path).toBe(fileKey);
    }
  }, 10000);
});
