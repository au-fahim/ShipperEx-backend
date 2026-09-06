import type { Response } from "express";

type SendResponseArgs<T> = {
  res: Response;
  statusCode: number;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

export const sendResponse = <T>({ res, statusCode, message, data, meta }: SendResponseArgs<T>) => {
  res.status(statusCode).json({
    success: true,
    message,
    meta,
    data: data ?? null,
  });
};
