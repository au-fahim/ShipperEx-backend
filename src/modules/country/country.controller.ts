import httpStatus from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { countryService } from "./country.service.js";

export const countryController = {
  getCountries: catchAsync(async (req, res) => {
    const result = await countryService.getCountries(req.query.search as string | undefined);

    sendResponse({
      res,
      statusCode: httpStatus.OK,
      message: "Countries retrieved successfully",
      data: result,
    });
  }),
};
