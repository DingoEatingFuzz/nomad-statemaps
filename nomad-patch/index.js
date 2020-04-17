const express = require("express");
const axios = require("axios");
const uuid = require("uuid").v4;
const bodyParser = require("body-parser");
const cors = require("cors");

let app = express();
let port = 8080;
let nomad = "http://localhost:4646/v1";

app.use(bodyParser.urlencoded({ extended: true, limit: "200mb" }));
app.use(bodyParser.json({ limit: "200mb" }));
app.use(cors());

const nomadURL = (path) => `${nomad}${path}`;

const programs = {
  IO: "/Users/michael/work/statemaps/io-statemap.d",
};

const dblol = {
  traces: [],
};

app.use(express.json({ limit: "500mb" }));

/** Trace Object
 * {
 *   id: "uuid",
 *   program: "program key",
 *   state: ["starting", "running", "completed", "failed"],
 *   alloc: "uuid"
 * }
 */

// Simple trace reads
app.get("/v1/traces", (req, res) => {
  // Return all traces in the db
  res.json(dblol.traces);
});

app.get("/v1/trace/:id", (req, res) => {
  // Return the one matching trace in the db OR 404
  const trace = dblol.traces.find((trace) => trace.id === req.params.id);
  if (!trace) {
    res.status(404);
    res.json({ error: "Not Found" });
    return;
  }

  res.json(trace);
});

// Create a trace: submit a batch job to a client that runs the program.
// Respond when that job is running.
app.post("/v1/trace", async (req, res) => {
  const { program, clientId } = req.body;

  console.log(`Making a trace for Program: ${program} on Client: ${clientId}`);

  // Return a 400 if the program isn't predefined
  if (!program || !programs[program]) {
    res.status(400);
    res.json({ error: "Not a valid program name" });
    return;
  }

  // Return a 400 if the query param clientId is undefined
  if (!clientId) {
    res.status(400);
    res.json({ error: "Client ID is a required param" });
    return;
  }

  // Create a new trace object with a uuid
  const trace = {
    id: uuid(),
    status: "pending",
    alloc: null,
    program: program,
  };

  // Create a new JSON job constrained to the clientId
  const jobId = `trace/${trace.id}`;
  const job = generateJobJSON(jobId, program, clientId);

  // Submit the JSON job to Nomad
  try {
    await axios.post(nomadURL("/jobs"), {
      Job: job,
    });
    // Wait for the job to be running
    const jobStatus = await watchJobStatus(jobId);
    if (jobStatus === "running") {
      // Only now add the trace to the "db"
      trace.status = "running";
      trace.alloc = (await getJobAlloc(jobId)).ID;
      dblol.traces.push(trace);

      // Respond with the trace object (state running, alloc of JSON job)
      res.json(trace);
    } else {
      res.status(500);
      res.json({ error: "Trace job failed to run" });
    }
  } catch (err) {
    res.status(500);
    console.log("OH NO: ", err);
    res.json({ error: err });
  }
});

app.post("/v1/trace/:id/stop", async (req, res) => {
  // Return a 404 if the trace isn't found
  const trace = dblol.traces.find((trace) => trace.id === req.params.id);
  if (!trace) {
    res.status(404);
    res.json({ error: "Not Found" });
    return;
  }

  // Return a 400 if the trace isn't running
  if (trace.status !== "running") {
    res.status(400);
    res.json({ error: "Trace is not running" });
    return;
  }

  // Send signal to the Trace's alloc to stop the trace (but don't exit)
  try {
    await axios.post(nomadURL(`/client/allocation/${trace.alloc}/signal`), {
      Signal: "SIGUSR1",
    });
    trace.status = "completed";
    res.json(trace);
  } catch (err) {
    res.status(500);
    console.log(err);
    res.json({ error: "Could not send a signal to the trace alloc" });
  }
});

app.get("/v1/trace/:id/raw", (req, res) => {
  // Return a 400 if the trace is not in the completed state
  // Return the logs of the corresponding alloc if it is completed
});

app.get("/v1/trace/:id/map", (req, res) => {
  // Fetch raw, then POST it to the statemap service with json=true
});

app.get("/test", async (req, res) => {
  try {
    let one = await axios.get("http://[::1]:3333");
    console.log("Victory:", one.data);
  } catch (err) {
    console.log("Axios fails");
  }

  res.json();
});

app.get("/v1/trace/:id/svg", async (req, res) => {
  // Fetch raw, then POST it to the statemap service
  const trace = dblol.traces.find((trace) => trace.id === req.params.id);
  if (!trace) {
    res.status(404);
    res.json({ error: "Not Found" });
    return;
  }

  try {
    let logs = await axios.get(
      nomadURL(
        `/client/fs/logs/${trace.alloc}?task=trace&type=stdout&origin=start&plain=true`
      )
    );

    let svg = await axios.post("http://[::1]:3333/", {
      begin: 0,
      end: 0,
      coalesce: 25000,
      json: false,
      buffer: logs.data,
    });

    res.send(svg.data);
  } catch (err) {
    console.log(err);
    res.status(500);
    res.json({ error: "Could not generate Statemap" });
  }
});

app.listen(port, () => {
  console.log("Server started at http://localhost:" + port);
});

// Create a Vessel batch job that runs `program` on the
// client with ID `clientId`
function generateJobJSON(id, program, clientId) {
  return {
    Datacenters: ["dc1"],
    ID: id,
    Name: id,
    TaskGroups: [
      {
        Name: "trace",
        Tasks: [
          {
            Name: "trace",
            Driver: "raw_exec",
            Config: {
              command: "/Users/michael/work/statemaps/vessel.sh",
              args: [programs[program]],
            },
            Constraints: [
              {
                LTarget: "${node.unique.id}",
                Operand: "=",
                RTarget: clientId,
              },
            ],
          },
        ],
      },
    ],
    Type: "batch",
  };
}

async function watchJobStatus(jobId) {
  let index = 1;
  while (true) {
    const res = await axios.get(nomadURL(`/job/${jobId}?index=${index}`));
    index = res.headers["X-Nomad-Index"];

    const status = res.data.Status;
    if (status === "running" || status === "failed") return status;
  }
}

async function getJobAlloc(jobId) {
  const allocRes = await axios.get(nomadURL(`/job/${jobId}/allocations`));
  return allocRes.data[0];
}
