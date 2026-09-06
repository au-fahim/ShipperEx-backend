import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { authService } from "./auth.service.js";

export const authController = {
  register: catchAsync(async (req, res) => {
    const result = await authService.register(req.body);

    sendResponse({
      res,
      statusCode: httpStatus.CREATED,
      message: "Customer registered successfully",
      data: result,
    });
  }),

  login: catchAsync(async (req, res) => {
    const result = await authService.login(req.body);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Logged in successfully",
      data: result,
    });
  }),

  googleLogin: catchAsync(async (req, res) => {
    const result = await authService.googleLogin(req.body.idToken);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Google login successful",
      data: result,
    });
  }),

  refreshToken: catchAsync(async (req, res) => {
    const result = await authService.refreshToken(req.body.refreshToken);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Token refreshed successfully",
      data: result,
    });
  }),

  logout: catchAsync(async (req, res) => {
    await authService.logout(req.body.refreshToken);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Logged out successfully",
      data: null,
    });
  }),
};
