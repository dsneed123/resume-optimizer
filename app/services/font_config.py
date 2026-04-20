from pathlib import Path

_FONTS_DIR = Path(__file__).parent.parent / "static" / "fonts"

# Maps UI font names to CSS font stacks and optional bundled fallback fonts.
# Bundled fonts in app/static/fonts/ are declared via @font-face so they
# activate when the system font is absent (e.g. Calibri on Linux).
FONT_CONFIG: dict[str, dict] = {
    "Helvetica": {
        "css_family": "Helvetica, 'Helvetica Neue'",
        "bundled": None,
    },
    "Arial": {
        "css_family": "Arial",
        "bundled": None,
    },
    "Times New Roman": {
        "css_family": "'Times New Roman', Times",
        "bundled": None,
    },
    "Georgia": {
        "css_family": "Georgia",
        "bundled": None,
    },
    "Calibri": {
        "css_family": "Calibri, Carlito",
        "bundled": {
            "family_name": "Carlito",
            "files": [
                {"path": "Carlito-Regular.ttf", "weight": "normal", "style": "normal"},
                {"path": "Carlito-Bold.ttf", "weight": "bold", "style": "normal"},
                {"path": "Carlito-Italic.ttf", "weight": "normal", "style": "italic"},
            ],
        },
    },
    "Garamond": {
        "css_family": "Garamond, 'EB Garamond'",
        "bundled": {
            "family_name": "EB Garamond",
            "files": [
                {"path": "EBGaramond-Regular.ttf", "weight": "normal", "style": "normal"},
                {"path": "EBGaramond-Bold.ttf", "weight": "bold", "style": "normal"},
                {"path": "EBGaramond-Italic.ttf", "weight": "normal", "style": "italic"},
            ],
        },
    },
}


def build_font_face_css(font_family: str) -> str:
    """Return @font-face CSS blocks for the bundled fallback font of *font_family*.

    WeasyPrint resolves relative src URLs against the base_url (app/static/),
    so paths use the fonts/ prefix.
    """
    config = FONT_CONFIG.get(font_family)
    if not config or not config["bundled"]:
        return ""

    bundled = config["bundled"]
    parts: list[str] = []
    for f in bundled["files"]:
        if (_FONTS_DIR / f["path"]).exists():
            parts.append(
                f"@font-face {{\n"
                f"  font-family: '{bundled['family_name']}';\n"
                f"  font-weight: {f['weight']};\n"
                f"  font-style: {f['style']};\n"
                f"  src: url('fonts/{f['path']}') format('truetype');\n"
                f"}}"
            )
    return "\n".join(parts)


def get_css_family(font_family: str) -> str:
    """Return the CSS font-family stack for *font_family*, falling back to Helvetica."""
    config = FONT_CONFIG.get(font_family)
    base = config["css_family"] if config else font_family
    return f"{base}, Helvetica, sans-serif"
