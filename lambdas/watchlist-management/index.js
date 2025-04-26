const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE;
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE;

// Mapping of API keys to user identifiers
const API_KEY_MAP = {
  RbC1Fostw07gDZQNEhqYz1UEKySIRKwE7mkMf7Hs: "dev",
};

// Fallback webhook URL for demo purposes
const DEMO_WEBHOOK_URL = ""; // TODO: Add webhook URL for demo

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { httpMethod, body, headers } = event;

    // ========== Require API Key for all endpoints ==========
    const apiKey = headers["x-api-key"];
    if (!apiKey || !API_KEY_MAP[apiKey]) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Unauthorized: Invalid API Key" }),
      };
    }
    const added_by = API_KEY_MAP[apiKey];

    // ================== GET /plates ==================
    if (httpMethod === "GET") {
      const params = { TableName: WATCHLIST_TABLE };
      const { Items } = await dynamoDB.send(new ScanCommand(params));

      // Extract plate numbers from the Items array
      const plateNumbers = Items.map((item) => item.plate_number);

      return {
        statusCode: 200,
        body: JSON.stringify(plateNumbers || []),
      };
    }

    // ================== POST /plates ==================
    if (httpMethod === "POST") {
      const { plate_number, reason, webhook_url } = JSON.parse(body || "{}");

      // Validate required fields
      if (!plate_number || !reason) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Missing required fields: plate_number, reason",
          }),
        };
      }

      // Fallback to demo webhook URL if not provided
      const webhookUrl = webhook_url || DEMO_WEBHOOK_URL;

      const timestamp = new Date().toISOString();

      // Check if plate already exists
      const getParams = { TableName: WATCHLIST_TABLE, Key: { plate_number } };
      const existingPlate = await dynamoDB.send(new GetCommand(getParams));

      if (existingPlate.Item) {
        // Plate already exists - append webhook if not already tracking
        const existingWebhooks = existingPlate.Item.webhookUrls || [];

        if (!existingWebhooks.includes(webhookUrl)) {
          existingWebhooks.push(webhookUrl);

          const updateParams = {
            TableName: WATCHLIST_TABLE,
            Item: {
              ...existingPlate.Item,
              webhookUrls: existingWebhooks,
            },
          };

          await dynamoDB.send(new PutCommand(updateParams));
          console.log(`Webhook URL added for existing plate: ${plate_number}`);
        } else {
          console.log(`Webhook URL already exists for plate: ${plate_number}`);
        }

        // Log action in audit_logs table
        const putAuditParams = {
          TableName: AUDIT_LOG_TABLE,
          Item: {
            log_id: `log-${Date.now()}`,
            plate_number,
            reason,
            added_by,
            timestamp,
          },
        };
        await dynamoDB.send(new PutCommand(putAuditParams));
        console.log("Audit log entry created:", putAuditParams.Item);

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Plate already exists. Webhook added if new.",
          }),
        };
      }

      // Plate does not exist ➔ create new entry
      const putWatchlistParams = {
        TableName: WATCHLIST_TABLE,
        Item: {
          plate_number,
          reason,
          webhook_urls: [webhook_url],
        },
      };

      await dynamoDB.send(new PutCommand(putWatchlistParams));
      console.log(`New plate added: ${plate_number}`);

      // Log action in audit_logs table
      const putAuditParams = {
        TableName: AUDIT_LOG_TABLE,
        Item: {
          log_id: `log-${Date.now()}`,
          plate_number,
          reason,
          added_by,
          timestamp,
        },
      };

      await dynamoDB.send(new PutCommand(putAuditParams));
      console.log("Audit log entry created:", putAuditParams.Item);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Plate added to watchlist" }),
      };
    }

    // ================== DELETE /plates/{plate_number} ==================
    if (httpMethod === "DELETE") {
      if (!event.pathParameters || !event.pathParameters.plate_number) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "plate_number is required" }),
        };
      }

      const plate_number = event.pathParameters.plate_number;

      // Check if plate exists
      const getParams = { TableName: WATCHLIST_TABLE, Key: { plate_number } };
      const existingPlate = await dynamoDB.send(new GetCommand(getParams));

      if (!existingPlate.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Plate not found in watchlist" }),
        };
      }

      // Remove plate from watchlist
      await dynamoDB.send(
        new DeleteCommand({
          TableName: WATCHLIST_TABLE,
          Key: { plate_number },
        })
      );

      // Log action in audit_logs table
      const timestamp = new Date().toISOString();
      const putAuditParams = {
        TableName: AUDIT_LOG_TABLE,
        Item: {
          log_id: `log-${Date.now()}`,
          plate_number,
          reason: "Removed from watchlist",
          added_by,
          timestamp,
        },
      };
      await dynamoDB.send(new PutCommand(putAuditParams));
      console.log("Audit log entry created:", putAuditParams.Item);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Plate removed from watchlist" }),
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
