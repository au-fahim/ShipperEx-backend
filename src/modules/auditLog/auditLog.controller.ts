import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { auditLogService } from "./auditLog.service.js";

export const auditLogController = {
  getAuditLogs: catchAsync(async (req, res) => {
    const result = await auditLogService.getAuditLogs(req.query);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Audit logs retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  }),
};
