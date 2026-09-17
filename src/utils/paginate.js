function getPagination(query, defaultLimit = 20, maxLimit = 100) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginatedResponse({ data, total, page, limit }) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.max(Math.ceil(total / limit), 1),
      has_next_page: page * limit < total,
      has_prev_page: page > 1,
    },
  };
}

module.exports = { getPagination, buildPaginatedResponse };
