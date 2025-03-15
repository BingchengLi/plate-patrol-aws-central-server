import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Tables } from "../resources/tables";
import { Lambdas } from "../resources/lambdas";

export class PlatePatrolAwsCentralServerStack extends cdk.Stack {
  constructor(
    scope: cdk.App,
    id: string,
    stage: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // Create Tables
    const tables = new Tables(this, stage); // Pass stage name to tables
    const watchlistTable = tables.watchlistTable;
    const auditLogTable = tables.auditLogTable;

    // Create S3 Bucket for match uploads
    const s3Bucket = new s3.Bucket(this, `MatchUploadsBucket-${stage}`, {
      bucketName: `match-uploads-${stage}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Do not delete bucket on stack deletion (for security)
    });

    // Create Lambda Functions
    const lambdas = new Lambdas(
      this,
      watchlistTable.tableName,
      auditLogTable.tableName,
      s3Bucket.bucketName
    );
    const detectionsLambda = lambdas.detectionsLambda;
    const watchlistManagementLambda = lambdas.watchlistManagementLambda;

    // Create API Gateway **without default `prod`**
    const api = new apigateway.RestApi(this, `PlatePatrolAPI-${stage}`, {
      restApiName: `Plate Patrol Central Server API (${stage})`,
      description: `APIs for Plate Patrol Central Server - Stage: ${stage}`,
      deploy: false, // Do not create a default stage
    });

    // Create a Deployment and Associate it with a Custom Stage (dev, staging, prod)
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
    // GET /detections - should return a 400 error
    const detectionsResource = api.root.addResource("detections");
    detectionsResource.addMethod(
      "GET",
      new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: "400",
            responseTemplates: {
              "application/json": `{"error": "plate_number is required"}`,
            },
          },
        ],
        requestTemplates: { "application/json": `{}` },
      }),
      { methodResponses: [{ statusCode: "400" }] }
    );

    // GET /detections/{plate_number} - should call the Lambda function
    detectionsResource
      .addResource("{plate_number}")
      .addMethod("GET", new apigateway.LambdaIntegration(detectionsLambda));

    // ================== /plates API ==================
    const platesResource = api.root.addResource("plates");

    // GET /plates - Internal use only
    platesResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(watchlistManagementLambda),
      { authorizationType: apigateway.AuthorizationType.IAM } // Restrict to internal use
    );

    // PUT /plates - Public API to add a plate to the watchlist
    platesResource.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(watchlistManagementLambda),
      {
        apiKeyRequired: true, // Require API Key for PUT
      }
    );

    // Output base URL of the API Gateway
    new cdk.CfnOutput(this, `ApiUrl-${stage}`, {
      value: api.url,
    });
  }
}
