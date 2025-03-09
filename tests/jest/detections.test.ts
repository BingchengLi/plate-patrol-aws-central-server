// Adapted from: https://jestjs.io/docs/dynamodb

import request from "supertest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Define API Gateway URL
const API_URL: string =
  process.env.API_URL ||
  "https://xat4qx9kpj.execute-api.us-east-2.amazonaws.com/dev";

// Configure AWS DynamoDB
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-2",
});
const dynamoDB = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME: string = process.env.TABLE_NAME || "global_watchlist_dev";

// Define test plate number
const TEST_PLATE = "XYZ123";

describe("Watchlist Query Layer API", () => {
  beforeAll(async () => {
    console.log(`Setting up test plate: ${TEST_PLATE}`);

    const putParams = {
      TableName: TABLE_NAME,
      Item: {
        plate_number: TEST_PLATE,
        tracking_info: {
          "officer-1": { reason: "stolen" },
        },
      },
    };

    await dynamoDB.send(new PutCommand(putParams));
  });

  afterAll(async () => {
    console.log(`Cleaning up test plate: ${TEST_PLATE}`);

    const deleteParams = {
      TableName: TABLE_NAME,
      Key: { plate_number: TEST_PLATE },
    };

    await dynamoDB.send(new DeleteCommand(deleteParams));
  });

  // Test 1: Check if plate is in watchlist
  test("Should detect a plate in the watchlist", async () => {
    const response = await request(API_URL)
      .get(`/detections/${TEST_PLATE}`)
      .expect(200);

    expect(response.body.match).toBe(true);
    expect(response.body.tracking_info).toHaveProperty("officer-1");
    expect(response.body.tracking_info["officer-1"].reason).toBe("stolen");
  });

  // Test 2: Check if an unknown plate is NOT in watchlist
  test("Should return match=false for a plate NOT in the watchlist", async () => {
    const response = await request(API_URL)
      .get(`/detections/UNKNOWN123`)
      .expect(200);
    expect(response.body.match).toBe(false);
  });

  // Test 3: Ensure error when querying without plate_number
  test("Should return an error when querying without a plate_number", async () => {
    const response = await request(API_URL).get(`/detections`).expect(500);
  });

  // Test 4: Ensure Pre-signed S3 URL is generated for image upload
  test("Should generate a valid pre-signed S3 URL for match upload", async () => {
    const response = await request(API_URL)
      .get(`/detections/${TEST_PLATE}`)
      .expect(200);

    if (response.body.match) {
      expect(response.body.upload_url).toBeDefined();
      expect(response.body.upload_url).toContain("https://");
      expect(response.body.upload_url).toContain(".s3.");
      expect(response.body.upload_url).toContain("amazonaws.com/");
    }
  });
});
