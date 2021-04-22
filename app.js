const express = require("express");
const app = express();
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let database = null;
app.use(express.json());

const initializationDBandServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializationDBandServer();

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//API 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
  SElECT *
  FROM
  user
  WHERE
  username = "${username}";
  `;
  const dbUser = await database.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { uername: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Middleware function
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 2

app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesArray = `
    SELECT
    *
    FROM
    state
    ORDER BY
    state_id;
    `;
  const statesArray = await database.all(getStatesArray);
  response.send(
    statesArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

//API 3

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT
    *
    FROM
    state
    WHERE
    state_id = ${stateId};
    `;
  const state = await database.get(getStateQuery);
  response.send(convertStateDbObjectToResponseObject(state));
});

//API 4

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
  INSERT INTO
  district (district_name, state_id, cases, cured, active, deaths)
  VALUES(
      "${districtName}",
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths})`;

  await database.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT
    *
    FROM
    district
    WHERE
    district_id = ${districtId};
    `;
    const district = await database.get(getDistrictQuery);
    response.send(convertDistrictDbObjectToResponseObject(district));
  }
);

//API 6

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE
    FROM
    district
    WHERE
    district_id = ${districtId};
    `;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `
    UPDATE
    district
    SET
    district_name = "${districtName}",
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE
    district_id = ${districtId};
    `;
    await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatQuery = `
    SELECT
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) As totalActive,
    SUM(deaths) AS totalDeaths
    FROM
    district
    WHERE
    state_id = ${stateId};
    `;
    const stateStats = await database.get(getStateStatQuery);
    response.send(stateStats);
  }
);

module.exports = app;
