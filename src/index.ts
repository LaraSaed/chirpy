import express, { Request, Response, NextFunction } from "express";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";

import { config } from "./config.js";
import { hashPassword, checkPasswordHash } from "./auth.js";
import {
  createUser,
  getUserByEmail,
  deleteAllUsers,
} from "./db/queries/users.js";
import { createChirp, getAllChirps, getChirp } from "./db/queries/chirps.js";
import type { UserResponse } from "./db/schema.js";
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
app.post("/api/users", handlerCreateUser);
app.post("/api/login", handlerLogin);
app.post("/api/chirps", handlerCreateChirp);
app.get("/api/chirps", handlerGetChirps);
app.get("/api/chirps/:chirpId", handlerGetChirp);
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);

function handlerReadiness(req: Request, res: Response) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

async function handlerCreateUser(req: Request, res: Response) {
  const email = req.body?.email;
  const password = req.body?.password;
  if (
    typeof email !== "string" ||
    email === "" ||
    typeof password !== "string" ||
    password === ""
  ) {
    throw new BadRequestError("Email and password are required");
  }

  const hashedPassword = await hashPassword(password);
  const user = await createUser({ email, hashedPassword });
  if (!user) {
    throw new BadRequestError("Could not create user");
  }

  const response: UserResponse = {
    id: user.id,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    email: user.email,
  };
  sendJSON(res, 201, response);
}

async function handlerLogin(req: Request, res: Response) {
  const email = req.body?.email;
  const password = req.body?.password;
  if (typeof email !== "string" || typeof password !== "string") {
    throw new BadRequestError("Email and password are required");
  }

  const user = await getUserByEmail(email);
  if (!user) {
    throw new UnauthorizedError("incorrect email or password");
  }

  const matches = await checkPasswordHash(password, user.hashedPassword);
  if (!matches) {
    throw new UnauthorizedError("incorrect email or password");
  }

  const response: UserResponse = {
    id: user.id,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    email: user.email,
  };
  sendJSON(res, 200, response);
}

async function handlerCreateChirp(req: Request, res: Response) {
  const body = req.body?.body;
  const userId = req.body?.userId;

  if (typeof body !== "string" || typeof userId !== "string") {
    throw new BadRequestError("body and userId are required");
  }

  if (body.length > 140) {
    throw new BadRequestError("Chirp is too long. Max length is 140");
  }

  const badWords = ["kerfuffle", "sharbert", "fornax"];
  const cleanedBody = body
    .split(" ")
    .map((word) => (badWords.includes(word.toLowerCase()) ? "****" : word))
    .join(" ");

  const chirp = await createChirp({ body: cleanedBody, userId });
  sendJSON(res, 201, chirp);
}

async function handlerGetChirps(req: Request, res: Response) {
  const allChirps = await getAllChirps();
  sendJSON(res, 200, allChirps);
}

async function handlerGetChirp(req: Request, res: Response) {
  const chirp = await getChirp(req.params.chirpId as string);
  if (!chirp) {
    throw new NotFoundError("Chirp not found");
  }
  sendJSON(res, 200, chirp);
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
