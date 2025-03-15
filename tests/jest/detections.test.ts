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
const API_BASE_URL = process.env.API_URL || "http://localhost:3000";
const STAGE = process.env.STAGE || "dev";
const API_URL = `${API_BASE_URL}/${STAGE}`;

const TEST_PLATE = "XYZ123";
const UNKNOWN_PLATE = "UNKNOWN123";

// Configure AWS DynamoDB
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-2",
});
const dynamoDB = DynamoDBDocumentClient.from(ddbClient);
const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE || "global_watchlist_dev";

describe("/detections API Integration Tests", () => {
  beforeAll(async () => {
    console.log(`Setting up test plate in DynamoDB: ${TEST_PLATE}`);

    const putParams = {
      TableName: WATCHLIST_TABLE,
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
    console.log(`Cleaning up test plate from DynamoDB: ${TEST_PLATE}`);

    const deleteParams = {
      TableName: WATCHLIST_TABLE,
      Key: { plate_number: TEST_PLATE },
    };

    await dynamoDB.send(new DeleteCommand(deleteParams));
  });

  // ============== Test Known Plate Detection ==============
  it("should detect a plate that exists in the watchlist", async () => {
    const response = await request(API_URL).get(`/detections/${TEST_PLATE}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("match", true);
    expect(response.body).toHaveProperty("plate_number", TEST_PLATE);
    expect(response.body.tracking_info).toHaveProperty("officer-1");
    expect(response.body.tracking_info["officer-1"].reason).toBe("stolen");
  });

  // ============== Test Unknown Plate Detection ==============
  it("should return match=false for a plate not in the watchlist", async () => {
    const response = await request(API_URL).get(`/detections/${UNKNOWN_PLATE}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("match", false);
    expect(response.body).toHaveProperty("plate_number", UNKNOWN_PLATE);
  });

  // ============== Test Missing Plate Number ==============
  it("should return an error when querying without a plate_number", async () => {
    const response = await request(API_URL).get(`/detections`);

    expect(response.statusCode).toBe(404); // API Gateway should return 404 if the route is incorrect
  });

  // ============== Test Pre-signed S3 URL Generation ==============
  it("should generate a valid pre-signed S3 URL for match upload", async () => {
    const response = await request(API_URL).get(`/detections/${TEST_PLATE}`);

    expect(response.statusCode).toBe(200);

    if (response.body.match) {
      expect(response.body).toHaveProperty("upload_url");
      expect(response.body.upload_url).toContain("https://");
      expect(response.body.upload_url).toContain(".s3.");
      expect(response.body.upload_url).toContain("amazonaws.com/");
    }
  });
});
