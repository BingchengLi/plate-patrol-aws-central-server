const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { httpMethod, pathParameters, body } = event;

    // ==============================Endpoints==============================
    // GET /plates - List all plates in the watchlist
    if (httpMethod === "GET" && !pathParameters) {
      const params = {
        TableName: WATCHLIST_TABLE,
      };

      const { Items } = await dynamoDB.send(new ScanCommand(params));

      return {
        statusCode: 200,
        body: JSON.stringify(Items || []),
      };
    }

    // ------------------------------
    // GET /plates/{plate_number} - Check if a plate is in the watchlist
    if (httpMethod === "GET" && pathParameters?.plate_number) {
      const plateNumber = pathParameters.plate_number;

      const params = {
        TableName: WATCHLIST_TABLE,
        Key: { plate_number: plateNumber },
      };

      const { Item } = await dynamoDB.send(new GetCommand(params));

      return {
        statusCode: 200,
        body: JSON.stringify(
          Item
            ? {
                plate_number: plateNumber,
                tracking_officers: Object.keys(Item.tracking_officers || {}),
              }
            : {}
        ),
      };
    }

    // ------------------------------
    // POST /plates - Add a plate to the watchlist
    if (httpMethod === "POST") {
      const { plate_number, officer_id, reason } = JSON.parse(body);

      if (!plate_number || !officer_id || !reason) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Missing fields" }),
        };
      }

      // Check if the plate already exists
      const { Item } = await dynamoDB.send(
        new GetCommand({
          TableName: WATCHLIST_TABLE,
          Key: { plate_number },
        })
      );

      // If the plate already exists, append the officer to the tracking list
      if (Item) {
        const updateParams = {
          TableName: WATCHLIST_TABLE,
          Key: { plate_number },
          UpdateExpression: "SET tracking_officers.#officer = :reason",
          ExpressionAttributeNames: { "#officer": officer_id },
          ExpressionAttributeValues: { ":reason": reason },
          ReturnValues: "UPDATED_NEW",
        };

        await dynamoDB.send(new UpdateCommand(updateParams));

        return {
          statusCode: 200,
          body: JSON.stringify({ message: "Officer added to tracking list" }),
        };
      }

      // Otherwise, create a new entry
      const putParams = {
        TableName: WATCHLIST_TABLE,
        Item: {
          plate_number,
          tracking_officers: { [officer_id]: reason },
        },
      };

      await dynamoDB.send(new PutCommand(putParams));

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Plate added to global watchlist" }),
      };
    }

    // ------------------------------
    // DELETE /plates/{plate_number}/officers/{officer_id} - Remove an officer from tracking
    if (
      httpMethod === "DELETE" &&
      pathParameters?.plate_number &&
      pathParameters?.officer_id
    ) {
      const { plate_number, officer_id } = pathParameters;

      // First retrieve the existing plate data
      const { Item } = await dynamoDB.send(
        new GetCommand({
          TableName: WATCHLIST_TABLE,
          Key: { plate_number },
        })
      );

      if (!Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "Plate not found" }),
        };
      }

      // If the officer is not tracking this plate, return
      if (!Item.tracking_officers?.[officer_id]) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "Officer not tracking this plate" }),
        };
      }

      // If this is the last officer tracking the plate, delete the entry
      if (Object.keys(Item.tracking_officers).length === 1) {
        await dynamoDB.send(
          new DeleteCommand({
            TableName: WATCHLIST_TABLE,
            Key: { plate_number },
          })
        );
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Plate removed from global watchlist",
          }),
        };
      }

      // Otherwise, just remove this officer from the tracking list
      const updateParams = {
        TableName: WATCHLIST_TABLE,
        Key: { plate_number },
        UpdateExpression: "REMOVE tracking_officers.#officer",
        ExpressionAttributeNames: { "#officer": officer_id },
        ReturnValues: "UPDATED_NEW",
      };

      await dynamoDB.send(new UpdateCommand(updateParams));

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Officer removed from tracking list" }),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
