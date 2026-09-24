import unittest

from scripts.operations.runtime_health import next_health_marker


class RuntimeHealthMarkerTests(unittest.TestCase):
    def marker(self, previous, outcome):
        return next_health_marker(
            previous,
            surface="marketplace",
            outcome=outcome,
            attempted_at="2026-09-16T18:30:00Z",
            trigger_source="supabase-cron",
            occurrence_key="20260916-2030-p0200",
            run_id="123",
            run_attempt="2",
        )

    def test_success_resets_failure_streak_and_updates_success_time(self):
        marker = self.marker(
            {
                "consecutiveFailures": 4,
                "lastSuccessAt": "2026-09-16T17:00:00Z",
            },
            "success",
        )
        self.assertEqual(marker["consecutiveFailures"], 0)
        self.assertEqual(marker["lastSuccessAt"], "2026-09-16T18:30:00Z")
        self.assertEqual(marker["lastOutcome"], "success")

    def test_failure_increments_failure_streak_and_preserves_last_success(self):
        marker = self.marker(
            {
                "consecutiveFailures": 1,
                "lastSuccessAt": "2026-09-16T17:00:00Z",
            },
            "failure",
        )
        self.assertEqual(marker["consecutiveFailures"], 2)
        self.assertEqual(marker["lastSuccessAt"], "2026-09-16T17:00:00Z")
        self.assertEqual(marker["lastOutcome"], "failure")

    def test_cancelled_scheduled_run_counts_as_missed_refresh(self):
        marker = self.marker({}, "cancelled")
        self.assertEqual(marker["consecutiveFailures"], 1)
        self.assertEqual(marker["lastSuccessAt"], "")

    def test_malformed_previous_failure_count_is_not_trusted(self):
        marker = self.marker({"consecutiveFailures": "not-a-number"}, "failure")
        self.assertEqual(marker["consecutiveFailures"], 1)


    def test_private_marker_uses_authenticated_download_route(self):
        from scripts.operations.runtime_health import _object_url

        url = _object_url(
            "https://example.supabase.co",
            "health/database-refresh.json",
            authenticated=True,
        )
        self.assertEqual(
            url,
            "https://example.supabase.co/storage/v1/object/authenticated/"
            "mfl-runtime/health/database-refresh.json",
        )

    def test_upload_route_unchanged(self):
        from scripts.operations.runtime_health import _object_url

        self.assertEqual(
            _object_url("https://example.supabase.co", "health/database-refresh.json"),
            "https://example.supabase.co/storage/v1/object/"
            "mfl-runtime/health/database-refresh.json",
        )


if __name__ == "__main__":
    unittest.main()
