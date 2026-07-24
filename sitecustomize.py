"""Project-wide Python startup overrides for the database rebuild."""

import fresh_mfl_database_rebuild as rebuild


rebuild.FLOW_BATCH_SIZE = 3000
