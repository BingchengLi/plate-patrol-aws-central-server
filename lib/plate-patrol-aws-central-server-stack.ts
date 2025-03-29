import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { Tables } from "../resources/tables";
import { Lambdas } from "../resources/lambdas";
import * as s3notifications from "aws-cdk-lib/aws-s3-notifications";

export class PlatePatrolAwsCentralServerStack extends cdk.Stack {
  constructor(
    scope: cdk.App,
    id: string,
    stage: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // ============== Tables ==============
    // Create Tables
    const tables = new Tables(this, stage); // Pass stage name to tables
    const watchlistTable = tables.watchlistTable;
    const auditLogTable = tables.auditLogTable;
    const matchLogTable = tables.matchLogTable;
    const uploadStatusTable = tables.uploadStatusTable;

    // ============== S3 Bucket ==============
    // Create S3 Bucket for match uploads
    const s3Bucket = new s3.Bucket(this, `MatchUploadsBucket-${stage}`, {
      bucketName: `match-uploads-${stage}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Do not delete bucket on stack deletion (for security)
    });

    // Note: Commenting out the bucket policy for now - this is for direct uploads
    // Attach S3 Bucket Policy to allow pre-signed uploads
    // s3Bucket.addToResourcePolicy(
    //   new iam.PolicyStatement({
    //     effect: iam.Effect.ALLOW,
    //     principals: [new iam.AnyPrincipal()], // Allows uploads from any pre-signed URL
    //     actions: ["s3:PutObject"],
    //     resources: [`${s3Bucket.bucketArn}/matches/*`], // Restrict to "matches/" folder
    //   })
    // );

    // ============== Lambdas ==============
    // Create Lambda Functions
    const lambdas = new Lambdas(
      this,
      watchlistTable.tableName,
      auditLogTable.tableName,
      matchLogTable.tableName,
      uploadStatusTable.tableName,
      s3Bucket.bucketName
    );
    const detectionsLambda = lambdas.detectionsLambda;
    const watchlistManagementLambda = lambdas.watchlistManagementLambda;
    const chunkUploadProcessingLambda = lambdas.chunkUploadProcessingLambda;

    // Attach S3 Bucket Policy to allow read access
    s3Bucket.grantPut(chunkUploadProcessingLambda); // For uploads
    s3Bucket.grantRead(chunkUploadProcessingLambda); // For headObject

    // ================== API Gateway ==================
    // Create API Gateway without default `prod`
    const api = new apigateway.RestApi(this, `PlatePatrolAPI-${stage}`, {
      restApiName: `Plate Patrol Central Server API (${stage})`,
      description: `APIs for Plate Patrol Central Server - Stage: ${stage}`,
      deploy: false, // Do not create a default stage
    });

    // Create a deployment and associate it with a custom stage (dev, staging, prod)
    const deployment = new apigateway.Deployment(
      this,
      `Deployment-${stage}-${Date.now()}`, // force a new deployment on each stack update
      {
        api,
      }
    );
    const stageDeployment = new apigateway.Stage(this, `Stage-${stage}`, {
      deployment,
      stageName: stage,
    });

    api.deploymentStage = stageDeployment;

    // ================== Resources ==================
    // ----------------- /detections -------------------
    const detectionsResource = api.root.addResource("detections");

    // GET /detections/{plate_number} - should call the Lambda function
    detectionsResource
      .addResource("{plate_number}")
      .addMethod("GET", new apigateway.LambdaIntegration(detectionsLambda));

    // ================== /plates API ==================
    const platesResource = api.root.addResource("plates");

    // GET /plates - Get the list of plates in the watchlist
    // Internal use only
    // TODO: Improve this to require an dev IAM role
    platesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(watchlistManagementLambda)
    );

    // PUT /plates - Public API to add a plate to the watchlist
    platesResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(watchlistManagementLambda),
      {
        apiKeyRequired: true, // Require API Key for PUT
      }
    );

    // DELETE /plates - Internal use only
    platesResource
      .addResource("{plate_number}")
      .addMethod(
        "DELETE",
        new apigateway.LambdaIntegration(watchlistManagementLambda)
      );

    // ================== /uploads API ==================
    const uploadsResource = api.root.addResource("uploads");

    // POST /uploads - Endpoint for chunked image uploads
    uploadsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(chunkUploadProcessingLambda)
    );

    // ================== S3 Trigger ==================
    // Note: This is for direct uploads to S3, commented out for now
    // Attach S3 event notification to trigger the upload processing Lambda
    // s3Bucket.addEventNotification(
    //   s3.EventType.OBJECT_CREATED,
    //   new s3notifications.LambdaDestination(lambdas.uploadProcessingLambda)
    // );

    // s3Bucket.grantPut(uploadProcessingLambda); // For uploads
    // s3Bucket.grantRead(uploadProcessingLambda); // For headObject

    // ================== Output ==================
    // Output base URL of the API Gateway
    new cdk.CfnOutput(this, `ApiUrl-${stage}`, {
      value: api.url,
    });
  }
}
