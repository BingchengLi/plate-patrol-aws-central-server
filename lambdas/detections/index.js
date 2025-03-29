const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({});

const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE;
const UPLOAD_STATUS_TABLE = process.env.UPLOAD_STATUS_TABLE;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2)); // Log incoming request

  try {
    const plateNumber = event.pathParameters?.plate_number;
    console.log("Extracted plate_number:", plateNumber); // Log extracted plate_number

    if (!plateNumber) {
      console.error("plate_number is missing!");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "plate_number is required" }),
      };
    }

    // Query DynamoDB using AWS SDK v3
    const params = {
      TableName: WATCHLIST_TABLE,
      Key: { plate_number: plateNumber },
    };

    console.log(
      "Querying DynamoDB with params:",
      JSON.stringify(params, null, 2)
    );

    const { Item } = await dynamoDB.send(new GetCommand(params));

    console.log("DynamoDB result:", JSON.stringify(Item, null, 2));

    // If plate is NOT in the watchlist, return match=false
    if (!Item) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match: false,
        }),
      };
    }

    // Note: The following code is for direct S3 upload - commented out
    // Generate a pre-signed URL to upload the detected plate image
    // const fileName = `matches/${plateNumber}-${Date.now()}.json`;
    // const uploadParams = {
    //   Bucket: S3_BUCKET,
    //   Key: fileName,
    //   ContentType: "application/json",
    // };

    // const preSignedUrl = await getSignedUrl(
    //   s3,
    //   new PutObjectCommand(uploadParams),
    //   {
    //     expiresIn: 300, // Expire in 5 minutes
    //   }
    // );

    // console.log("Generated pre-signed URL:", preSignedUrl, "for", fileName);

    // Generate a unique image_id
    const imageId = uuidv4();
    console.log("Generated image_id:", imageId);

    // Store upload status in DynamoDB
    const uploadStatusParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Item: {
        image_id: imageId,
        plate_number: plateNumber,
        status: "pending", // Initial status
        created_at: new Date().toISOString(), // Timestamp
      },
    };

    console.log(
      "Storing upload status in DynamoDB with params:",
      JSON.stringify(uploadStatusParams, null, 2)
    );

    await dynamoDB.send(new PutCommand(uploadStatusParams));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match: true,
        imageId: imageId,
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
