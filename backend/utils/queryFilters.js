const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const addTextSearch = (query, searchTerm, fields) => {
  if (searchTerm === undefined || searchTerm === null || searchTerm === '') {
    return null;
  }

  if (typeof searchTerm !== 'string' || searchTerm.length > 100) {
    return 'Search must be a string of no more than 100 characters';
  }

  const normalizedSearchTerm = searchTerm.trim();
  if (!normalizedSearchTerm) {
    return null;
  }

  const searchFilter = {
    $or: fields.map((field) => ({
      [field]: { $regex: escapeRegex(normalizedSearchTerm), $options: 'i' }
    }))
  };

  const conditions = query.$and || [];
  if (query.$or) {
    conditions.push({ $or: query.$or });
    delete query.$or;
  }
  conditions.push(searchFilter);
  query.$and = conditions;

  return null;
};

const parsePagination = (pageValue, limitValue) => {
  const isPositiveInteger = value =>
    typeof value === 'string' && /^[1-9]\d*$/.test(value);

  if (pageValue !== undefined && !isPositiveInteger(pageValue)) return null;
  if (limitValue !== undefined && !isPositiveInteger(limitValue)) return null;

  const page = pageValue === undefined ? 1 : Number(pageValue);
  const limit = limitValue === undefined ? 10 : Number(limitValue);
  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) ||
      limit > 100 || !Number.isSafeInteger(skip)) {
    return null;
  }

  return { page, limit, skip };
};

module.exports = { addTextSearch, parsePagination };
