import httpStatus from "http-status";
import type Stripe from "stripe";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { stripe } from "../../config/stripe.js";
import {
  PaymentStatus,
  Role,
  ShipmentPurpose,
  ShipmentStatus,
  StaffType,
} from "../../generated/prisma/enums.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";
import { getPagination } from "../../shared/pagination.js";
import { runSerializableTransaction } from "../../shared/transaction.js";
import { invalidateTrackingCache } from "../shipment/shipment.service.js";

type AuthUser = NonNullable<Express.Request["user"]>;

export const paymentService = {
  initiatePayment: async (shipmentId: string, customerId: string) => {
    const shipment = await prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        customerId,
        deletedAt: null,
      },
      include: {
        payment: true,
        customer: { select: { email: true } },
      },
    });

    if (!shipment?.payment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Shipment or payment not found");
    }

    if (shipment.status !== ShipmentStatus.PENDING_PAYMENT) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Shipment is not waiting for payment");
    }

    if (shipment.payment.status === PaymentStatus.PAID) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Payment already completed");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: shipment.customer.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: shipment.currency.toLowerCase(),
            unit_amount: Math.round(Number(shipment.priceUsd) * 100),
            product_data: {
              name: `ShipperEx shipment ${shipment.trackingNumber}`,
              description: `${shipment.direction} ${shipment.shipmentType} shipment`,
            },
          },
        },
      ],
      success_url: `${env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.STRIPE_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        shipmentId: shipment.id,
        paymentId: shipment.payment.id,
        customerId,
      },
    });

    const payment = await prisma.payment.update({
      where: { id: shipment.payment.id },
      data: {
        providerSessionId: session.id,
        status: PaymentStatus.PENDING,
        metadata: session.metadata ?? undefined,
      },
    });

    return {
      payment,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  },

  handleCheckoutCompleted: async (session: Stripe.Checkout.Session) => {
    const paymentId = session.metadata?.paymentId;
    const shipmentId = session.metadata?.shipmentId;

    if (!paymentId || !shipmentId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Stripe session metadata is missing");
    }

    if (session.payment_status !== "paid") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Stripe Checkout Session is not paid");
    }

    const result = await runSerializableTransaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, shipmentId, providerSessionId: session.id },
        include: { shipment: true },
      });

      if (!payment) {
        throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
      }

      if (payment.status === PaymentStatus.PAID) {
        return {
          updatedPayment: payment,
          updatedShipment: payment.shipment,
          originalShipmentId: payment.shipment.returnOfShipmentId,
        };
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          providerPaymentIntent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          paidAt: new Date(),
          metadata: {
            stripeSessionId: session.id,
            paymentStatus: session.payment_status,
          },
        },
      });

      const nextStatus =
        payment.shipment.purpose === ShipmentPurpose.RETURN
          ? ShipmentStatus.AT_ORIGIN_HUB
          : ShipmentStatus.PAID_AWAITING_ASSIGNMENT;
      const updatedShipment = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: nextStatus,
          currentHubId:
            payment.shipment.purpose === ShipmentPurpose.RETURN
              ? payment.shipment.originHubId
              : undefined,
        },
      });

      await tx.trackingEvent.create({
        data: {
          shipmentId,
          status: nextStatus,
          note:
            payment.shipment.purpose === ShipmentPurpose.RETURN
              ? "Return payment verified; parcel is already at the origin hub"
              : "Payment verified by Stripe",
          createdById: payment.customerId,
        },
      });

      if (
        payment.shipment.purpose === ShipmentPurpose.RETURN &&
        payment.shipment.returnOfShipmentId
      ) {
        await tx.shipment.update({
          where: { id: payment.shipment.returnOfShipmentId },
          data: { status: ShipmentStatus.RETURN_BOOKED },
        });
        await tx.trackingEvent.create({
          data: {
            shipmentId: payment.shipment.returnOfShipmentId,
            status: ShipmentStatus.RETURN_BOOKED,
            note: `Paid return shipment ${payment.shipment.trackingNumber} booked`,
            createdById: payment.customerId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: payment.customerId,
          action: "PAYMENT_VERIFIED",
          entityType: "Payment",
          entityId: payment.id,
          before: toJson(payment),
          after: toJson({ payment: updatedPayment, shipment: updatedShipment }),
        },
      });

      return {
        updatedPayment,
        updatedShipment,
        originalShipmentId: payment.shipment.returnOfShipmentId,
      };
    });

    await invalidateTrackingCache(result.updatedShipment.trackingNumber);
    if (result.originalShipmentId) {
      const original = await prisma.shipment.findUnique({
        where: { id: result.originalShipmentId },
        select: { trackingNumber: true },
      });
      if (original) await invalidateTrackingCache(original.trackingNumber);
    }
    return result.updatedPayment;
  },

  reconcileCheckoutSession: async (sessionId: string) => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return { sessionId, paymentStatus: session.payment_status, verified: false };
    }
    const payment = await paymentService.handleCheckoutCompleted(session);
    return { sessionId, paymentStatus: session.payment_status, verified: true, payment };
  },

  handleWebhook: async (rawBody: Buffer, signature?: string) => {
    if (!signature) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Stripe signature header is missing");
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      await paymentService.handleCheckoutCompleted(event.data.object);
    }

    return { received: true, eventType: event.type };
  },

  markCancelledBySession: async (sessionId: string) => {
    return runSerializableTransaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { providerSessionId: sessionId },
      });

      if (!payment || payment.status === PaymentStatus.PAID) {
        return payment;
      }

      await tx.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.PAID } },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      return tx.payment.findUnique({ where: { id: payment.id } });
    });
  },

  getPaymentById: async (id: string, user: AuthUser) => {
    const payment = await prisma.payment.findFirst({
      where: {
        id,
        customerId: user.role === Role.CUSTOMER ? user.userId : undefined,
        shipment:
          user.role === Role.STAFF && user.staffType === StaffType.MANAGER
            ? {
                OR: [
                  { originHubId: user.hubId },
                  { destinationHubId: user.hubId },
                  { currentHubId: user.hubId },
                ],
              }
            : undefined,
      },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    return payment;
  },

  getMyPayments: async (query: unknown, customerId: string) => {
    const pagination = getPagination(query);
    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where: { customerId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        include: {
          shipment: {
            select: { id: true, trackingNumber: true, status: true },
          },
        },
      }),
      prisma.payment.count({ where: { customerId } }),
    ]);

    return { meta: { page: pagination.page, limit: pagination.limit, total }, data };
  },
};
