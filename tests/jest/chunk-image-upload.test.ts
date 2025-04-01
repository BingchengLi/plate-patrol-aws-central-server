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
const TEST_PLATE_NUMBER = "CCC444";
const TEST_REASON = "Testing chunked image upload pipeline";
const TEST_IMAGE_PATH = path.join(__dirname, "../assets/45-kb-image-raw.jpg");

const UPLOAD_STATUS_TABLE =
  process.env.UPLOAD_STATUS_TABLE || "upload_status_staging";
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET || "uploads-bucket-staging";

const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

describe("Full Detection + Chunked Image Upload Integration Test", () => {
  let imageId: string;

  beforeAll(async () => {
    // Step 1: Add the test plate to the watchlist
    console.log("Adding test plate to watchlist...");
    const response = await request(API_URL)
      .post("/plates")
      .set("x-api-key", VALID_API_KEY)
      .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

    expect(response.statusCode).toBe(200);
    console.log("Test plate added.");
  });

  afterAll(async () => {
    // Step 6: Clean up the test plate from the watchlist
    console.log("Removing test plate from watchlist...");
    const response = await request(API_URL)
      .delete(`/plates/${TEST_PLATE_NUMBER}`)
      .set("x-api-key", VALID_API_KEY);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Plate removed from watchlist" });
    console.log("Test plate deleted.");
  });

  it("should retrieve an image_id via detection API", async () => {
    // Step 2: Perform detection to get the image_id
    const response = await request(API_URL).get(
      `/detections/${TEST_PLATE_NUMBER}`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("match", true);
    expect(response.body).toHaveProperty("image_id");

    imageId = response.body.image_id;
    console.log(`Retrieved image_id: ${imageId}`);
  });

  it("should upload chunks and verify the assembled image", async () => {
    // Step 3: Read the image file
    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);

    // Step 4: Split the image into chunks
    const chunkSize = 8 * 1024; // 8KB
    const chunks = [];
    for (let i = 0; i < imageBuffer.length; i += chunkSize) {
      chunks.push(imageBuffer.slice(i, i + chunkSize));
    }

    const totalChunks = chunks.length;

    // Step 5: Upload each chunk via the /uploads API
    for (let i = 0; i < chunks.length; i++) {
      const response = await request(API_URL)
        .post("/uploads")
        .send({
          image_id: imageId,
          chunk_id: i,
          total_chunks: totalChunks,
          data: chunks[i].toString("base64"), // Encode chunk as Base64
        });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        message: "Chunk uploaded successfully",
        chunk_id: i,
      });
    }

    // Wait for the assembly Lambda to process the chunks
    console.log("Waiting for assembly process...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Adjust wait time as needed

    // Verify the assembled image status in DynamoDB
    const { Item } = await dynamoDB.send(
      new GetCommand({
        TableName: UPLOAD_STATUS_TABLE,
        Key: { image_id: imageId },
      })
    );

    expect(Item).toBeDefined();
    if (Item) {
      expect(Item.image_id).toBe(imageId);
      expect(Item.status).toBe("COMPLETED");
    }

    // Verify the assembled image exists in S3
    const assembledKey = `images/${imageId}.assembled`;
    const assembledImageResponse = await fetch(
      `https://${UPLOADS_BUCKET}.s3.amazonaws.com/${assembledKey}`
    );

    expect(assembledImageResponse.status).toBe(200);

    const assembledImageBuffer = await assembledImageResponse.arrayBuffer();
    const assembledImage = Buffer.from(assembledImageBuffer);

    // Verify that the assembled image matches the original image
    expect(assembledImage.equals(imageBuffer)).toBe(true);
  });
});
