"""Exercise CLI model configuration without contacting a model service."""

import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

import ai_interpreter
from liuyao import _interpret
import main


class AIConfigTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {}, clear=True)
        env.start()
        self.addCleanup(env.stop)

    def test_templates_leave_ai_disabled_and_allow_legacy_credentials(self):
        root = Path(__file__).resolve().parent
        for template in (root / ".env.example", root / "web/.env.example"):
            with self.subTest(template=template.name):
                with patch.dict(os.environ, {}, clear=True):
                    ai_interpreter._load_dotenv(template)
                    self.assertFalse(ai_interpreter.is_available())
                with patch.dict(os.environ, {"DEEPSEEK_API_KEY": "legacy-key"}, clear=True):
                    ai_interpreter._load_dotenv(template)
                    self.assertEqual(ai_interpreter._read_api_key(), "legacy-key")

    def test_interpret_uses_configured_provider_and_key_precedence(self):
        yaos = [_interpret("100", i) for i in range(6)]
        cases = [
            ({"LLM_API_KEY": "generic-key"}, "generic-key"),
            ({"LLM_API_KEY": "generic-key", "DEEPSEEK_API_KEY": "legacy-key"}, "generic-key"),
            ({"DEEPSEEK_API_KEY": "legacy-key"}, "legacy-key"),
            ({"LLM_API_KEY": "", "DEEPSEEK_API_KEY": "legacy-key"}, "legacy-key"),
        ]
        for keys, expected_key in cases:
            env = {**keys, "LLM_BASE_URL": "https://provider.example/v1/", "LLM_MODEL": "provider-model"}
            with self.subTest(keys=keys), patch.dict(os.environ, env, clear=True):
                response = io.BytesIO(json.dumps({"choices": [{"message": {"content": "测试解读"}}]}).encode())
                with patch("urllib.request.urlopen", return_value=response) as upstream:
                    self.assertEqual(ai_interpreter.interpret("测试", yaos, "111111", "111111"), "测试解读")
                request = upstream.call_args.args[0]
                self.assertEqual(request.full_url, "https://provider.example/v1/chat/completions")
                self.assertEqual(request.get_header("Authorization"), f"Bearer {expected_key}")
                self.assertEqual(json.loads(request.data)["model"], "provider-model")

    def test_list_models_uses_configured_provider_and_generic_key(self):
        os.environ.update(LLM_API_KEY="generic-key", DEEPSEEK_API_KEY="legacy-key", LLM_BASE_URL="https://provider.example/v1/")
        response = io.BytesIO(b'{"data":[{"id":"provider-model"}]}')
        with patch("urllib.request.urlopen", return_value=response) as upstream:
            self.assertEqual(ai_interpreter.list_models(), ["provider-model"])
        request = upstream.call_args.args[0]
        self.assertEqual(request.full_url, "https://provider.example/v1/models")
        self.assertEqual(request.get_header("Authorization"), "Bearer generic-key")

    def test_missing_key_never_contacts_upstream(self):
        with patch("urllib.request.urlopen") as upstream:
            with self.assertRaisesRegex(RuntimeError, "LLM_API_KEY"):
                ai_interpreter.interpret("测试", [], "111111", "111111")
            with self.assertRaisesRegex(RuntimeError, "LLM_API_KEY"):
                ai_interpreter.list_models()
        upstream.assert_not_called()

    def test_cli_marks_configured_model_instead_of_builtin_default(self):
        os.environ["LLM_MODEL"] = "provider-model"
        output = io.StringIO()
        with patch("sys.argv", ["main.py", "--list-models"]), patch("sys.stdout", output):
            with patch.object(ai_interpreter, "list_models", return_value=["deepseek-chat", "provider-model"]):
                main.main()
        marked_lines = [line for line in output.getvalue().splitlines() if "←" in line]
        self.assertEqual(len(marked_lines), 1)
        self.assertIn("provider-model", marked_lines[0])


if __name__ == "__main__":
    unittest.main()
