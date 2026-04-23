const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const TOKEN_URL = "https://oracleapex.com/ords/z_workspace/oauth/token";
const API_URL = "https://oracleapex.com/ords/z_workspace/hr_data/";
const CLIENT_ID = process.env.CLIENT_ID || "vwHuivehFQoxaer-RcLchg..";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "7Li1KmIJCRd8nZC5w5CugQ..";

// token cache
let cachedToken = null;
let tokenExpiresAt = 0;

// get a fresh token from Oracle
async function fetchAccessToken() {
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");

  const response = await axios.post(TOKEN_URL, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "User-Agent": "PostmanRuntime/7.43.0"
    },
    auth: {
      username: CLIENT_ID,
      password: CLIENT_SECRET
    },
    timeout: 30000
  });

  const accessToken = response.data.access_token;
  const expiresIn = response.data.expires_in || 3600;

  // refresh a little early
  cachedToken = accessToken;
  tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;

  return cachedToken;
}

// return cached token if still valid, otherwise get new one
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  return await fetchAccessToken();
}

app.get("/employees", async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(API_URL, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "User-Agent": "PostmanRuntime/7.43.0"
      },
      timeout: 30000
    });

    const items = response.data.items || [];

    const seen = new Set();
    const uniqueEmployees = [];

    for (const emp of items) {
      if (!seen.has(emp.employee_id)) {
        seen.add(emp.employee_id);
        uniqueEmployees.push(emp);
      }
    }

    res.json({ items: uniqueEmployees });
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({
        message: "Oracle request failed",
        status: error.response.status,
        data: error.response.data
      });
    } else {
      res.status(500).json({
        message: error.message
      });
    }
  }
});

app.get("/", (req, res) => {
  res.send("Oracle proxy is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
