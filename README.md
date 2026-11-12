# Telemetry Web

Angular 22 client for the Telemetry monitoring services. The app uses standalone components, Angular Signals, RxJS, and the Microsoft SignalR client.

## Structure

```text
src/app/
  core/
    models/       Auth DTO and telemetry payload contracts
    services/     Auth, JWT interceptor/guard, instances, SignalR, metric grouping
  features/
    auth/         Login and registration
    setup/        Instance creation and agent install command
    dashboard/    Live, metric-type-aware dashboard
    analytics/    Future analytics placeholder
  layout/         Authenticated shell and navigation
```

## Local development

Run the Auth API, Telemetry API Hub, and ingestion API, then start the web client:

```bash
npm start
```

The dev-server proxy forwards `/auth-api` to the Auth API HTTP endpoint at `localhost:5068` and `/telemetry-hub` to the Hub at `localhost:5154`. Run the Auth API with its `http` launch profile, or update the proxy target to `https://localhost:7158` when using its `https` profile. Adjust `proxy.conf.json` and `src/environments/environment.ts` when local service ports change. The Setup page defaults the agent's ingestion URL to `http://localhost:5289/api/telemetry/ingest`.

The authenticated API routes use the Auth API endpoints `/api/user/login`, `/api/user/reg`, `/api/user/me`, `/api/instance`, and `/api/workspace`. The header loads `/api/workspace/my`, creates workspaces with `POST /api/workspace`, and joins them with `POST /api/workspace/accept-invite={code}`. Workspace selection is persisted in local storage and filters the dashboard instance list. JWTs are stored in browser local storage and attached as Bearer tokens by the HTTP interceptor.

Setup creates a client-side Agent ID and command without creating an Auth API record. After the command is copied, the client joins that ID's SignalR group. The first matching metric triggers `POST /api/instance` or `POST /api/instance/workspace` (when a workspace is selected) with the signed-in user's JWT, then routes to the dashboard for that instance.

The dashboard joins the Hub group for a selected instance with `EnterGroup(instanceId)` and reads `ReceiveMetrics`. The existing Hub Pusher consumes `metrics_queue` and sends metric JSON to the Hub by `instanceId`. The dashboard groups `MachineMetrics`, `APIMetrics`, and `DbMetric` payloads, then only renders sections for types received in the current stream.

## Integration notes

- The current collector setup contract provides an `AgentId`/instance ID. The Auth API persists the instance only after the first matching metric arrives.
- Release `v1.0.4`'s Windows collector uses the supplied Agent ID. Its Linux collector generates a new `instanceId` for every sample, so the Linux binary must be rebuilt and released with the stable-ID source change before this automatic setup flow can complete on Linux.
- For production, set the Auth API, ingestion API, and Hub URLs for the deployment and configure the deployment reverse proxy/CORS rules to route those services.
