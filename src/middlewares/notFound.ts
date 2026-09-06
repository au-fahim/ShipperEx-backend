import type { RequestHandler } from "express";
import httpStatus from "http-status";

export const notFound: RequestHandler = (req, res) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "API endpoint not found",
    errors: [{ path: req.originalUrl, message: "Route does not exist" }],
  });
};
