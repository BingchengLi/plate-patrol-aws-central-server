import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Tables } from "../resources/tables";
import { Lambdas } from "../resources/lambdas";

export class PlatePatrolAwsCentralServerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Tables
    const tables = new Tables(this);
    const watchlistTable = tables.watchlistTable;

    // Create Lambda Functions
    const lambdas = new Lambdas(this, watchlistTable.tableName);
    const detectionsLambda = lambdas.detectionsLambda;

    // Create API Gateway
    const api = new apigateway.RestApi(this, "PlatePatrolCentralServerAPI", {
      restApiName: "Plate Patrol Central Server API",
      description: "APIs for Plate Patrol Central Server",
    });

    // Add `GET /detections/{plate_number}` Endpoint
    api.root
      .addResource("detections")
      .addResource("{plate_number}")
      .addMethod("GET", new apigateway.LambdaIntegration(detectionsLambda));

    // Output API Gateway URL
    new cdk.CfnOutput(this, "ApiUrl", { value: api.url });
  }
}
