import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTACT_PAGES = [ROOT / "index.html", ROOT / "contact.html"]
EXPECTED_OPTIONS = {
    "": "Select inquiry type",
    "talent-creator-strategy": "Talent / Creator Strategy",
    "brand-partnership": "Brand Partnership",
    "app-development": "App Development",
    "ai-consulting": "AI Consulting",
    "media-press": "Media / Press",
    "general-business": "General Business",
}


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_contact_form = False
        self.in_select = False
        self.current_option_value = None
        self.selects = []
        self.options = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "form" and "contact-form" in attrs.get("class", ""):
            self.in_contact_form = True
        if self.in_contact_form and tag == "select":
            self.in_select = True
            self.selects.append(attrs)
        if self.in_select and tag == "option":
            self.current_option_value = attrs.get("value", "")
            self.options.append({"value": self.current_option_value, "text": ""})

    def handle_data(self, data):
        if self.in_select and self.current_option_value is not None and self.options:
            self.options[-1]["text"] += data.strip()

    def handle_endtag(self, tag):
        if tag == "option":
            self.current_option_value = None
        if tag == "select":
            self.in_select = False
        if tag == "form":
            self.in_contact_form = False


def parse_form(path):
    parser = FormParser()
    parser.feed(path.read_text())
    return parser


class ContactFormTests(unittest.TestCase):
    def test_contact_forms_include_required_inquiry_type_dropdown(self):
        for page in CONTACT_PAGES:
            with self.subTest(page=page.name):
                parser = parse_form(page)
                inquiry_selects = [select for select in parser.selects if select.get("name") == "inquiryType"]

                self.assertEqual(len(inquiry_selects), 1, f"{page.name} should include one inquiryType select")
                self.assertIn("required", inquiry_selects[0], f"{page.name} inquiryType select should be required")
                self.assertEqual(
                    inquiry_selects[0].get("autocomplete"),
                    "off",
                    f"{page.name} inquiryType should not autofill stale values",
                )

                actual_options = {option["value"]: option["text"] for option in parser.options}
                self.assertEqual(actual_options, EXPECTED_OPTIONS, f"{page.name} inquiryType options changed")

    def test_contact_form_select_is_styled_with_mobile_friendly_controls(self):
        css = (ROOT / "assets" / "site.css").read_text()

        self.assertIn(".contact-form select", css)
        self.assertIn("min-height: 48px", css)
        self.assertIn("appearance: none", css)
        self.assertIn("touch-action: manipulation", css)

    def test_contact_form_select_keeps_bdt_dark_gold_visual_treatment(self):
        css = (ROOT / "assets" / "site.css").read_text()

        self.assertIn("-webkit-appearance: none", css)
        self.assertIn("background-color: rgba(255, 255, 255, 0.035)", css)
        self.assertIn("box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.015)", css)
        self.assertIn("color: var(--text)", css)
        self.assertIn("font-size: 1rem", css)
        self.assertIn(".contact-form select:hover", css)
        self.assertIn(".contact-form select:focus", css)
        self.assertNotIn("background: white", css.lower())
        self.assertNotIn("background-color: white", css.lower())


if __name__ == "__main__":
    unittest.main()
