require("dotenv").config();
const axios = require("axios");

const STAGE = process.env.STAGE;
const API_URL = `${process.env.API_URL}/${STAGE}/plates`;

const PLATE_NUMBER = "XYZ123";
const OFFICER_1 = "officer-1";
const REASON_1 = "stolen";
const OFFICER_2 = "officer-2";
const REASON_2 = "suspicious activity";

describe("Watchlist API Tests", () => {
  beforeAll(async () => {
    // Cleanup: Remove plate from the watchlist before running tests
    await axios
      .delete(`${API_URL}/${PLATE_NUMBER}/officers/${OFFICER_1}`)
      .catch(() => {});
    await axios
      .delete(`${API_URL}/${PLATE_NUMBER}/officers/${OFFICER_2}`)
      .catch(() => {});
  });

  afterAll(async () => {
    // Cleanup: Ensure test data is removed after tests
    await axios
      .delete(`${API_URL}/${PLATE_NUMBER}/officers/${OFFICER_1}`)
      .catch(() => {});
    await axios
      .delete(`${API_URL}/${PLATE_NUMBER}/officers/${OFFICER_2}`)
      .catch(() => {});
  });

  test("Should add a plate to the watchlist", async () => {
    const response = await axios.post(API_URL, {
      plate_number: PLATE_NUMBER,
      officer_id: OFFICER_1,
      reason: REASON_1,
    });

    expect(response.status).toBe(200);
    expect(response.data.message).toMatch(
      /Plate added to global watchlist|Plate already tracked, officer added/
    );
  });

  test("Should verify the plate exists in the watchlist", async () => {
    const response = await axios.get(API_URL);
    const plates = response.data;

    const plateExists = plates.some(
      (entry) => entry.plate_number === PLATE_NUMBER
    );
    expect(plateExists).toBe(true);
  });

  test("Should add another officer tracking the same plate", async () => {
    const response = await axios.post(API_URL, {
      plate_number: PLATE_NUMBER,
      officer_id: OFFICER_2,
      reason: REASON_2,
    });

    expect(response.status).toBe(200);
    expect(response.data.message).toBe("Plate already tracked, officer added");
  });

  test("Should confirm both officers are tracking the plate", async () => {
    const response = await axios.get(`${API_URL}/${PLATE_NUMBER}`);
    const plateDetails = response.data;

    expect(plateDetails).toHaveProperty("tracking_officers");
    const trackedOfficers = plateDetails.tracking_officers.map(
      (officer) => officer.officer_id
    );
    expect(trackedOfficers).toEqual(
      expect.arrayContaining([OFFICER_1, OFFICER_2])
    );
  });
});
