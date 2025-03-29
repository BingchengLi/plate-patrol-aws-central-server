const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const UPLOAD_STATUS_TABLE = process.env.UPLOAD_STATUS_TABLE;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2)); // Log incoming request

  try {
    const { image_id, upload_status, metadata } = JSON.parse(event.body);

    if (!image_id || !upload_status) {
      console.error("Missing required fields: image_id or upload_status");
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "image_id and upload_status are required",
        }),
      };
    }

    console.log("Processing upload for image_id:", image_id);
    console.log("New upload_status:", upload_status);

    // Fetch the current record to ensure the image_id exists
    const getParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Key: { image_id },
    };

    const { Item } = await dynamoDB.send(new GetCommand(getParams));

    if (!Item) {
      console.error("No record found for image_id:", image_id);
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: "No record found for the provided image_id",
        }),
      };
    }

    console.log("Existing record:", JSON.stringify(Item, null, 2));

    // Update the upload status in DynamoDB
    const updateParams = {
      TableName: UPLOAD_STATUS_TABLE,
      Key: { image_id },
      UpdateExpression:
        "SET #status = :status, #updated_at = :updated_at, #metadata = :metadata",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updated_at": "updated_at",
        "#metadata": "metadata",
      },
      ExpressionAttributeValues: {
        ":status": upload_status,
        ":updated_at": new Date().toISOString(),
        ":metadata": metadata || {}, // Optional metadata
      },
      ReturnValues: "ALL_NEW",
    };

    const updatedRecord = await dynamoDB.send(new UpdateCommand(updateParams));

    console.log(
      "Updated record:",
      JSON.stringify(updatedRecord.Attributes, null, 2)
    );

    // Respond with success
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Upload status updated successfully",
        data: updatedRecord.Attributes,
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
