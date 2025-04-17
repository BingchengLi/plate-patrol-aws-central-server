import request from "supertest";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { error } from "console";

// Load environment variables
dotenv.config();

const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://xat4qx9kpj.execute-api.us-east-2.amazonaws.com";
const STAGE = process.env.STAGE || "dev";
const API_URL = `${API_BASE_URL}/${STAGE}`;

const VALID_WATCHLIST_API_KEY =
  process.env.VALID_WATCHLIST_API_KEY ||
  "RbC1Fostw07gDZQNEhqYz1UEKySIRKwE7mkMf7Hs";
const VALID_DASHCAM_API_KEY =
  process.env.VALID_DASHCAM_API_KEY ||
  "pXceWVib2h1ej16WgIaWs2JQzLk6RXUJ8mGylFFo";
const TEST_PLATE_NUMBER = "CCC444";
const TEST_REASON = "Testing chunked image upload pipeline";
const TEST_IMAGE_PATH = path.join(__dirname, "../assets/45-kb-image-raw.jpg");

const UPLOAD_STATUS_TABLE =
  process.env.UPLOAD_STATUS_TABLE || "upload_status_staging";
const S3_BUCKET = process.env.S3_BUCKET || "match-uploads-dev";
const MATCH_LOG_TABLE = process.env.MATCH_LOG_TABLE || "match_logs_dev";

const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

const addTestPlateToWatchlist = async () => {
  console.log("Adding test plate to watchlist...");
  const response = await request(API_URL)
    .post("/plates")
    .set("x-api-key", VALID_WATCHLIST_API_KEY)
    .send({ plate_number: TEST_PLATE_NUMBER, reason: TEST_REASON });

  expect(response.statusCode).toBe(200);
  console.log("Test plate added.");
};

const removeTestPlateFromWatchlist = async () => {
  console.log("Removing test plate from watchlist...");
  const response = await request(API_URL)
    .delete(`/plates/${TEST_PLATE_NUMBER}`)
    .set("x-api-key", VALID_WATCHLIST_API_KEY);

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ message: "Plate removed from watchlist" });
  console.log("Test plate deleted.");
};

const verifyUpload = async (
  imageId: string,
  gps: string,
  timestamp: string,
  totalChunks: number
) => {
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

  const response = await dynamoDB.send(getCommand);
  expect(response.Item).toBeDefined();
  expect(response.Item).toHaveProperty("match_id", imageId);
  expect(response.Item).toHaveProperty("plate_number", TEST_PLATE_NUMBER);
  expect(response.Item).toHaveProperty("gps_location", gps);
  expect(response.Item).toHaveProperty("timestamp", timestamp);
  expect(response.Item).toHaveProperty(
    "assembled_file",
    `images/${imageId}.png`
  );
  expect(response.Item).toHaveProperty("created_at");

  // Verify cleanup of chunks in S3
  for (let i = 0; i < totalChunks; i++) {
    const chunkKey = `uploads/${imageId}/chunk_${i}`;
    try {
      await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: chunkKey }));
      throw new Error(`Chunk ${chunkKey} was not deleted as expected.`);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.name).toBe("NoSuchKey");
        console.log(`Chunk ${chunkKey} successfully deleted.`);
      } else {
        throw error;
      }
    }
  }

  // Verify cleanup of metadata in DynamoDB
  const metadataCheckCommand = new GetCommand({
    TableName: UPLOAD_STATUS_TABLE,
    Key: { image_id: imageId },
  });

  const metadataResponse = await dynamoDB.send(metadataCheckCommand);
  expect(metadataResponse.Item).toBeUndefined();
  console.log(`Metadata for image_id ${imageId} successfully deleted.`);
};

const getImageIdFromDetection = async () => {
  console.log("Retrieving image_id via detection API...");
  const response = await request(API_URL)
    .get(`/detections/${TEST_PLATE_NUMBER}`)
    .set("x-api-key", VALID_DASHCAM_API_KEY);

  expect(response.statusCode).toBe(200);
  expect(response.body).toHaveProperty("match", true);
  expect(response.body).toHaveProperty("image_id");

  const imageId = response.body.image_id;
  console.log(`Retrieved image_id: ${imageId}`);

  return imageId;
};

describe.only("Full Detection + Chunked Image Upload Integration Test", () => {
  let imageId: string;

  beforeAll(async () => {
    // Step 1: Add the test plate to the watchlist
    await addTestPlateToWatchlist();
  });

  afterAll(async () => {
    // Step 6: Clean up the test plate from the watchlist
    await removeTestPlateFromWatchlist();
  });

  it("should retrieve an image_id via detection API", async () => {
    // Step 2: Perform detection to get the image_id
    imageId = await getImageIdFromDetection();
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
      })
      .set("x-api-key", VALID_DASHCAM_API_KEY);
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
          })
          .set("x-api-key", VALID_DASHCAM_API_KEY);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
          message: "Chunk uploaded successfully",
          chunk_id: i,
        });
      }
    }

    // Step 7: Verify the upload
    await verifyUpload(imageId, gps, timestamp, totalChunks);
  }, 10000);
});

describe("Chunk image upload edge case tests", () => {
  let imageId: string;
  const invalidChunkId = -1;
  const invalidTotalChunks = -1;
  const invalidImageId = "INVALID_IMAGE_ID";

  beforeAll(async () => {
    await addTestPlateToWatchlist();
    imageId = await getImageIdFromDetection();
  });

  afterAll(async () => {
    await removeTestPlateFromWatchlist();
  });

  describe("API key validation", () => {
    it("should not be able to upload without api key", async () => {
      const response = await request(API_URL).post("/uploads").send({
        image_id: imageId,
        chunk_id: 0,
        total_chunks: 1,
        data: "test",
      });

      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    });

    it("should not be able to upload with invalid api key", async () => {
      const response = await request(API_URL)
        .post("/uploads")
        .set("x-api-key", "INVALID_API_KEY")
        .send({
          image_id: imageId,
          chunk_id: 0,
          total_chunks: 1,
          data: "test",
        });
      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    });
  });

  describe("Chunk validation", () => {
    it("should return 400 error for missing image_id", async () => {
      const response = await request(API_URL)
        .post("/uploads")
        .set("x-api-key", VALID_DASHCAM_API_KEY)
        .send({
          chunk_id: 0,
          total_chunks: 1,
          data: "test",
        });
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error:
          "Missing required fields: image_id, chunk_id, total_chunks, or data",
      });
    });

    it("should return 400 error for missing chunk_id", async () => {
      const response = await request(API_URL)
        .post("/uploads")
        .set("x-api-key", VALID_DASHCAM_API_KEY)
        .send({
          image_id: imageId,
          total_chunks: 1,
          data: "test",
        });
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error:
          "Missing required fields: image_id, chunk_id, total_chunks, or data",
      });
    });

    it("should return 400 for invalid image_id", async () => {
      const response = await request(API_URL)
        .post("/uploads")
        .set("x-api-key", VALID_DASHCAM_API_KEY)
        .send({
          image_id: invalidImageId,
          chunk_id: 0,
          total_chunks: 1,
          data: "test",
        });
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: "image_id is not valid",
      });
    });

    it("should return 400 for invalid chunk_id", async () => {
      const response = await request(API_URL)
        .post("/uploads")
        .set("x-api-key", VALID_DASHCAM_API_KEY)
        .send({
          image_id: imageId,
          chunk_id: invalidChunkId,
          total_chunks: 1,
          data: "test",
        });
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: "chunk_id must be a number between 0 and total_chunks - 1",
      });
    });

    it("should return 400 for invalid total_chunks", async () => {
      const response = await request(API_URL)
        .post("/uploads")
        .set("x-api-key", VALID_DASHCAM_API_KEY)
        .send({
          image_id: imageId,
          chunk_id: 0,
          total_chunks: invalidTotalChunks,
          data: "test",
        });
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: "total_chunks must be a positive number",
      });
    });
  });

  describe("Chunk upload with duplicate chunks", () => {
    it("should successfully upload the full image", async () => {
      const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);

      const chunkSize = 8 * 1024; // 8KB
      const chunks = [];
      for (let i = 0; i < imageBuffer.length; i += chunkSize) {
        chunks.push(imageBuffer.slice(i, i + chunkSize));
      }

      const totalChunks = chunks.length;

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
        })
        .set("x-api-key", VALID_DASHCAM_API_KEY);
      expect(initialResponse.statusCode).toBe(200);
      expect(initialResponse.body).toEqual({
        message: "Chunk uploaded successfully",
        chunk_id: 0,
      });

      // * Duplicate chunk
      // Upload the first chunk again
      const duplicateResponse = await request(API_URL)
        .post("/uploads")
        .send({
          image_id: imageId,
          chunk_id: 0,
          total_chunks: totalChunks,
          data: chunks[0].toString("base64"), // Encode chunk as Base64
        })
        .set("x-api-key", VALID_DASHCAM_API_KEY);
      expect(duplicateResponse.statusCode).toBe(200);
      expect(duplicateResponse.body).toEqual({
        message: "Chunk uploaded successfully",
        chunk_id: 0,
      });
      console.log("Duplicate chunk uploaded successfully.");

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
            })
            .set("x-api-key", VALID_DASHCAM_API_KEY);

          expect(response.statusCode).toBe(200);
          expect(response.body).toEqual({
            message: "Chunk uploaded successfully",
            chunk_id: i,
          });
        }
      }

      await verifyUpload(imageId, gps, timestamp, totalChunks);
    }, 10000);

    it("should return error if we try to upload with the same image_id since we already uploaded the image", async () => {
      const response = await request(API_URL)
        .post("/uploads")
        .set("x-api-key", VALID_DASHCAM_API_KEY)
        .send({
          image_id: imageId,
          chunk_id: 0,
          total_chunks: 1,
          data: "test",
        });
      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: "image_id is not valid",
      });
    });
  });

  describe("Chunk upload with out-of-order chunks", () => {
    beforeAll(async () => {
      // Get a new image_id for the test
      imageId = await getImageIdFromDetection();
    });

    it("should upload chunks out of order", async () => {});
  });
});
