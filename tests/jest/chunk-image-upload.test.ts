import request from "supertest";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

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
const S3_BUCKET = process.env.S3_BUCKET || "match-uploads-dev";
const MATCH_LOG_TABLE = process.env.MATCH_LOG_TABLE || "match_logs_dev";

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
    // Upload gps and timestamp for the first chunk
    const gps = "37.7749,-122.4194";
    const timestamp = new Date().toISOString();
    const initialResponse = await request(API_URL)
      .post("/uploads")
      .send({
        image_id: imageId,
        chunk_id: 0,
        total_chunks: totalChunks,
        data: chunks[0].toString("base64"), // Encode chunk as Base64
        gps_location: gps,
        timestamp: timestamp,
      });
    expect(initialResponse.statusCode).toBe(200);
    expect(initialResponse.body).toEqual({
      message: "Chunk uploaded successfully",
      chunk_id: 0,
    });

    // Upload the rest of the chunks
    if (chunks.length > 1) {
      for (let i = 1; i < chunks.length; i++) {
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
    }

    // Wait for the assembly Lambda to process the chunks
    console.log("Waiting for assembly process...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Adjust wait time as needed

    // Verify the assembled image exists in S3 and matches the original image
    const s3 = new S3Client({ region: "us-east-2" });

    const getObjectCommand = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: `images/${imageId}.png`,
    });
    try {
      const data = await s3.send(getObjectCommand);
      if (data.Body) {
        const assembledImageBuffer = await Buffer.from(
          await data.Body.transformToByteArray()
        );
        const originalImageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
        expect(assembledImageBuffer.length).toBe(originalImageBuffer.length);
        expect(assembledImageBuffer.equals(originalImageBuffer)).toBe(true);
        console.log("Assembled image matches the original image.");
      }
    } catch (error) {
      console.error("Error fetching assembled image from S3:", error);
      throw error;
    }

    // Verify the match log in DynamoDB
    const getCommand = new GetCommand({
      TableName: MATCH_LOG_TABLE,
      Key: { match_id: imageId, plate_number: TEST_PLATE_NUMBER },
    });
  }, 10000);
});
