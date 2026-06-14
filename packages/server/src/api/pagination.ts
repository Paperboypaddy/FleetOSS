export function parsePagination(query: Record<string, string | string[] | undefined>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(query.limit as string, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
}
