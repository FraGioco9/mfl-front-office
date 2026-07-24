import unittest

from flow_block_height import extract_latest_block_height
from flow_data import FlowRequestError


class FlowBlockHeightTests(unittest.TestCase):
    def test_extracts_legacy_root_height(self):
        self.assertEqual(extract_latest_block_height([{"height": "123"}]), 123)

    def test_extracts_height_from_current_header_shape(self):
        self.assertEqual(
            extract_latest_block_height([{"header": {"height": "456"}}]),
            456,
        )

    def test_extracts_height_from_wrapped_blocks_shape(self):
        self.assertEqual(
            extract_latest_block_height({"blocks": [{"block": {"header": {"height": "789"}}}]}),
            789,
        )

    def test_rejects_response_without_height(self):
        with self.assertRaises(FlowRequestError):
            extract_latest_block_height([{"header": {"id": "abc"}}])


if __name__ == "__main__":
    unittest.main()
