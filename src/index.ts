import express, { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

const app = express();
const PORT = 8080;

app.use(middlewareLogResponses);
app.use("/app", middlewareMetricsInc, express.static("./src/app"));
app.get("/api/healthz", handlerReadiness);
app.post("/api/validate_chirp", handlerValidateChirp);
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);

function handlerReadiness(req: Request, res: Response) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

function handlerValidateChirp(req: Request, res: Response) {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      sendJSON(res, 400, { error: "Something went wrong" });
      return;
    }

    const chirp = (parsed as { body?: unknown } | null)?.body;
    if (typeof chirp !== "string") {
      sendJSON(res, 400, { error: "Something went wrong" });
      return;
    }

    if (chirp.length > 140) {
      sendJSON(res, 400, { error: "Chirp is too long" });
      return;
    }

    sendJSON(res, 200, { valid: true });
  });
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
    <p>Chirpy has been visited ${config.fileserverHits} times!</p>
  </body>
</html>`);
}

function handlerReset(req: Request, res: Response) {
  config.fileserverHits = 0;
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
  config.fileserverHits++;
  next();
}

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
