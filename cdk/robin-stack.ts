import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

export class RobinStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for incoming emails
    const emailBucket = new s3.Bucket(this, 'EmailBucket', {
      bucketName: 'chirpy-robin-emails',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(7), // Auto-delete after 7 days
        },
      ],
    });

    // Lambda function for email forwarding (NodejsFunction bundles dependencies)
    const forwarderFn = new NodejsFunction(this, 'ForwarderFunction', {
      functionName: 'robin-email-forwarder',
      runtime: Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/forwarder.js'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        EMAIL_BUCKET: emailBucket.bucketName,
      },
      bundling: {
        externalModules: ['@aws-sdk/*'], // AWS SDK is built into Lambda runtime
      },
    });

    // Grant Lambda permissions
    emailBucket.grantRead(forwarderFn);

    // SES send permission
    forwarderFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendRawEmail'],
      resources: ['*'],
    }));

    // SSM read permission for subscriber lists
    forwarderFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:us-east-1:${this.account}:parameter/robin/lists/*`,
      ],
    }));

    // S3 trigger for Lambda
    emailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(forwarderFn),
      { prefix: 'incoming/' }
    );

    // Grant SES permission to write to S3
    emailBucket.addToResourcePolicy(new iam.PolicyStatement({
      principals: [new iam.ServicePrincipal('ses.amazonaws.com')],
      actions: ['s3:PutObject'],
      resources: [`${emailBucket.bucketArn}/*`],
      conditions: {
        StringEquals: {
          'AWS:SourceAccount': this.account,
        },
      },
    }));

    // Outputs
    new cdk.CfnOutput(this, 'EmailBucketName', {
      value: emailBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'ForwarderFunctionArn', {
      value: forwarderFn.functionArn,
    });
  }
}
