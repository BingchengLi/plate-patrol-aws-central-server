import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class Tables {
  public readonly watchlistTable: dynamodb.Table;
  public readonly auditLogTable: dynamodb.Table;
  public readonly matchLogTable: dynamodb.Table;
  public readonly uploadStatusTable: dynamodb.Table;

  constructor(scope: Construct, stage: string) {
    // Watchlist Table - for storing watchlist data
    this.watchlistTable = new dynamodb.Table(scope, `WatchlistTable-${stage}`, {
      tableName: `global_watchlist_${stage}`, // Unique name per stage
      partitionKey: {
        name: "plate_number",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto-scaling
    });

    // Audit Log Table - for tracking changes to the watchlist
    this.auditLogTable = new dynamodb.Table(scope, `AuditLogTable-${stage}`, {
      tableName: `audit_logs_${stage}`,
      partitionKey: {
        name: "log_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "timestamp",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Match Log Table - for tracking matches between detections and the watchlist
    this.matchLogTable = new dynamodb.Table(scope, `MatchLogTable-${stage}`, {
      tableName: `match_logs_${stage}`,
      partitionKey: {
        name: "match_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "plate_number",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Upload Status Table - for tracking chunked uploads
    this.uploadStatusTable = new dynamodb.Table(
      scope,
      `UploadStatusTable-${stage}`,
      {
        tableName: `upload_status_${stage}`, // Unique name per stage
        partitionKey: {
          name: "image_id", // Unique ID for each image
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto-scaling
      }
    );
  }
}
