import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class Tables {
  public readonly watchlistTable: dynamodb.Table;

  constructor(scope: Construct, stage: string) {
    this.watchlistTable = new dynamodb.Table(scope, `WatchlistTable-${stage}`, {
      tableName: `global_watchlist_${stage}`, // Unique name per stage
      partitionKey: {
        name: "plate_number",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto-scaling
    });
  }
}
