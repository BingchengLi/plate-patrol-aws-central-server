import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
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

    // Create Lambda Functions
    const lambdas = new Lambdas(this, watchlistTable.tableName);
    const detectionsLambda = lambdas.detectionsLambda;

    // Create API Gateway **without default `prod`**
    const api = new apigateway.RestApi(this, `PlatePatrolAPI-${stage}`, {
      restApiName: `Plate Patrol Central Server API (${stage})`,
      description: `APIs for Plate Patrol Central Server - Stage: ${stage}`,
      deploy: false, // Do not create a default stage
    });

    // Create a Deployment and Associate it with a Custom Stage (dev, staging, prod)
    const deployment = new apigateway.Deployment(this, `Deployment-${stage}`, {
      api,
    });

    api.deploymentStage = new apigateway.Stage(this, `Stage-${stage}`, {
      deployment,
      stageName: stage,
    });

    // Add `GET /detections/{plate_number}` Endpoint
    api.root
      .addResource("detections")
      .addResource("{plate_number}")
      .addMethod("GET", new apigateway.LambdaIntegration(detectionsLambda));

    // Output base URL of the API Gateway
    new cdk.CfnOutput(this, `ApiUrl-${stage}`, {
      value: api.url,
    });
  }
}
