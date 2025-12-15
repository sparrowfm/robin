#!/bin/bash
# Add an email to a chirpy.studio distribution list
# Usage: ./alerts-add.sh <email> [list]
# Lists: alerts (default), info

set -e

REGION="us-east-1"

if [ -z "$1" ]; then
  echo "Usage: $0 <email> [list]"
  echo "Example: $0 user@example.com"
  echo "Example: $0 user@example.com info"
  echo ""
  echo "Lists: alerts (default), info"
  exit 1
fi

EMAIL="$1"
LIST="${2:-alerts}"

case "$LIST" in
  alerts|info)
    PARAM_NAME="/robin/lists/${LIST}"
    LIST_EMAIL="${LIST}@chirpy.studio"
    ;;
  *)
    echo "Error: Unknown list '$LIST'. Valid lists: alerts, info"
    exit 1
    ;;
esac

echo "Adding $EMAIL to $LIST_EMAIL..."

# Get current list (or empty array if doesn't exist)
current=$(aws ssm get-parameter \
  --name "$PARAM_NAME" \
  --region "$REGION" \
  --query 'Parameter.Value' \
  --output text 2>/dev/null || echo "[]")

# Check if already subscribed
if echo "$current" | jq -e "index(\"$EMAIL\")" > /dev/null 2>&1; then
  echo "$EMAIL is already subscribed to $LIST_EMAIL"
  exit 0
fi

# Add email to list
updated=$(echo "$current" | jq ". + [\"$EMAIL\"]")

# Save back to SSM
aws ssm put-parameter \
  --name "$PARAM_NAME" \
  --type "String" \
  --value "$updated" \
  --overwrite \
  --region "$REGION" > /dev/null

echo "Done. $EMAIL added to $LIST_EMAIL"
echo ""
echo "Note: No confirmation email needed - they will start receiving forwards immediately."
