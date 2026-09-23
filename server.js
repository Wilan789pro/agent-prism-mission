const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const port = Number(process.env.PORT || 8000);
const root = __dirname;
const dataDirectory = path.join(root, ".mission-data");
const dataFile = path.join(dataDirectory, "missions.json");
const missionFileIds = new Set([
  "mission-file-01",
  "mission-file-02",
  "mission-file-03",
  "mission-file-04",
  "classified-surprise",
]);

function readMissions() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (error) {
    return {};
  }
}

function writeMissions(missions) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(missions, null, 2));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function serveStatic(request, response) {
  const requestedPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = path.normalize(path.join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    const contentTypes = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
    };
    response.writeHead(200, { "Content-Type": contentTypes[extension] || "application/octet-stream" });
    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const match = request.url.match(/^\/api\/missions\/([A-Za-z0-9-]+)$/);
  if (!match) {
    serveStatic(request, response);
    return;
  }

  const missionId = match[1];
  const missions = readMissions();

  if (request.method === "GET") {
    sendJson(response, 200, missions[missionId] || { missionId });
    return;
  }

  if (request.method === "PUT") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        const incoming = JSON.parse(body || "{}");
        const existing = missions[missionId] || { missionId, events: [] };
        const filesOpened = [...new Set([...(incoming.filesOpened || []), ...(existing.filesOpened || [])])]
          .filter((fileId) => missionFileIds.has(fileId));
        const filesCompleted = [...new Set([...(incoming.filesCompleted || []), ...(existing.filesCompleted || [])])]
          .filter((fileId) => missionFileIds.has(fileId));
        const record = {
          ...existing,
          ...incoming,
          missionId,
          filesOpened,
          filesCompleted,
          events: [...(existing.events || []), {
            id: crypto.randomUUID(),
            type: incoming.eventType || "STATE_UPDATED",
            at: new Date().toISOString(),
          }],
        };
        delete record.eventType;
        missions[missionId] = record;
        writeMissions(missions);
        sendJson(response, 200, record);
      } catch (error) {
        sendJson(response, 400, { error: "Invalid mission payload" });
      }
    });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(port, () => {
  console.log(`Mission server listening on http://localhost:${port}`);
});