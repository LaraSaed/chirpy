import express, { Request, Response, NextFunction } from "express";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";

import { config } from "./config.js";
import { createUser, deleteAllUsers } from "./db/queries/users.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "./errors.js";

const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app = express();

app.use(express.json());
app.use(middlewareLogResponses);
app.use("/app", middlewareMetricsInc, express.static("./src/app"));
app.get("/api/healthz", handlerReadiness);
app.post("/api/validate_chirp", handlerValidateChirp);
app.post("/api/users", handlerCreateUser);
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);

function handlerReadiness(req: Request, res: Response) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

async function handlerValidateChirp(req: Request, res: Response) {
  type parameters = {
    body: string;
  };

  const params: parameters = req.body;
  const badWords = ["kerfuffle", "sharbert", "fornax"];

  if (!params || typeof params.body !== "string") {
    throw new BadRequestError("Something went wrong");
  }

  if (params.body.length > 140) {
    throw new BadRequestError("Chirp is too long. Max length is 140");
  }

  const cleanedBody = params.body
    .split(" ")
    .map((word) => (badWords.includes(word.toLowerCase()) ? "****" : word))
    .join(" ");

  sendJSON(res, 200, { cleanedBody });
}

async function handlerCreateUser(req: Request, res: Response) {
  const email = req.body?.email;
  if (typeof email !== "string" || email === "") {
    throw new BadRequestError("Email is required");
  }

  const user = await createUser({ email });
  if (!user) {
    throw new BadRequestError("Could not create user");
  }

  sendJSON(res, 201, user);
}

function sendJSON(res: Response, status: number, data: unknown) {
  res.header("Content-Type", "application/json");
  res.status(status).send(JSON.stringify(data));
}

function handlerMetrics(req: Request, res: Response) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.api.fileserverHits} times!</p>
  </body>
</html>`);
}

async function handlerReset(req: Request, res: Response) {
  if (config.api.platform !== "dev") {
    throw new ForbiddenError("Reset is only allowed in dev environment");
  }

  config.api.fileserverHits = 0;
  await deleteAllUsers();

  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

function middlewareLogResponses(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    const status = res.statusCode;
    if (status >= 300) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${status}`);
    }
  });
  next();
}

function middlewareMetricsInc(req: Request, res: Response, next: NextFunction) {
  config.api.fileserverHits++;
  next();
}

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof BadRequestError) {
    sendJSON(res, 400, { error: err.message });
  } else if (err instanceof UnauthorizedError) {
    sendJSON(res, 401, { error: err.message });
  } else if (err instanceof ForbiddenError) {
    sendJSON(res, 403, { error: err.message });
  } else if (err instanceof NotFoundError) {
    sendJSON(res, 404, { error: err.message });
  } else {
    console.log(err.message);
    sendJSON(res, 500, { error: "Something went wrong on our end" });
  }
}

app.use(errorHandler);

app.listen(config.api.port, () => {
  console.log(`Server is running at http://localhost:${config.api.port}`);
});
