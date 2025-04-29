const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

// AWS SDK clients
const s3 = new S3Client({});
const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});

// Environment variables
const UPLOADS_BUCKET = process.env.S3_BUCKET;
const UPLOAD_STATUS_TABLE = process.env.UPLOAD_STATUS_TABLE;
const ASSEMBLY_LAMBDA = process.env.ASSEMBLY_LAMBDA;

// Webhook URL for chunk upload activity
// This is only for demo purposes
const WEBHOOK_CHUNK_URL =
  "http://18.222.109.39:4000/webhook/chunk-upload-activity";

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Parse input data
    let { image_id, chunk_id, total_chunks, data, timestamp, gps_location } =
      JSON.parse(event.body);

    if (!image_id || chunk_id === undefined || !total_chunks || !data) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Missing required fields: image_id, chunk_id, total_chunks, or data",
        }),
      };
    }

    if (isNaN(total_chunks) || total_chunks <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "total_chunks must be a positive number",
        }),
      };
    }

    if (isNaN(chunk_id) || chunk_id < 0 || chunk_id >= total_chunks) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "chunk_id must be between 0 and total_chunks - 1",
        }),
      };
    }

    // Validate image_id exists
    const getImageIdParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Key: { image_id },
    };
    const imageIdRecord = await dynamoDB.send(new GetCommand(getImageIdParams));
    if (!imageIdRecord.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "image_id is not valid" }),
      };
    }

    console.log("Valid image_id found in DynamoDB:", imageIdRecord.Item);

    // Store chunk in S3
    const chunkKey = `uploads/${image_id}/chunk_${chunk_id}`;
    console.log("Storing chunk in S3:", chunkKey);

    await s3.send(
      new PutObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: chunkKey,
        Body: Buffer.from(data, "base64"),
      })
    );

    console.log("Chunk stored successfully:", chunkKey);

    // Convert unix timestamp to ISO string if provided
    if (timestamp) {
      timestamp = new Date(timestamp * 1000).toLocaleString("en-US", {
        timeZone: "America/New_York",
      });
    }

    // Update DynamoDB metadata
    const expressionAttributeValues = {
      ":chunk": [chunk_id],
      ":total_chunks": total_chunks,
      ":empty_list": [],
    };
    if (timestamp) {
      expressionAttributeValues[":timestamp"] = timestamp;
    }
    if (gps_location) {
      expressionAttributeValues[":gps_location"] = gps_location;
    }

    const updateParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Key: { image_id },
      UpdateExpression: `
        SET #received_chunks = list_append(if_not_exists(#received_chunks, :empty_list), :chunk),
            #total_chunks = :total_chunks
            ${
              timestamp
                ? ", #timestamp = if_not_exists(#timestamp, :timestamp)"
                : ""
            }
            ${
              gps_location
                ? ", #gps_location = if_not_exists(#gps_location, :gps_location)"
                : ""
            }
      `,
      ExpressionAttributeNames: {
        "#received_chunks": "received_chunks",
        "#total_chunks": "total_chunks",
        ...(timestamp && { "#timestamp": "timestamp" }),
        ...(gps_location && { "#gps_location": "gps_location" }),
      },
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    };

    const updatedRecord = await dynamoDB.send(new UpdateCommand(updateParams));
    console.log(
      "Updated DynamoDB record:",
      JSON.stringify(updatedRecord.Attributes, null, 2)
    );

    // Send webhook for chunk upload activity
    const newChunkEvent = {
      image_id,
      chunk_id,
      total_chunks,
      data, // base64 encoded
      timestamp: timestamp || null,
      gps_location: gps_location || null,
      received_at: new Date().toISOString(),
    };

    console.log(`Sending chunk upload webhook to: ${WEBHOOK_CHUNK_URL}`);

    // Send webhook in the background to avoid blocking
    sendWebhookWithRetry(WEBHOOK_CHUNK_URL, newChunkEvent).catch((err) => {
      console.error("Failed to send chunk webhook in background:", err.message);
    });

    // Check if all chunks are received
    const { received_chunks } = updatedRecord.Attributes;
    const uniqueChunks = Array.from(new Set(received_chunks));

    if (uniqueChunks.length === total_chunks) {
      console.log("All chunks received, triggering assembly process.");
      await lambda.send(
        new InvokeCommand({
          FunctionName: ASSEMBLY_LAMBDA,
          InvocationType: "Event",
          Payload: JSON.stringify({ image_id }),
        })
      );
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Chunk uploaded successfully",
        chunk_id,
      }),
    };
  } catch (error) {
    console.error("Error occurred:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

// Helper to retry webhook send
async function sendWebhookWithRetry(
  url,
  payload,
  maxRetries = 2,
  delayMs = 1000
) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(
          `Webhook attempt ${attempt} failed with status: ${res.status}`
        );
        console.error(`Response body: ${await res.text()}`);
        throw new Error(`Server responded with status ${res.status}`);
      }

      console.log(`Webhook sent successfully on attempt ${attempt}`);
      return;
    } catch (err) {
      console.error(`Webhook attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries + 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error("All webhook retries failed.");
      }
    }
  }
}
