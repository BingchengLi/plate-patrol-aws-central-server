import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class Tables {
  public readonly watchlistTable: dynamodb.Table;

  constructor(scope: Construct) {
    // Define the Global Watchlist Table
    this.watchlistTable = new dynamodb.Table(scope, "WatchlistTable", {
      tableName: "global_watchlist",
      partitionKey: {
        name: "plate_number",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto scaling
    });
  }
}
