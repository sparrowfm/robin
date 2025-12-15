/**
 * Robin Email Forwarder Lambda
 *
 * Receives emails via SES (stored in S3), parses them, and forwards
 * to distribution list subscribers stored in SSM Parameter Store.
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { simpleParser } = require('mailparser');

const s3 = new S3Client({ region: 'us-east-1' });
const ses = new SESClient({ region: 'us-east-1' });
const ssm = new SSMClient({ region: 'us-east-1' });

const BUCKET = process.env.EMAIL_BUCKET;
const DOMAIN = 'chirpy.studio';

/**
 * Get subscribers for a distribution list from SSM Parameter Store
 */
async function getSubscribers(listName) {
  try {
    const response = await ssm.send(new GetParameterCommand({
      Name: `/robin/lists/${listName}`,
      WithDecryption: true
    }));
    return JSON.parse(response.Parameter.Value);
  } catch (error) {
    console.error(`Failed to get subscribers for ${listName}:`, error);
    return [];
  }
}

/**
 * Determine which list an email is addressed to
 */
function getListName(recipient) {
  const localPart = recipient.split('@')[0].toLowerCase();
  if (localPart === 'alerts') return 'alerts';
  if (localPart === 'info') return 'info';
  return null;
}

/**
 * Forward email to a list of subscribers
 */
async function forwardEmail(rawEmail, originalRecipient, subscribers) {
  if (subscribers.length === 0) {
    console.log('No subscribers, skipping forward');
    return;
  }

  // Parse the email
  const parsed = await simpleParser(rawEmail);

  const fromAddress = parsed.from?.text || 'unknown sender';
  const subject = parsed.subject || '(no subject)';
  const textBody = parsed.text || '';
  const htmlBody = parsed.html || '';

  // Build forwarded email
  const forwardSubject = `[${originalRecipient}] ${subject}`;

  // Create MIME message
  const boundary = `----=_Part_${Date.now()}`;

  let mimeMessage = [
    `From: "${originalRecipient}" <noreply@${DOMAIN}>`,
    `Reply-To: ${fromAddress}`,
    `To: ${subscribers.join(', ')}`,
    `Subject: ${forwardSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    `---------- Forwarded message ----------`,
    `From: ${fromAddress}`,
    `To: ${originalRecipient}`,
    `Subject: ${subject}`,
    ``,
    textBody,
  ];

  if (htmlBody) {
    mimeMessage = mimeMessage.concat([
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      `<div style="border-left: 2px solid #ccc; padding-left: 10px; margin-bottom: 20px; color: #666;">`,
      `<strong>---------- Forwarded message ----------</strong><br>`,
      `From: ${fromAddress}<br>`,
      `To: ${originalRecipient}<br>`,
      `Subject: ${subject}`,
      `</div>`,
      htmlBody,
    ]);
  }

  mimeMessage.push(`--${boundary}--`);

  const rawMessage = mimeMessage.join('\r\n');

  // Send via SES
  await ses.send(new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage)
    }
  }));

  console.log(`Forwarded email from ${fromAddress} to ${subscribers.length} subscribers`);
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing email from s3://${bucket}/${key}`);

    // Get the raw email from S3
    const s3Response = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }));

    const rawEmail = await s3Response.Body.transformToString();

    // Parse to get recipient
    const parsed = await simpleParser(rawEmail);
    const recipients = parsed.to?.value || [];

    for (const recipient of recipients) {
      const email = recipient.address;
      const listName = getListName(email);

      if (!listName) {
        console.log(`Unknown recipient: ${email}, skipping`);
        continue;
      }

      console.log(`Email to ${listName} list (${email})`);

      const subscribers = await getSubscribers(listName);
      console.log(`Found ${subscribers.length} subscribers`);

      await forwardEmail(rawEmail, email, subscribers);
    }
  }

  return { statusCode: 200, body: 'OK' };
};
