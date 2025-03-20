const AWS = require("@aws-sdk/client-s3");
const { S3Client, GetObjectCommand } = AWS;
const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const ExifParser = require("exif-parser");
const { Readable } = require("stream");

const s3 = new S3Client();
const dynamoDB = new DynamoDBClient();
const TABLE_NAME = process.env.MATCH_LOG_TABLE;

exports.handler = async (event) => {
  console.log("Received S3 event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const plate_number = key.split("/")[1].split("-")[0];

    console.log(`Processing new upload: s3://${bucket}/${key}`);

    try {
      // Download the image from S3
      const { Body } = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      const imageBuffer = await streamToBuffer(Body);
      console.log(
        `Downloaded image: ${key}, size: ${imageBuffer.length} bytes`
      );

      // Parse EXIF metadata
      const parser = ExifParser.create(imageBuffer);
      const exifData = parser.parse();
      console.log("Extracted EXIF metadata:", exifData);

      // Extract GPS Metadata
      let latitude = null,
        longitude = null;
      if (exifData.tags.GPSLatitude && exifData.tags.GPSLongitude) {
        latitude = _convertGPS(
          exifData.tags.GPSLatitude,
          exifData.tags.GPSLatitudeRef
        );
        longitude = _convertGPS(
          exifData.tags.GPSLongitude,
          exifData.tags.GPSLongitudeRef
        );
        console.log(`Extracted GPS: ${latitude}, ${longitude}`);
      } else {
        console.warn(`No GPS metadata found for ${key}`);
      }

      // Extract Timestamp
      let timestamp = null;
      if (exifData.tags.DateTimeOriginal) {
        timestamp = new Date(
          exifData.tags.DateTimeOriginal * 1000
        ).toISOString();
        console.log(`Extracted Timestamp: ${timestamp}`);
      } else {
        console.warn(`No timestamp found in EXIF data for ${key}`);
      }

      // Store metadata in DynamoDB
      const params = {
        TableName: TABLE_NAME,
        Item: {
          match_id: { S: key },
          plate_number: { S: plate_number },
          bucket_name: { S: bucket },
          file_path: { S: key },
          gps_location:
            latitude !== null && longitude !== null
              ? {
                  M: {
                    latitude: { N: latitude.toString() },
                    longitude: { N: longitude.toString() },
                  },
                }
              : { NULL: true },
          timestamp: timestamp ? { S: timestamp } : { NULL: true },
        },
      };

      await dynamoDB.send(new PutItemCommand(params));
      console.log(`Logged match event: ${key}`);
    } catch (error) {
      console.error("Error processing image metadata:", error);
    }
  }

  return { statusCode: 200, body: "Match event logged successfully" };
};

// Helper function to convert a readable stream to a buffer
const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

// Helper function to convert EXIF GPS format to decimal degrees
const _convertGPS = (gpsData, ref) => {
  if (!gpsData || gpsData.length !== 3) return null;
  const [degrees, minutes, seconds] = gpsData;
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === "S" || ref === "W") decimal = -decimal; // South and West are negative
  return decimal;
};
