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

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    // Parse input data
    const { image_id, chunk_id, total_chunks, data, timestamp, gps_location } =
      JSON.parse(event.body);

    // Check for required fields
    if (!image_id || chunk_id === undefined || !total_chunks || !data) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Missing required fields: image_id, chunk_id, total_chunks, or data",
        }),
      };
    }

    // Validate total_chunks - it should be a positive number
    if (isNaN(total_chunks) || total_chunks <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "total_chunks must be a positive number",
        }),
      };
    }

    // Validate chunk_id - it should be a number that is smaller than total_chunks
    if (isNaN(chunk_id) || chunk_id < 0 || chunk_id >= total_chunks) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "chunk_id must be a number between 0 and total_chunks - 1",
        }),
      };
    }

    // Validate image_id - there should be a record in UPLOAD_STATUS_TABLE
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

    // Store the chunk in S3
    const chunkKey = `uploads/${image_id}/chunk_${chunk_id}`;
    console.log("Storing chunk in S3:", chunkKey);

    await s3.send(
      new PutObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: chunkKey,
        Body: Buffer.from(data, "base64"), // Assuming data is Base64 encoded
      })
    );

    console.log("Chunk stored successfully in S3:", chunkKey);

    // UPLOAD_STATUS_TABLE
    // Primary Key: image_id
    // Attributes:
    // - received_chunks (list of chunk_ids)
    // - total_chunks (number)
    // - timestamp (optional) * should be updated only once with the first chunk
    // - gps_location (optional) * should be updated only once with the first chunk

    // Update DynamoDB metadata
    const expressionAttributeValues = {
      ":chunk": [chunk_id],
      ":total_chunks": total_chunks,
      ":empty_list": [],
    };

    // Add timestamp and gps_location to the update expression if provided
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

    // Check if all chunks are received
    const { received_chunks } = updatedRecord.Attributes;
    const uniqueChunks = Array.from(new Set(received_chunks)); // Deduplicate chunks

    if (uniqueChunks.length === total_chunks) {
      console.log("All chunks received. Triggering assembly process.");

      // Invoke the assembly Lambda asynchronously
      await lambda.send(
        new InvokeCommand({
          FunctionName: ASSEMBLY_LAMBDA,
          InvocationType: "Event", // Asynchronous invocation
          Payload: JSON.stringify({ image_id }),
        })
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
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
