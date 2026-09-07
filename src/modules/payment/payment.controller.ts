import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { paymentService } from "./payment.service.js";

export const paymentController = {
  initiatePayment: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await paymentService.initiatePayment(
      req.params.shipmentId as string,
      authUser.userId,
    );

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Stripe checkout session created successfully",
      data: result,
    });
  }),

  webhook: catchAsync(async (req, res) => {
    const signature = req.headers["stripe-signature"] as string | undefined;
    const result = await paymentService.handleWebhook(req.body as Buffer, signature);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Stripe webhook processed successfully",
      data: result,
    });
  }),

  success: catchAsync(async (req, res) => {
    const sessionId = req.query.session_id as string | undefined;
    const result = sessionId ? await paymentService.reconcileCheckoutSession(sessionId) : null;

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Stripe payment success callback received",
      data: result,
    });
  }),

  cancel: catchAsync(async (req, res) => {
    const sessionId = req.query.session_id as string | undefined;
    const result = sessionId ? await paymentService.markCancelledBySession(sessionId) : null;

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Stripe payment cancellation callback received",
      data: result,
    });
  }),

  getPaymentById: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await paymentService.getPaymentById(req.params.id as string, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Payment retrieved successfully",
      data: result,
    });
  }),

  getMyPayments: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await paymentService.getMyPayments(req.query, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "My payments retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),
};
