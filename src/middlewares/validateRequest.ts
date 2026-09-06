import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export const validateRequest =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body,
      cookies: req.cookies,
      params: req.params,
      query: req.query,
    }) as {
      body?: Request["body"];
    };

    req.body = parsed.body ?? req.body;
    next();
  };
