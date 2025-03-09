#!/bin/bash

# Set the stage (dev, staging, prod)
STAGE="dev"

# Set API URL based on the stage
API_URL="https://xat4qx9kpj.execute-api.us-east-2.amazonaws.com/$STAGE"

# Use a unique DynamoDB table name per stage
TABLE_NAME="global_watchlist_$STAGE"

# Test plate number
PLATE_NUMBER="XYZ123"

echo "Running Manual Tests for GET /detections/{plate_number} API (Stage: $STAGE)"

# Step 1: Define the item for DynamoDB
ITEM=$(cat <<EOF
{
    "plate_number": { "S": "$PLATE_NUMBER" },
    "tracking_info": {
        "M": {
            "officer-1": {
                "M": {
                    "reason": { "S": "stolen" }
                }
            }
        }
    }
}
EOF
)

# Step 2: Add a plate to the watchlist before running tests
echo "-  Setup: Adding test plate $PLATE_NUMBER to the watchlist in table $TABLE_NAME"
aws dynamodb put-item --table-name "$TABLE_NAME" --item "$ITEM" >/dev/null
echo "Plate $PLATE_NUMBER added to $TABLE_NAME"

# Test 1: Query a plate that is in the watchlist
echo "-  Test 1: Plate is in the watchlist (Expect: match=true)"
curl -X GET "$API_URL/detections/$PLATE_NUMBER" -H "Content-Type: application/json"
echo -e "\n"

# Test 2: Query a plate that is NOT in the watchlist
echo "-  Test 2: Plate is NOT in the watchlist (Expect: match=false)"
curl -X GET "$API_URL/detections/UNKNOWN123" -H "Content-Type: application/json"
echo -e "\n"

# Test 3: Query with missing plate_number (Expect: error)
echo "-  Test 3: Missing plate_number (Expect: error)"
curl -X GET "$API_URL/detections" -H "Content-Type: application/json"
echo -e "\n"

# Step 4: Remove the test plate from the watchlist after tests
echo "-  Cleanup: Removing test plate $PLATE_NUMBER to restore clean state"
aws dynamodb delete-item --table-name "$TABLE_NAME" --key "{\"plate_number\": {\"S\": \"$PLATE_NUMBER\"}}" >/dev/null
echo "Plate $PLATE_NUMBER removed from $TABLE_NAME"

echo "Manual Tests Completed"
