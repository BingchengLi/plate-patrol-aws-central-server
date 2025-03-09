const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({});

const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE;
const S3_BUCKET = process.env.S3_BUCKET;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2)); // Log incoming request
  console.log("WATCHLIST_TABLE:", WATCHLIST_TABLE);
  console.log("S3_BUCKET:", S3_BUCKET);

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

    // ✅ Query DynamoDB using AWS SDK v3
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
        body: JSON.stringify({
          match: false,
        }),
      };
    }

    // Generate a pre-signed URL to upload the detected plate image
    const fileName = `matches/${plateNumber}-${Date.now()}.json`;
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: fileName,
      ContentType: "application/json",
    };

    const preSignedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand(uploadParams),
      {
        expiresIn: 300, // Expire in 5 minutes
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        match: true,
        tracking_info: Item.tracking_info || [],
        upload_url: preSignedUrl, // Pre-signed URL for uploading match data
        file_key: fileName, // File path in S3
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
