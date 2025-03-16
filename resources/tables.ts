import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class Tables {
  public readonly watchlistTable: dynamodb.Table;
  public readonly auditLogTable: dynamodb.Table;

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
  }
}
