import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
});

export const getPagination = (query: unknown) => {
  const parsed = paginationQuerySchema.parse(query);
  const skip = (parsed.page - 1) * parsed.limit;

  return {
    ...parsed,
    skip,
    take: parsed.limit,
  };
};
