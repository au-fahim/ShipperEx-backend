import type { Role, StaffType } from "../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: Role;
        staffProfileId?: string;
        staffType?: StaffType;
        hubId?: string;
      };
    }
  }
}
