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

  cachedToken = accessToken;
  tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;

  return cachedToken;
}

// Reuse token until it expires
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  return await fetchAccessToken();
}

// Main employees endpoint
app.get("/employees", async (req, res) => {
  try {
    const userQuery = (req.query.query || "").toLowerCase();

    const token = await getAccessToken();

    const response = await axios.get(API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "PostmanRuntime/7.43.0"
      },
      timeout: 30000
    });

    const items = response.data.items || [];

    // Remove duplicates by employee_id
    const seen = new Set();
    let employees = [];

    for (const emp of items) {
      if (!seen.has(emp.employee_id)) {
        seen.add(emp.employee_id);
        employees.push(emp);
      }
    }

    // Filter by employee ID from query, e.g. "show employee id 109"
    const idMatch = userQuery.match(/(?:employee\s*id|id)?\s*(\d+)/);

    if (idMatch) {
      const employeeId = idMatch[1];
      employees = employees.filter(
        emp => String(emp.employee_id) === String(employeeId)
      );
    }

    // Filter by department
    const departments = [
      "executive",
      "administration",
      "finance",
      "accounting",
      "sales"
    ];

    const matchedDepartment = departments.find(dep => userQuery.includes(dep));

    if (matchedDepartment) {
      employees = employees.filter(
        emp =>
          emp.department_name &&
          emp.department_name.toLowerCase() === matchedDepartment
      );
    }

    // Filter by job title
    if (userQuery.includes("manager")) {
      employees = employees.filter(
        emp =>
          emp.job_title &&
          emp.job_title.toLowerCase().includes("manager")
      );
    }

    if (userQuery.includes("accountant")) {
      employees = employees.filter(
        emp =>
          emp.job_title &&
          emp.job_title.toLowerCase().includes("accountant")
      );
    }

    if (userQuery.includes("president")) {
      employees = employees.filter(
        emp =>
          emp.job_title &&
          emp.job_title.toLowerCase().includes("president")
      );
    }

    if (userQuery.includes("sales representative")) {
      employees = employees.filter(
        emp =>
          emp.job_title &&
          emp.job_title.toLowerCase().includes("sales representative")
      );
    }

    // Filter by location
    if (userQuery.includes("seattle")) {
      employees = employees.filter(
        emp => emp.city && emp.city.toLowerCase() === "seattle"
      );
    }

    if (userQuery.includes("oxford")) {
      employees = employees.filter(
        emp => emp.city && emp.city.toLowerCase() === "oxford"
      );
    }

    if (
      userQuery.includes("united states") ||
      userQuery.includes("usa") ||
      userQuery.includes(" us ")
    ) {
      employees = employees.filter(
        emp =>
          emp.country_name &&
          emp.country_name.toLowerCase().includes("united states")
      );
    }

    if (userQuery.includes("united kingdom") || userQuery.includes("uk")) {
      employees = employees.filter(
        emp =>
          emp.country_name &&
          emp.country_name.toLowerCase().includes("united kingdom")
      );
    }

    // Salary filters
    const lessThanMatch = userQuery.match(/(?:less than|under|below)\s*(\d+)/);

    if (lessThanMatch) {
      const maxSalary = Number(lessThanMatch[1]);
      employees = employees.filter(emp => Number(emp.salary) < maxSalary);
    }

    const moreThanMatch = userQuery.match(
      /(?:more than|greater than|above|over)\s*(\d+)/
    );

    if (moreThanMatch) {
      const minSalary = Number(moreThanMatch[1]);
      employees = employees.filter(emp => Number(emp.salary) > minSalary);
    }

    // Hire date filters
    const hiredAfterMatch = userQuery.match(/hired after\s*(\d{4})/);

    if (hiredAfterMatch) {
      const year = Number(hiredAfterMatch[1]);
      employees = employees.filter(
        emp => emp.hire_date && new Date(emp.hire_date).getFullYear() > year
      );
    }

    const hiredBeforeMatch = userQuery.match(/hired before\s*(\d{4})/);

    if (hiredBeforeMatch) {
      const year = Number(hiredBeforeMatch[1]);
      employees = employees.filter(
        emp => emp.hire_date && new Date(emp.hire_date).getFullYear() < year
      );
    }

    // Leave filters
    if (userQuery.includes("approved leave")) {
      employees = employees.filter(
        emp =>
          emp.leave_status &&
          emp.leave_status.toLowerCase() === "approved"
      );
    }

    if (userQuery.includes("pending leave")) {
      employees = employees.filter(
        emp =>
          emp.leave_status &&
          emp.leave_status.toLowerCase() === "pending"
      );
    }

    if (userQuery.includes("vacation")) {
      employees = employees.filter(
        emp =>
          emp.leave_type &&
          emp.leave_type.toLowerCase().includes("vacation")
      );
    }

    if (userQuery.includes("sick leave")) {
      employees = employees.filter(
        emp =>
          emp.leave_type &&
          emp.leave_type.toLowerCase().includes("sick")
      );
    }

    // Search by full name
    const nameMatches = employees.filter(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      return userQuery.includes(fullName);
    });

    if (nameMatches.length > 0) {
      employees = nameMatches;
    }

    res.json({ items: employees });

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

// Health check
app.get("/", (req, res) => {
  res.send("Oracle HR API proxy is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
