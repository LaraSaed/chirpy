import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import type { Request } from "express";

import { UnauthorizedError } from "./errors.js";

export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export async function checkPasswordHash(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export function makeJWT(
  userID: string,
  expiresIn: number,
  secret: string,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const claims: payload = {
    iss: "chirpy",
    sub: userID,
    iat: iat,
    exp: iat + expiresIn,
  };
  return jwt.sign(claims, secret);
}

export function validateJWT(tokenString: string, secret: string): string {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(tokenString, secret);
  } catch {
    throw new UnauthorizedError("Invalid token");
  }

  if (typeof decoded === "string" || !decoded.sub) {
    throw new UnauthorizedError("Invalid token");
  }

  return decoded.sub;
}

export function getBearerToken(req: Request): string {
  const header = req.get("Authorization");
  if (!header) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new UnauthorizedError("Malformed Authorization header");
  }

  return parts[1];
}
