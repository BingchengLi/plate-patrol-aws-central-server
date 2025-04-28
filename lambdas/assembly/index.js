const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

// AWS SDK clients
const s3 = new S3Client({});
const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Environment variables
const UPLOADS_BUCKET = process.env.S3_BUCKET;
const UPLOAD_STATUS_TABLE = process.env.UPLOAD_STATUS_TABLE;
const ASSEMBLED_FILES_PREFIX = "images/";
const MATCH_LOG_TABLE = process.env.MATCH_LOG_TABLE;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Extract the image_id from the event payload
    const { image_id } = event;

    // Validate the input
    if (!image_id) {
      throw new Error("Missing required field: image_id");
    }

    // Fetch metadata for the image_id from DynamoDB
    console.log(`Fetching metadata for image_id: ${image_id}`);
    const getMetadataParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Key: { image_id },
    };

    const metadata = await dynamoDB.send(new GetCommand(getMetadataParams));
    if (!metadata.Item) {
      throw new Error(`No metadata found for image_id: ${image_id}`);
    }

    const {
      received_chunks,
      total_chunks,
      timestamp,
      gps_location,
      plate_number,
    } = metadata.Item;

    // Validate that all chunks are present
    const uniqueChunks = Array.from(new Set(received_chunks)); // Deduplicate chunks
    if (uniqueChunks.length !== total_chunks) {
      throw new Error(
        `Not all chunks received for image_id: ${image_id}. Expected ${total_chunks}, got ${uniqueChunks.length}`
      );
    }

    // Sort chunks by their chunk_id to ensure correct order
    const sortedChunks = uniqueChunks.sort((a, b) => a - b);

    // Fetch and assemble the chunks from S3
    console.log(`Fetching and assembling chunks for image_id: ${image_id}`);
    const assembledBuffer = Buffer.concat(
      await Promise.all(
        sortedChunks.map(async (chunk_id) => {
          const chunkKey = `uploads/${image_id}/chunk_${chunk_id}`;
          console.log(`Fetching chunk from S3: ${chunkKey}`);

          const chunkData = await s3.send(
            new GetObjectCommand({
              Bucket: UPLOADS_BUCKET,
              Key: chunkKey,
            })
          );

          // Read the chunk data into a buffer
          return new Promise((resolve, reject) => {
            const chunks = [];
            chunkData.Body.on("data", (chunk) => chunks.push(chunk));
            chunkData.Body.on("end", () => resolve(Buffer.concat(chunks)));
            chunkData.Body.on("error", reject);
          });
        })
      )
    );

    // Store the assembled file in S3
    const assembledKey = `${ASSEMBLED_FILES_PREFIX}${image_id}.png`;
    console.log(`Storing assembled file in S3: ${assembledKey}`);

    await s3.send(
      new PutObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: assembledKey,
        Body: assembledBuffer,
      })
    );

    console.log(`Assembled file successfully stored in S3: ${assembledKey}`);

    // Update the DynamoDB table to mark the upload as complete
    console.log(
      `Updating DynamoDB to mark upload as complete for image_id: ${image_id}`
    );
    const updateParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Key: { image_id },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "COMPLETED",
      },
    };

    await dynamoDB.send(new UpdateCommand(updateParams));

    console.log(`Upload marked as complete for image_id: ${image_id}`);

    // Log the match event in DynamoDB match log table
    console.log(`Logging match event for image_id: ${image_id}`);
    const matchLogParams = {
      TableName: MATCH_LOG_TABLE,
      Item: {
        match_id: image_id,
        plate_number,
        timestamp,
        gps_location,
        assembled_file: assembledKey,
        created_at: new Date().toISOString(), // For latency tracking
      },
    };

    await dynamoDB.send(new PutCommand(matchLogParams));

    console.log(`Match event logged for image_id: ${image_id}`);

    // Send a webhook to notify the completion of the assembly
    console.log(`Sending webhook to ${webhookUrl}`);

    // In a real-world scenario, we will notify every webhook URL subscribed to
    // the plate_number (stored in WATCHLIST_TABLE)
    // For demo purposes, we are using a hardcoded URL
    const webhookUrl = "http://18.222.109.39:4000/webhook/image-complete";

    const webhookPayload = {
      image_id: image_id,
      file: assembledKey,
      status: "complete",
      timestamp: timestamp,
      gps_location: gps_location,
      image_base64: assembledBuffer.toString("base64"),
    };

    await sendWebhookWithRetry(webhookUrl, webhookPayload);

    // Cleanup: Delete chunks from S3
    await Promise.all(
      sortedChunks.map(async (chunk_id) => {
        const chunkKey = `uploads/${image_id}/chunk_${chunk_id}`;
        console.log(`Deleting chunk from S3: ${chunkKey}`);
        await s3.send(
          new DeleteObjectCommand({ Bucket: UPLOADS_BUCKET, Key: chunkKey })
        );
      })
    );

    // Cleanup: Delete metadata from DynamoDB UPLOAD_STATUS_TABLE
    console.log(`Deleting metadata from DynamoDB for image_id: ${image_id}`);
    await dynamoDB.send(
      new DeleteCommand({ TableName: UPLOAD_STATUS_TABLE, Key: { image_id } })
    );

    // Return success response
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Assembly completed successfully",
        image_id,
      }),
    };
  } catch (error) {
    console.error("Error occurred during assembly:", error);

    // Return error response
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to assemble file",
        details: error.message,
      }),
    };
  }
};

async function sendWebhookWithRetry(
  url,
  payload,
  maxRetries = 2,
  delayMs = 2000
) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`Webhook attempt ${attempt} to ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      console.log(`Webhook sent successfully on attempt ${attempt}`);
      return; // Success, exit function
    } catch (error) {
      console.error(`Webhook attempt ${attempt} failed:`, error.message);

      if (attempt <= maxRetries) {
        console.log(`Retrying webhook after ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error(
          `All webhook attempts failed for image_id: ${payload.image_id}`
        );
      }
    }
  }
}
