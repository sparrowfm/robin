# Robin - Email Service

Robin handles email receiving and distribution for chirpy.studio.

## Architecture

```
Email → SES → S3 → Lambda → SES → Subscribers
                      ↓
              SSM Parameter Store
              (subscriber lists)
```

1. SES receives email at `*@chirpy.studio`
2. Email stored in S3 bucket
3. Lambda triggered, parses email
4. Looks up subscribers from SSM Parameter Store
5. Forwards clean email via SES

## Distribution Lists

| Address | SSM Parameter | Purpose |
|---------|---------------|---------|
| alerts@chirpy.studio | `/robin/lists/alerts` | System alerts, monitoring |
| info@chirpy.studio | `/robin/lists/info` | General inquiries |

## AWS Resources

- **Region**: us-east-1
- **S3 Bucket**: `chirpy-robin-emails`
- **Lambda**: `robin-email-forwarder`
- **SES Rule Set**: `chirpy-alerts`
- **SES Rule**: `store-to-s3`
- **SSM Parameters**: `/robin/lists/alerts`, `/robin/lists/info`
- **Route53**: MX record on `chirpy.studio` → `inbound-smtp.us-east-1.amazonaws.com`

## Scripts

```bash
cd robin/scripts

# List subscribers
./alerts-list.sh [alerts|info|all]

# Add subscriber (no confirmation needed)
./alerts-add.sh <email> [alerts|info]

# Remove subscriber
./alerts-remove.sh <email> [alerts|info]
```

## CDK Deployment

```bash
cd robin
npm install
npm run deploy
```

## Adding New Distribution Lists

1. Add recipient to SES rule (AWS Console or CLI)
2. Create SSM parameter: `/robin/lists/{listname}`
3. Update scripts to handle new list name

## Future Functionality

- Outbound email sending (transactional emails)
- Email templates
- Bounce/complaint handling
