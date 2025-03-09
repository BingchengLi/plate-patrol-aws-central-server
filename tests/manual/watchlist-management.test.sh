#!/bin/bash

# Set the stage (dev, staging, prod)
STAGE="dev"

# Set API URL based on the stage
API_URL="https://xat4qx9kpj.execute-api.us-east-2.amazonaws.com/$STAGE"

# Test plate number and officer ID
PLATE_NUMBER="XYZ123"
OFFICER_1="officer-1"
REASON_1="stolen"
OFFICER_2="officer-2"
REASON_2="suspicious activity"

echo "Running Manual Tests for Watchlist Management API (Stage: $STAGE)"

# Step 1: Get initial state of the watchlist
echo "-  Initial: Get all plates in watchlist (Before Tests)"
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Step 2: Add a plate to the watchlist
echo "-  Setup: Adding test plate $PLATE_NUMBER to the watchlist"
curl -X POST "$API_URL/plates" \
     -H "Content-Type: application/json" \
     -d "{\"plate_number\": \"$PLATE_NUMBER\", \"officer_id\": \"$OFFICER_1\", \"reason\": \"$REASON_1\"}"
echo -e "\n"

# Step 3: Check watchlist after adding plate
echo "-  Watchlist After Adding Plate:"
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Test 1: Query a plate that is in the watchlist
echo "-  Test 1: Plate is in the watchlist (Expect: match=true)"
curl -X GET "$API_URL/plates/$PLATE_NUMBER" -H "Content-Type: application/json"
echo -e "\n"

# Test 2: Query a plate that is NOT in the watchlist
echo "-  Test 2: Plate is NOT in the watchlist (Expect: empty response)"
curl -X GET "$API_URL/plates/UNKNOWN123" -H "Content-Type: application/json"
echo -e "\n"

# Test 3: Add another officer tracking the plate
echo "-  Test 3: Adding another officer ($OFFICER_2) tracking the same plate"
curl -X POST "$API_URL/plates" \
     -H "Content-Type: application/json" \
     -d "{\"plate_number\": \"$PLATE_NUMBER\", \"officer_id\": \"$OFFICER_2\", \"reason\": \"$REASON_2\"}"
echo -e "\n"

# Check watchlist after adding second officer
echo "-  Watchlist After Adding Second Officer:"
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Test 4: Remove an officer from tracking the plate
echo "-  Test 4: Removing officer ($OFFICER_1) tracking the plate"
curl -X DELETE "$API_URL/plates/$PLATE_NUMBER/officers/$OFFICER_1" -H "Content-Type: application/json"
echo -e "\n"

# Check watchlist after removing one officer
echo "-  Watchlist After Removing First Officer:"
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Test 5: Remove the second officer, which should delete the plate from the watchlist
echo "-  Test 5: Removing last officer ($OFFICER_2), plate should be deleted"
curl -X DELETE "$API_URL/plates/$PLATE_NUMBER/officers/$OFFICER_2" -H "Content-Type: application/json"
echo -e "\n"

# Step 6: Verify that the plate is no longer in the watchlist
echo "-  Step 6: Verify plate is removed from watchlist (Expect: empty response)"
curl -X GET "$API_URL/plates/$PLATE_NUMBER" -H "Content-Type: application/json"
echo -e "\n"

# Final check: Watchlist should now be empty or missing this plate
echo "-  Final: Get all plates in watchlist (After Tests)"
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

echo "Manual Tests Completed"
