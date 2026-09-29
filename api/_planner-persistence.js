function plannerPersistenceUnavailable(error, relation) {
  const message = String(error?.message || error || "");
  const table = String(relation || "").trim();
  if (!table || !message.includes(table)) return false;
  return /PGRST205|42P01|could not find the table|relation .* does not exist|schema cache/i.test(message);
}

function sendPlannerPersistenceUnavailable(response, error, relation) {
  if (!plannerPersistenceUnavailable(error, relation)) return false;
  response.status(503).json({
    error: "Planner persistence is not initialized. Apply the latest Supabase Planner migration, then restart local development.",
  });
  return true;
}

module.exports = {
  plannerPersistenceUnavailable,
  sendPlannerPersistenceUnavailable,
};
