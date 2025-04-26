const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { parse } = require("path");

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE;
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE;

const API_KEY_MAP = {
  RbC1Fostw07gDZQNEhqYz1UEKySIRKwE7mkMf7Hs: "dev",
};

const DEMO_WEBHOOK_URL = "";

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { httpMethod, body, headers, pathParameters, resource } = event;

    const apiKey = headers["x-api-key"];
    if (!apiKey || !API_KEY_MAP[apiKey]) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
    const added_by = API_KEY_MAP[apiKey];

    // ========== Internal APIs ==========
    // ---------------------- GET /plates ----------------------
    if (httpMethod === "GET" && resource === "/plates") {
      const { Items } = await dynamoDB.send(
        new ScanCommand({ TableName: WATCHLIST_TABLE })
      );
      const plateNumbers = Items?.map((item) => item.plate_number) || [];
      return { statusCode: 200, body: JSON.stringify(plateNumbers) };
    }

    // ---------------------- GET /plates/{plate_number} ----------------------
    if (httpMethod === "GET" && resource === "/plates/{plate_number}") {
      const plate_number = pathParameters?.plate_number;
      if (!plate_number) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "plate_number is required" }),
        };
      }
      const getPlate = await dynamoDB.send(
        new GetCommand({ TableName: WATCHLIST_TABLE, Key: { plate_number } })
      );
      if (!getPlate.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Plate not found" }),
        };
      }
      return {
        statusCode: 200,
        body: JSON.stringify(getPlate.Item),
      };
    }

    // ---------------------- POST /plates ----------------------
    if (httpMethod === "POST" && resource === "/plates") {
      const { plate_number, reason, webhook_url } = JSON.parse(body || "{}");
      if (!plate_number || !reason) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Missing plate_number or reason" }),
        };
      }

      const webhook = webhook_url || DEMO_WEBHOOK_URL;
      const timestamp = new Date().toISOString();

      const getPlate = await dynamoDB.send(
        new GetCommand({ TableName: WATCHLIST_TABLE, Key: { plate_number } })
      );

      if (getPlate.Item) {
        const existingWebhooks = getPlate.Item.webhooks || [];
        if (!existingWebhooks.includes(webhook)) {
          existingWebhooks.push(webhook);
          await dynamoDB.send(
            new PutCommand({
              TableName: WATCHLIST_TABLE,
              Item: { ...getPlate.Item, webhooks: existingWebhooks },
            })
          );
        }
      } else {
        await dynamoDB.send(
          new PutCommand({
            TableName: WATCHLIST_TABLE,
            Item: { plate_number, reason, webhooks: [webhook] },
          })
        );
      }

      await dynamoDB.send(
        new PutCommand({
          TableName: AUDIT_LOG_TABLE,
          Item: {
            log_id: `log-${Date.now()}`,
            plate_number,
            reason,
            added_by,
            timestamp,
          },
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Plate created/updated" }),
      };
    }

    // ---------------------- DELETE /plates/{plate_number} ----------------------
    if (httpMethod === "DELETE" && resource === "/plates/{plate_number}") {
      const plate_number = pathParameters?.plate_number;
      if (!plate_number) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "plate_number is required" }),
        };
      }

      const timestamp = new Date().toISOString();

      await dynamoDB.send(
        new DeleteCommand({ TableName: WATCHLIST_TABLE, Key: { plate_number } })
      );

      await dynamoDB.send(
        new PutCommand({
          TableName: AUDIT_LOG_TABLE,
          Item: {
            log_id: `log-${Date.now()}`,
            plate_number,
            reason: "Manual removal",
            added_by,
            timestamp,
          },
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Plate removed" }),
      };
    }

    // ========== Public APIs ==========
    // ---------------------- POST /plates/{plate_number}/webhooks ----------------------
    if (
      httpMethod === "POST" &&
      resource === "/plates/{plate_number}/webhooks"
    ) {
      const plate_number = pathParameters?.plate_number;
      if (!plate_number) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "plate_number is required" }),
        };
      }

      const { webhook_url } = JSON.parse(body || "{}");
      if (!webhook_url) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "webhook_url is required" }),
        };
      }

      const webhook = webhook_url || DEMO_WEBHOOK_URL; // Default to demo webhook URL if not provided

      const getPlate = await dynamoDB.send(
        new GetCommand({ TableName: WATCHLIST_TABLE, Key: { plate_number } })
      );

      if (getPlate.Item) {
        const existingWebhooks = getPlate.Item.webhooks || [];
        if (!existingWebhooks.includes(webhook)) {
          existingWebhooks.push(webhook);
          await dynamoDB.send(
            new PutCommand({
              TableName: WATCHLIST_TABLE,
              Item: { ...getPlate.Item, webhooks: existingWebhooks },
            })
          );
        }
      } else {
        await dynamoDB.send(
          new PutCommand({
            TableName: WATCHLIST_TABLE,
            Item: {
              plate_number,
              reason: "Auto-created from webhook",
              webhooks: [webhook],
            },
          })
        );
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Webhook registered" }),
      };
    }

    // ---------------------- DELETE /plates/{plate_number}/webhooks ----------------------
    if (
      httpMethod === "DELETE" &&
      resource === "/plates/{plate_number}/webhooks"
    ) {
      const plate_number = pathParameters?.plate_number;
      if (!plate_number) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "plate_number is required" }),
        };
      }

      const { webhook_url } = JSON.parse(body || "{}");
      if (!webhook_url) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "webhook_url is required" }),
        };
      }

      const webhook = webhook_url || DEMO_WEBHOOK_URL; // Default to demo webhook URL if not provided

      const getPlate = await dynamoDB.send(
        new GetCommand({ TableName: WATCHLIST_TABLE, Key: { plate_number } })
      );

      if (!getPlate.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Plate not found" }),
        };
      }

      const updatedWebhooks = (getPlate.Item.webhooks || []).filter(
        (url) => url !== webhook
      );

      if (updatedWebhooks.length === 0) {
        await dynamoDB.send(
          new DeleteCommand({
            TableName: WATCHLIST_TABLE,
            Key: { plate_number },
          })
        );
        return {
          statusCode: 200,
          body: JSON.stringify({ message: "Plate deleted" }),
        };
      }

      await dynamoDB.send(
        new PutCommand({
          TableName: WATCHLIST_TABLE,
          Item: { ...getPlate.Item, webhooks: updatedWebhooks },
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Webhook removed" }),
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
