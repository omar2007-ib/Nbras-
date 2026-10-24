#!/usr/bin/env python3
"""Heuristic accessible-name checks for Athar HTML controls."""
from html.parser import HTMLParser
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", "node_modules", ".next", "dist", "build", "__pycache__"}
ROLES = {
    "button", "link", "checkbox", "radio", "switch", "tab", "menuitem",
    "menuitemcheckbox", "menuitemradio", "option", "textbox", "searchbox",
    "combobox", "slider", "spinbutton",
}
VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


def named(value):
    return isinstance(value, str) and bool(value.strip())


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.controls = []
        self.active_controls = []
        self.ids = {}
        self.active_ids = []
        self.labels = {}
        self.active_labels = []

    def handle_starttag(self, tag, raw_attrs):
        attrs = dict(raw_attrs)
        ident = attrs.get("id")
        if ident:
            self.ids.setdefault(ident, "")
            if tag not in VOID:
                self.active_ids.append({"tag": tag, "id": ident, "text": ""})
            elif tag == "img" and named(attrs.get("alt")):
                self.ids[ident] = attrs["alt"].strip()

        if tag == "label":
            self.active_labels.append({
                "tag": tag, "for": attrs.get("for", ""), "text": "", "wrapped": []
            })

        role = attrs.get("role", "").strip().lower()
        is_control = (
            (tag == "a" and "href" in attrs)
            or tag in {"button", "select", "textarea", "summary"}
            or (tag == "input" and attrs.get("type", "").strip().lower() != "hidden")
            or (tag == "area" and "href" in attrs)
            or role in ROLES
        )
        if is_control:
            item = {"tag": tag, "attrs": attrs, "text": "", "alt": ""}
            self.controls.append(item)
            if tag not in VOID:
                self.active_controls.append(item)
            if tag in {"input", "select", "textarea"}:
                for label in self.active_labels:
                    label["wrapped"].append(item)

        if tag == "img" and named(attrs.get("alt")):
            for item in self.active_controls:
                item["alt"] += attrs["alt"] + " "

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data):
        for item in self.active_controls:
            item["text"] += data
        for frame in self.active_ids:
            frame["text"] += data
        for label in self.active_labels:
            label["text"] += data

    def handle_endtag(self, tag):
        for i in range(len(self.active_controls) - 1, -1, -1):
            if self.active_controls[i]["tag"] == tag:
                del self.active_controls[i:]
                break

        for i in range(len(self.active_ids) - 1, -1, -1):
            if self.active_ids[i]["tag"] == tag:
                frame = self.active_ids.pop(i)
                self.ids[frame["id"]] = frame["text"].strip()
                break

        for i in range(len(self.active_labels) - 1, -1, -1):
            if self.active_labels[i]["tag"] == tag:
                label = self.active_labels.pop(i)
                value = label["text"].strip()
                if label["for"]:
                    key = label["for"]
                    self.labels[key] = (self.labels.get(key, "") + " " + value).strip()
                for wrapped_control in label["wrapped"]:
                    wrapped_control["native_label"] = (
                        wrapped_control.get("native_label", "") + " " + value
                    ).strip()
                break

    def errors_for(self, relative_path):
        errors = []
        for item in self.controls:
            attrs, tag = item["attrs"], item["tag"]
            if "hidden" in attrs or attrs.get("aria-hidden", "").strip().lower() == "true":
                continue

            labelledby = attrs.get("aria-labelledby", "").split()
            missing_refs = [ref for ref in labelledby if ref not in self.ids]
            if missing_refs:
                errors.append(
                    f"{relative_path}: <{tag}> references missing aria-labelledby id(s): "
                    f"{', '.join(missing_refs)}."
                )
            valid_labelledby = bool(labelledby) and all(
                named(self.ids.get(ref, "")) for ref in labelledby
            )
            input_type = attrs.get("type", "").strip().lower()
            value_name = (
                tag == "input"
                and input_type in {"submit", "button", "reset"}
                and named(attrs.get("value", ""))
            )
            role = attrs.get("role", "").strip().lower()
            text_name = tag in {"a", "button", "summary"} or role in {
                "button", "link", "checkbox", "radio", "switch", "tab",
                "menuitem", "menuitemcheckbox", "menuitemradio", "option",
            }
            has_name = (
                named(attrs.get("aria-label", ""))
                or valid_labelledby
                or (text_name and named(item["text"]))
                or named(item["alt"])
                or named(attrs.get("title", ""))
                or named(attrs.get("alt", ""))
                or named(item.get("native_label", ""))
                or named(self.labels.get(attrs.get("id", ""), ""))
                or value_name
            )
            if not has_name:
                errors.append(
                    f"{relative_path}: <{tag}> has no accessible name "
                    "(text, aria-label/labelledby, native label, alt, or title)."
                )
        return errors


def audit_html(source, relative_path="<memory>"):
    parser = Parser()
    try:
        parser.feed(source)
        parser.close()
    except Exception as exc:
        return [f"{relative_path}: HTML parsing failed ({type(exc).__name__})."]
    return parser.errors_for(relative_path)


def audit(root):
    root = Path(root).resolve()
    if not root.is_dir():
        return 0, [f"HTML root does not exist: {root}"]
    pages = sorted(
        page for page in root.rglob("*.html")
        if not any(part in SKIP for part in page.relative_to(root).parts)
    )
    if not pages:
        return 0, ["No HTML pages found."]

    errors = []
    for page in pages:
        relative = page.relative_to(root).as_posix()
        try:
            errors.extend(audit_html(page.read_text(encoding="utf-8"), relative))
        except (OSError, UnicodeDecodeError):
            errors.append(f"{relative}: could not read UTF-8 HTML.")
    return len(pages), errors


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--root", type=Path, default=ROOT, help="HTML root to scan")
    args = cli.parse_args()
    count, errors = audit(args.root)
    print(f"Accessible-name audit: {count} HTML page(s) scanned.")
    for error in errors:
        print("FAIL: " + error)
    if errors:
        print(f"Result: FAILED ({len(errors)} issue(s)).")
        return 1
    print("Result: PASSED.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
