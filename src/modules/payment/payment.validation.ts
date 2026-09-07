import { z } from "zod";

export const initiatePaymentValidation = z.object({
  params: z.object({
    shipmentId: z.string().min(1),
  }),
});

export const paymentIdParamValidation = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
