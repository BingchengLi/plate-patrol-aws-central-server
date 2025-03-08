#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PlatePatrolAwsCentralServerStack } from "../lib/plate-patrol-aws-central-server-stack";

// Read the stage from CDK context (default to "dev" if not provided)
const app = new cdk.App();
const stage = app.node.tryGetContext("stage") || "dev";

new PlatePatrolAwsCentralServerStack(
  app,
  `PlatePatrolAwsCentralServerStack-${stage}`,
  stage
);
