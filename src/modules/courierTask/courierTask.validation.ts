import { z } from "zod";

const taskParams = z.object({ id: z.string().min(1) });

export const courierTaskIdValidation = z.object({ params: taskParams });

export const startCourierTaskValidation = z.object({
  params: taskParams,
  body: z.object({ note: z.string().max(500).optional() }),
});

export const completeCourierTaskValidation = z.object({
  params: taskParams,
  body: z.object({
    location: z.string().max(120).optional(),
    note: z.string().max(500).optional(),
  }),
});

export const failCourierTaskValidation = z.object({
  params: taskParams,
  body: z.object({
    reason: z.string().min(3).max(300),
    location: z.string().max(120).optional(),
    note: z.string().max(500).optional(),
    contactAttempted: z.literal(true, {
      error: "The courier must attempt to contact the recipient before recording failure",
    }),
  }),
});
