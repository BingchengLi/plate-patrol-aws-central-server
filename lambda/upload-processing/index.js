const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.MATCH_LOG_TABLE;

exports.handler = async (event) => {
  console.log("Received S3 event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    console.log(`Processing new upload: s3://${bucket}/${key}`);

    try {
      // Extract metadata using S3 headObject
      const metadataResponse = await s3
        .headObject({ Bucket: bucket, Key: key })
        .promise();
      console.log("Extracted metadata:", metadataResponse);

      // Extract custom metadata
      const customMetadata = metadataResponse.Metadata;
      const gps_location = customMetadata.gps_location;
      const timestamp = customMetadata.timestamp;
      console.log("Extracted gps_location:", gps_location);
      console.log("Extracted timestamp:", timestamp);

      // Log match event as if notifying a tip line (but not actually notifying)
      const params = {
        TableName: TABLE_NAME,
        Item: {
          match_id: key, // Using S3 object key as unique ID
          bucket_name: bucket,
          file_path: key,
          gps_location,
          timestamp,
        },
      };

      await dynamoDB.put(params).promise();
      console.log(`Logged match event: ${key}`);
    } catch (error) {
      console.error("Error extracting metadata or logging match:", error);
    }
  }

  return { statusCode: 200, body: "Match event logged successfully" };
};
