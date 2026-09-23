# Agent Prism Mission

Static mission invitation with optional persistent reporting.

## Run locally with reporting enabled

```powershell
node server.js
```

Open `http://localhost:8000`. The server hosts the site and stores mission records in `.mission-data/missions.json`, which is intentionally ignored by Git.

The frontend remains functional without the backend. In a separate deployment, set `window.MISSION_API_BASE` before loading `script.js` to point at the deployed API origin. The browser keeps a local fallback and retries synchronization quietly when the API is unavailable.

The API exposes only mission-ID scoped `GET` and `PUT` routes:

```text
GET /api/missions/:missionId
PUT /api/missions/:missionId
```

Do not expose the local `.mission-data` directory publicly. For production deployment, place the API behind HTTPS and add platform-level access controls or a managed database policy appropriate to the hosting provider.