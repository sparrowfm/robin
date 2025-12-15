#!/bin/bash
# List all subscribers to a chirpy.studio distribution list
# Usage: ./alerts-list.sh [list]
# Lists: alerts (default), info, all

set -e

REGION="us-east-1"
LIST="${1:-alerts}"

list_subscribers() {
  local list_name="$1"
  local list_email="${list_name}@chirpy.studio"

  echo "$list_email subscribers:"
  echo "======================================"

  result=$(aws ssm get-parameter \
    --name "/robin/lists/${list_name}" \
    --region "$REGION" \
    --query 'Parameter.Value' \
    --output text 2>/dev/null || echo "[]")

  if [ "$result" = "[]" ] || [ -z "$result" ]; then
    echo "  (no subscribers)"
  else
    echo "$result" | jq -r '.[]' | while read -r email; do
      echo "  - $email"
    done
  fi
  echo ""
}

case "$LIST" in
  alerts)
    list_subscribers "alerts"
    ;;
  info)
    list_subscribers "info"
    ;;
  all)
    list_subscribers "alerts"
    list_subscribers "info"
    ;;
  *)
    echo "Error: Unknown list '$LIST'. Valid lists: alerts, info, all"
    exit 1
    ;;
esac
