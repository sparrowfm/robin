#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RobinStack } from './robin-stack';

const app = new cdk.App();

// Environment: 'dev' (default) or 'prod'
const environment = app.node.tryGetContext('environment') || 'dev';
const suffix = environment === 'prod' ? '-prod' : '';

new RobinStack(app, `RobinStack${suffix}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  environment,
});
