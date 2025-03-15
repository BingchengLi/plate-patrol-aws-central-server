import { APIGatewayEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const WATCHLIST_TABLE = process.env.WATCHLIST_TABLE;
const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE;

// Mapping of API keys to user identifiers
// Future improvement: Store this in a secure location like AWS Secrets Manager
const API_KEY_MAP = {
  RbC1Fostw07gDZQNEhqYz1UEKySIRKwE7mkMf7Hs: "dev",
};

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const { httpMethod, body, headers } = event;

    // Extract API Key from headers
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
      return {
        statusCode: 200,
        body: JSON.stringify(Items || []),
      };
    }

    // ================== PUT /plates ==================
    if (httpMethod === "PUT") {
      const { plate_number, reason } = JSON.parse(body || "{}");

      // ✅ Validate required fields
      if (!plate_number || !reason) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Missing required fields: plate_number, reason",
          }),
        };
      }

      const timestamp = new Date().toISOString();
      const log_id = uuidv4();

      // Add plate to watchlist if it doesn't already exist
      const putWatchlistParams = {
        TableName: WATCHLIST_TABLE,
        Item: {
          plate_number,
          reason,
        },
        ConditionExpression: "attribute_not_exists(plate_number)",
      };

      await dynamoDB.send(new PutCommand(putWatchlistParams));

      // Log action in audit_logs table
      const putAuditParams = {
        TableName: AUDIT_LOG_TABLE,
        Item: {
          log_id,
          plate_number,
          reason,
          added_by,
          timestamp,
        },
      };

      await dynamoDB.send(new PutCommand(putAuditParams));

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Plate added to watchlist", log_id }),
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
