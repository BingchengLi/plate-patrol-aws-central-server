import request from "supertest";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const STAGE = process.env.STAGE || "dev";
const API_URL = `${API_BASE_URL}/${STAGE}`;
console.log("API_URL: ", API_URL);

const VALID_API_KEY = process.env.VALID_API_KEY || "";
console.log("VALID_API_KEY: ", VALID_API_KEY);
const INVALID_API_KEY = "invalid-api-key";
const TEST_PLATE_NUMBER = "ABC123";
const TEST_REASON = "Suspicious vehicle";
