const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2)); // Log incoming request
  console.log("WATCHLIST_TABLE:", WATCHLIST_TABLE); // Log environment variable

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

    return {
      statusCode: 200,
      body: JSON.stringify({
        match: !!Item,
        tracking_info: Item?.tracking_info || [],
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
