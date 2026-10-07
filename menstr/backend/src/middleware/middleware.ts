import { ErrorRequestHandler, RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { toHttpError } from "./auth";

export function requestLogger(): RequestHandler {
  return (req, _res, next) => {
    const start = Date.now();
    _res.on("finish", () => {
      const ms = Date.now() - start;
      const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${_res.statusCode} ${ms}ms`;
      try {
        fs.appendFileSync(
          path.join(__dirname, "..", "..", "logs", "requests.log"),
          line + "\n",
          "utf8"
        );
      } catch {
        /* ignore */
      }
      console.log(line);
    });
    next();
  };
}

export function errorHandler(): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const isMulter = typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code === "LIMIT_FILE_SIZE" || (err as { code: string }).code === "UNSUPPORTED_FILE"
      : false;

    if (isMulter || (err instanceof Error && err.message === "UNSUPPORTED_FILE")) {
      res.status(400).json({
        error: "Файл должен быть изображением (png, jpg, webp, gif) и не больше 5 МБ",
        code: "INVALID_FILE"
      });
      return;
    }

    const httpError = toHttpError(err);
    console.error(`[error] ${httpError.code}: ${httpError.message}`);
    res.status(httpError.status).json({
      error: httpError.message,
      code: httpError.code
    });
  };
}

export function notFoundHandler(): RequestHandler {
  return (_req, res) => {
    res.status(404).json({ error: "Маршрут не найден", code: "NOT_FOUND" });
  };
}