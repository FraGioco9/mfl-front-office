"""Project-wide Python startup overrides for the database rebuild."""

import fresh_mfl_database_rebuild as rebuild


# Number of player IDs requested in each Flow metadata batch.
rebuild.FLOW_BATCH_SIZE = 3000

# Number of wallet addresses requested in each Flow wallet-ownership batch.
rebuild.WALLET_BATCH_SIZE = 3000
