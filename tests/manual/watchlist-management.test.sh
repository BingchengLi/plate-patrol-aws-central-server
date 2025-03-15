#!/bin/bash

############################################
# Manual Tests for Watchlist Management API
#! Warning: This test is outdated and needs to be updated
############################################

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

echo "===== Running Manual Tests for Watchlist Management API (Stage: $STAGE) ====="

# Step 1: Get initial state of the watchlist
echo "🚀 Step 1: Checking the initial watchlist state"
echo "Expected: Either an empty list or previously added plates."
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Step 2: Add a plate to the watchlist
echo "🛠 Step 2: Adding plate ($PLATE_NUMBER) to the watchlist with officer ($OFFICER_1) and reason ($REASON_1)."
echo "Expected: Success message confirming the plate was added."
curl -X POST "$API_URL/plates" \
     -H "Content-Type: application/json" \
     -d "{\"plate_number\": \"$PLATE_NUMBER\", \"officer_id\": \"$OFFICER_1\", \"reason\": \"$REASON_1\"}"
echo -e "\n"

# Step 3: Verify plate was added
echo "🔍 Step 3: Fetching all plates in the watchlist after adding plate ($PLATE_NUMBER)."
echo "Expected: The watchlist should now contain $PLATE_NUMBER."
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Test 1: Query a plate that exists in the watchlist
echo "✅ Test 1: Checking if the watchlist correctly returns details for plate ($PLATE_NUMBER)."
echo "Expected: The response should include officer ($OFFICER_1) tracking the plate."
curl -X GET "$API_URL/plates/$PLATE_NUMBER" -H "Content-Type: application/json"
echo -e "\n"

# Test 2: Query a plate that does NOT exist
echo "❌ Test 2: Querying a plate (UNKNOWN123) that should NOT exist in the watchlist."
echo "Expected: An empty response or a message indicating no data found."
curl -X GET "$API_URL/plates/UNKNOWN123" -H "Content-Type: application/json"
echo -e "\n"

# Test 3: Add another officer tracking the same plate
echo "➕ Test 3: Adding another officer ($OFFICER_2) tracking the same plate ($PLATE_NUMBER) with reason ($REASON_2)."
echo "Expected: Success message confirming that the officer was added to the plate's tracking list."
curl -X POST "$API_URL/plates" \
     -H "Content-Type: application/json" \
     -d "{\"plate_number\": \"$PLATE_NUMBER\", \"officer_id\": \"$OFFICER_2\", \"reason\": \"$REASON_2\"}"
echo -e "\n"

# Verify second officer was added
echo "🔍 Step 4: Fetching all plates in the watchlist after adding second officer ($OFFICER_2)."
echo "Expected: The plate ($PLATE_NUMBER) should now be tracked by both officers ($OFFICER_1, $OFFICER_2)."
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Test 4: Remove the first officer tracking the plate
echo "🗑 Test 4: Removing officer ($OFFICER_1) from tracking plate ($PLATE_NUMBER)."
echo "Expected: Success message confirming officer ($OFFICER_1) was removed."
curl -X DELETE "$API_URL/plates/$PLATE_NUMBER/officers/$OFFICER_1" -H "Content-Type: application/json"
echo -e "\n"

# Verify watchlist after removing first officer
echo "🔍 Step 5: Fetching all plates in the watchlist after removing officer ($OFFICER_1)."
echo "Expected: The plate should still exist but only tracked by officer ($OFFICER_2)."
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

# Test 5: Remove the last remaining officer, which should delete the plate from the watchlist
echo "🚨 Test 5: Removing last officer ($OFFICER_2), which should remove plate ($PLATE_NUMBER) from the watchlist."
echo "Expected: Success message confirming the plate was removed from the watchlist."
curl -X DELETE "$API_URL/plates/$PLATE_NUMBER/officers/$OFFICER_2" -H "Content-Type: application/json"
echo -e "\n"

# Step 6: Verify that the plate is no longer in the watchlist
echo "🔍 Step 6: Checking that plate ($PLATE_NUMBER) was completely removed from the watchlist."
echo "Expected: Empty response or message confirming the plate does not exist."
curl -X GET "$API_URL/plates/$PLATE_NUMBER" -H "Content-Type: application/json"
echo -e "\n"

# Final check: Ensure the watchlist is now empty or missing the removed plate
echo "📋 Final Check: Fetching all plates in the watchlist after removing ($PLATE_NUMBER)."
echo "Expected: The plate should NOT appear in the list."
curl -X GET "$API_URL/plates" -H "Content-Type: application/json"
echo -e "\n"

echo "🎉 Manual Tests Completed Successfully"
