const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

// AWS SDK clients
const s3 = new S3Client({});
const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Environment variables
const UPLOADS_BUCKET = process.env.S3_BUCKET;
const UPLOAD_STATUS_TABLE = process.env.UPLOAD_STATUS_TABLE;
const ASSEMBLED_FILES_PREFIX = "images/";

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

    const { received_chunks, total_chunks } = metadata.Item;

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

    // TODO: Log the match event in DynamoDB match log table

    // Clean up
    // TODO: Delete the chunks from S3 after assembly

    // TODO: Delete the metadata from DynamoDB upload status table after assembly

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
