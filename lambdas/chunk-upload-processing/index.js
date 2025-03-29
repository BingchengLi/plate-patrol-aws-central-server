const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const s3 = new S3Client({});
const dynamoDB = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient({});

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
const UPLOAD_STATUS_TABLE = process.env.UPLOAD_STATUS_TABLE;
const ASSEMBLY_LAMBDA = process.env.ASSEMBLY_LAMBDA;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { image_id, chunk_id, total_chunks, data, timestamp, gps_location } =
      JSON.parse(event.body);

    // Chunk ID is 0-indexed so we're checking if it's defined
    if (!image_id || chunk_id === undefined || !total_chunks || !data) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Missing required fields: image_id, chunk_id, total_chunks, or data",
        }),
      };
    }

    // Store chunk in S3
    const chunkKey = `uploads/${image_id}/chunk_${chunk_id}`;
    console.log("Storing chunk in S3:", chunkKey);

    await s3.send(
      new PutObjectCommand({
        Bucket: UPLOADS_BUCKET,
        Key: chunkKey,
        Body: Buffer.from(data, "base64"), // TODO: Check with Vicky if data is base64 encoded
      })
    );

    console.log(
      "Chunk stored successfully in S3 bucket:",
      UPLOADS_BUCKET,
      chunkKey
    );

    // Update DynamoDB metadata
    const updateParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Key: { image_id },
      UpdateExpression:
        "SET #received_chunks = list_append(if_not_exists(#received_chunks, :empty_list), :chunk), #total_chunks = :total_chunks, #timestamp = if_not_exists(#timestamp, :timestamp), #gps_location = if_not_exists(#gps_location, :gps_location)",
      ExpressionAttributeNames: {
        "#received_chunks": "received_chunks",
        "#total_chunks": "total_chunks",
        "#timestamp": "timestamp",
        "#gps_location": "gps_location",
      },
      ExpressionAttributeValues: {
        ":chunk": [chunk_id],
        ":total_chunks": total_chunks,
        ":timestamp": timestamp || new Date().toISOString(),
        ":gps_location": gps_location || null,
        ":empty_list": [],
      },
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

      // Invoke the assembly Lambda
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
      body: JSON.stringify({
        message: "Chunk uploaded successfully",
        image_id,
        chunk_id,
      }),
    };
  } catch (error) {
    console.error("Error occurred:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
