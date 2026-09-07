import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { getAuthUser } from "../../shared/getAuthUser.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { shipmentService } from "./shipment.service.js";

export const shipmentController = {
  quoteShipment: catchAsync(async (req, res) => {
    const result = await shipmentService.quoteShipment(req.body);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment quote calculated successfully",
      data: result,
    });
  }),

  createShipment: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.createShipment(req.body, authUser.userId);

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Shipment created successfully",
      data: result,
    });
  }),

  getShipments: catchAsync(async (req, res) => {
    const result = await shipmentService.getShipments(req.query, getAuthUser(req));

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipments retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  getMyShipments: catchAsync(async (req, res) => {
    const result = await shipmentService.getShipments(req.query, getAuthUser(req));

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "My shipments retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),

  getShipmentById: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.getShipmentById(req.params.id as string, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment retrieved successfully",
      data: result,
    });
  }),

  updateShipment: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.updateShipment(
      req.params.id as string,
      req.body,
      authUser,
    );

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment updated successfully",
      data: result,
    });
  }),

  deleteShipment: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.deleteShipment(req.params.id as string, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment deleted successfully",
      data: result,
    });
  }),

  assignCourier: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.assignCourier(req.params.id as string, req.body, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Courier assigned successfully",
      data: result,
    });
  }),

  autoAssign: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.autoAssign(req.body, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Eligible courier tasks assigned successfully",
      data: result,
    });
  }),

  updateStatus: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.updateStatus(req.params.id as string, req.body, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment status updated successfully",
      data: result,
    });
  }),

  addCheckpoint: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.addCheckpoint(req.params.id as string, req.body, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Shipment checkpoint added successfully",
      data: result,
    });
  }),

  collectFromHub: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.collectFromHub(
      req.params.id as string,
      req.body.note,
      authUser,
    );

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment collection recorded successfully",
      data: result,
    });
  }),

  createReturnOrder: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.createReturnOrder(
      req.params.id as string,
      req.body.note,
      authUser.userId,
    );

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Return shipment created successfully",
      data: result,
    });
  }),

  getTimeline: catchAsync(async (req, res) => {
    const authUser = getAuthUser(req);
    const result = await shipmentService.getTimeline(req.params.id as string, authUser);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Shipment timeline retrieved successfully",
      data: result,
    });
  }),

  trackByTrackingNumber: catchAsync(async (req, res) => {
    const result = await shipmentService.trackByTrackingNumber(req.params.trackingNumber as string);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Tracking information retrieved successfully",
      data: result,
    });
  }),
};
