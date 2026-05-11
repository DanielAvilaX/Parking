export function applyInFilter(query, column, values) {
  if (!values?.length) {
    return query;
  }

  return query.in(column, values);
}

export function ensureQueryResult({ data, error }) {
  if (error) {
    throw error;
  }

  return data;
}

