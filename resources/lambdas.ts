import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";

export class Lambdas {
  public readonly detectionsLambda: lambda.Function;

  constructor(scope: Construct, watchlistTable: string, s3Bucket: string) {
    // Define /detections Lambda
    this.detectionsLambda = new lambda.Function(scope, "DetectionsLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/detections")), // Path to Lambda
      environment: {
        WATCHLIST_TABLE: watchlistTable,
        S3_BUCKET: s3Bucket,
      },
    });

    // Grant Lambda permissions to read from DynamoDB
    this.detectionsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem"],
        resources: [`arn:aws:dynamodb:*:*:table/${watchlistTable}`],
      })
    );

    // Grant Lambda permissions to generate pre-signed S3 URLs
    this.detectionsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [`arn:aws:s3:::${s3Bucket}/*`],
      })
    );
  }
}
