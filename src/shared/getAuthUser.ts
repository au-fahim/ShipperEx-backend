import type { Request } from "express";
import httpStatus from "http-status";
import { ApiError } from "./ApiError.js";

export const getAuthUser = (req: Request) => {
  if (!req.user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication is required");
  }

  return req.user;
};
