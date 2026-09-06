import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { Role } from "../../generated/prisma/enums.js";

export type JwtPayload = {
  userId: string;
  email: string;
  role: Role;
};

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

const signToken = (payload: JwtPayload, secret: Secret, expiresIn: string) =>
  jwt.sign(payload, secret, { expiresIn } as SignOptions);

export const createAccessToken = (payload: JwtPayload) =>
  signToken(payload, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);

export const createRefreshToken = (payload: JwtPayload) =>
  signToken(payload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
