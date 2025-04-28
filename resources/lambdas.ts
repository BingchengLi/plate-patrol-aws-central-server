import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export class Lambdas {
  public readonly detectionsLambda: lambda.Function;
  public readonly watchlistManagementLambda: lambda.Function;
  public readonly uploadProcessingLambda: lambda.Function;
  public readonly chunkUploadProcessingLambda: lambda.Function;
  public readonly assemblyLambda: lambda.Function;

  constructor(
    scope: Construct,
    watchlistTable: string,
    auditLogTable: string,
    matchLogTable: string,
    uploadStatusTable: string,
    s3Bucket: string
  ) {
    // ================== Detections Lambda ==================
    // Define /detections Lambda
    this.detectionsLambda = new lambda.Function(scope, "DetectionsLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambdas/detections")
      ), // Path to Lambda
      environment: {
        WATCHLIST_TABLE: watchlistTable,
        UPLOAD_STATUS_TABLE: uploadStatusTable,
      },
    });

    // Grant Lambda permissions to read from watchlist DynamoDB table
    this.detectionsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem"],
        resources: [`arn:aws:dynamodb:*:*:table/${watchlistTable}`],
      })
    );

    // Gramt Lambda permissions to write to upload status DynamoDB table
    this.detectionsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [`arn:aws:dynamodb:*:*:table/${uploadStatusTable}`],
      })
    );

    // Grant Lambda permissions to generate pre-signed S3 URLs
    this.detectionsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: [`arn:aws:s3:::${s3Bucket}/*`],
      })
    );

    // ================== Watchlist Management Lambda ==================
    // Define /watchlist-management Lambda
    this.watchlistManagementLambda = new lambda.Function(
      scope,
      "WatchlistManagementLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambdas/watchlist-management")
        ),
        environment: {
          WATCHLIST_TABLE: watchlistTable,
          AUDIT_LOG_TABLE: auditLogTable,
        },
      }
    );

    // Grant Lambda permissions to read, write, update, and delete from watchlist DynamoDB table
    this.watchlistManagementLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
        ],
        resources: [`arn:aws:dynamodb:*:*:table/${watchlistTable}`],
      })
    );

    // Grant Lambda permissions to write to audit log DynamoDB table
    this.watchlistManagementLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [`arn:aws:dynamodb:*:*:table/${auditLogTable}`],
      })
    );

    // ================== Upload Processing Lambda ==================
    // Define upload-processing Lambda (triggered by S3 upload)
    this.uploadProcessingLambda = new lambda.Function(
      scope,
      "UploadProcessingLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambdas/upload-processing")
        ),
        environment: {
          MATCH_LOG_TABLE: matchLogTable,
        },
      }
    );

    // Grant Lambda permissions to write to match log DynamoDB table
    this.uploadProcessingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [`arn:aws:dynamodb:*:*:table/${matchLogTable}`],
      })
    );

    // Grant Lambda permissions to read from S3 bucket
    this.uploadProcessingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`arn:aws:s3:::${s3Bucket}/*`],
      })
    );

    // ========================= Assembly Lambda ==========================
    // Define assembly Lambda (triggered by ChunkUploadProcessingLambda)
    this.assemblyLambda = new lambda.Function(scope, "AssemblyLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambdas/assembly")),
      timeout: cdk.Duration.seconds(10), // Adjust timeout as needed
      environment: {
        MATCH_LOG_TABLE: matchLogTable,
        UPLOAD_STATUS_TABLE: uploadStatusTable,
        S3_BUCKET: s3Bucket,
      },
    });

    // Grant Lambda permissions to read and write to upload status DynamoDB table
    this.assemblyLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ],
        resources: [`arn:aws:dynamodb:*:*:table/${uploadStatusTable}`],
      })
    );

    // Grant Lambda permissions to write to match log DynamoDB table
    this.assemblyLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem"],
        resources: [`arn:aws:dynamodb:*:*:table/${matchLogTable}`],
      })
    );

    // Grant Lambda permissions to read and delete from S3 bucket
    this.assemblyLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:DeleteObject"], // Read and delete access
        resources: [`arn:aws:s3:::${s3Bucket}/uploads/*`], // Restrict to "uploads" folder
      })
    );

    // Grant Lambda permissions to write the final image to the "images/" folder
    this.assemblyLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [`arn:aws:s3:::${s3Bucket}/images/*`], // Restrict to "images" folder
      })
    );

    // ================== Chunk Upload Processing Lambda ==================
    // Define chunk-upload-processing Lambda (triggered by API Gateway)
    this.chunkUploadProcessingLambda = new lambda.Function(
      scope,
      "ChunkUploadProcessingLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler", // Adjust if your handler is named differently
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambdas/chunk-upload-processing")
        ), // Path to Lambda code
        environment: {
          S3_BUCKET: s3Bucket,
          MATCH_LOG_TABLE: matchLogTable,
          UPLOAD_STATUS_TABLE: uploadStatusTable,
          ASSEMBLY_LAMBDA: this.assemblyLambda.functionName,
        },
      }
    );

    // Grant Lambda permissions to read and write to upload status DynamoDB table
    this.chunkUploadProcessingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ],
        resources: [`arn:aws:dynamodb:*:*:table/${uploadStatusTable}`],
      })
    );

    // Grant Lambda permissions to read and write to S3 bucket (/uploads/*)
    this.chunkUploadProcessingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [`arn:aws:s3:::${s3Bucket}/uploads/*`], // Restrict to "uploads" folder
      })
    );

    // Grant Lambda permissions to invoke the assembly Lambda
    this.chunkUploadProcessingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [
          `arn:aws:lambda:*:*:function:${this.assemblyLambda.functionName}`,
        ],
      })
    );
  }
}
