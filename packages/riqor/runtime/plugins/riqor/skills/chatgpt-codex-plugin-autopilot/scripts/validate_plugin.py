#!/usr/bin/env python3
"""Dependency-free ChatGPT/Codex public plugin preflight validator."""
from __future__ import annotations

import argparse
import json
import os
import re
import stat
import struct
import sys
import unicodedata
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

MAX_ENTRIES = 5000
MAX_TOTAL = 512 * 1024 * 1024
MAX_MEMBER = 100 * 1024 * 1024
MAX_IMAGE = 5 * 1024 * 1024
MAX_ARCHIVE = 100 * 1000 * 1000
HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")
PLUGIN_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
CATEGORIES = {
    "Productivity", "Creativity", "Developer Tools", "Business & Operations",
    "Data & Analytics", "Communication", "Education & Research", "Security",
    "Finance", "Healthcare", "Travel", "Entertainment", "Other",
}
TEXT_SUFFIXES = {
    ".md", ".txt", ".json", ".jsonl", ".yaml", ".yml", ".toml", ".xml",
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".sh", ".zsh",
    ".html", ".css", ".svg",
}
SECRET_BASENAME = re.compile(
    r"^(?:\.env(?:\..*)?|auth\.json|credentials?(?:\..*)?|secrets?(?:\..*)?|\.npmrc|\.pypirc)$",
    re.I,
)


def _error(errors: list[str], message: str) -> None:
    errors.append(message)


def _load_json(path: Path, errors: list[str]) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        _error(errors, f"manifest unreadable: {exc}")
        return {}
    if not isinstance(value, dict):
        _error(errors, "manifest must be a JSON object")
        return {}
    return value


def _https(value: object, field: str, errors: list[str], required: bool = False) -> None:
    if value is None:
        if required:
            _error(errors, f"interface.{field} is required for MCP-backed public submission")
        return
    if not isinstance(value, str) or not value:
        _error(errors, f"interface.{field} must be a non-empty HTTPS URL")
        return
    if len(value) > 1024:
        _error(errors, f"interface.{field} exceeds final directory limit of 1024 characters")
    parsed = urlparse(value)
    if parsed.scheme.lower() != "https" or not parsed.netloc or parsed.username or parsed.password:
        _error(errors, f"interface.{field} must be an HTTPS URL without embedded credentials")


def _public_https(value: object, field: str, errors: list[str], limit: int = 2048) -> None:
    if value is None:
        return
    if not isinstance(value, str) or not value:
        _error(errors, f"{field} must be a non-empty HTTPS URL")
        return
    if len(value) > limit:
        _error(errors, f"{field} must be <={limit} characters")
    parsed = urlparse(value)
    if parsed.scheme.lower() != "https" or not parsed.netloc or parsed.username or parsed.password:
        _error(errors, f"{field} must be an HTTPS URL without embedded credentials")


def _component_path(root: Path, manifest: dict, field: str, expected: str, errors: list[str], required: bool = False) -> bool:
    value = manifest.get(field)
    if value is None:
        if required:
            _error(errors, f"manifest {field} path is required")
        return False
    if not isinstance(value, str) or not value:
        _error(errors, f"manifest {field} path must be a non-empty string")
        return False
    if not value.startswith("./"):
        _error(errors, f"manifest {field} path must start with ./: {value}")
    normalized = value[2:] if value.startswith("./") else value
    if normalized.rstrip("/") != expected.rstrip("/"):
        _error(errors, f"manifest {field} path must resolve to ./{expected}: {value}")
        return False
    candidate = root / expected
    if expected.endswith("/"):
        if not candidate.is_dir():
            _error(errors, f"manifest {field} directory is missing: ./{expected}")
            return False
    elif not candidate.is_file():
        _error(errors, f"manifest {field} file is missing: ./{expected}")
        return False
    return True


def _relative_file_path(root: Path, field: str, value: object, errors: list[str], required: bool = False) -> Path | None:
    if value is None:
        if required:
            _error(errors, f"{field} is required")
        return None
    if not isinstance(value, str) or not value:
        _error(errors, f"{field} must be a non-empty relative file path")
        return None
    if not value.startswith("./"):
        _error(errors, f"{field} path must start with ./: {value}")
    relative = value[2:] if value.startswith("./") else value
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        _error(errors, f"{field} path escapes plugin root: {value}")
        return None
    return candidate


def _luminance(hex_color: str) -> float:
    channels = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast(a: str, b: str) -> float:
    high, low = sorted((_luminance(a), _luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def _validate_brand_color(interface: dict, field: str, background: str, errors: list[str]) -> None:
    value = interface.get(field)
    if value is None:
        return
    if not isinstance(value, str) or not HEX_COLOR.fullmatch(value):
        _error(errors, f"interface.{field} must be a six-digit hex color")
        return
    if _contrast(value, background) < 2.0:
        _error(errors, f"interface.{field} must have at least 2:1 contrast against {background}")


def _numeric_dimension(value: str | None) -> float | None:
    if value is None or not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", value.strip()):
        return None
    try:
        result = float(value)
        return result if result > 0 else None
    except ValueError:
        return None


def _svg_size(path: Path) -> tuple[float, float]:
    root = ET.fromstring(path.read_text(encoding="utf-8"))
    if root.tag.split("}")[-1].lower() != "svg":
        raise ValueError("SVG root element must be <svg>")
    view_box = root.attrib.get("viewBox") or root.attrib.get("viewbox")
    if view_box:
        values = [float(item) for item in re.split(r"[\s,]+", view_box.strip()) if item]
        if len(values) != 4 or values[2] <= 0 or values[3] <= 0:
            raise ValueError("SVG viewBox must contain four positive dimensions")
        return values[2], values[3]
    width = _numeric_dimension(root.attrib.get("width"))
    height = _numeric_dimension(root.attrib.get("height"))
    if width is None or height is None:
        raise ValueError("SVG must declare numeric viewBox or width/height")
    return width, height


def _png_size(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("invalid PNG")
    return struct.unpack(">II", data[16:24])


def _jpeg_size(data: bytes) -> tuple[int, int]:
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        raise ValueError("invalid JPEG")
    index = 2
    sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while index + 4 <= len(data):
        while index < len(data) and data[index] != 0xFF:
            index += 1
        while index < len(data) and data[index] == 0xFF:
            index += 1
        if index >= len(data):
            break
        marker = data[index]
        index += 1
        if marker in {0xD8, 0xD9}:
            continue
        if index + 2 > len(data):
            break
        length = struct.unpack(">H", data[index:index + 2])[0]
        if length < 2 or index + length > len(data):
            break
        if marker in sof and length >= 7:
            height, width = struct.unpack(">HH", data[index + 3:index + 7])
            return width, height
        index += length
    raise ValueError("JPEG dimensions not found")


def _webp_size(data: bytes) -> tuple[int, int]:
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("invalid WebP")
    kind = data[12:16]
    if kind == b"VP8X":
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return width, height
    if kind == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if kind == b"VP8 " and len(data) >= 30:
        frame = data.find(b"\x9d\x01\x2a", 20)
        if frame >= 0 and frame + 7 <= len(data):
            width, height = struct.unpack("<HH", data[frame + 3:frame + 7])
            return width & 0x3FFF, height & 0x3FFF
    raise ValueError("WebP dimensions not found")


def _image_size(path: Path) -> tuple[float, float]:
    suffix = path.suffix.lower()
    if suffix == ".svg":
        return _svg_size(path)
    data = path.read_bytes()
    if suffix == ".png":
        return _png_size(data)
    if suffix in {".jpg", ".jpeg"}:
        return _jpeg_size(data)
    if suffix == ".webp":
        return _webp_size(data)
    raise ValueError("unsupported image format")


def _validate_image(root: Path, field: str, value: object, errors: list[str]) -> None:
    if not isinstance(value, str) or not value:
        _error(errors, f"interface.{field} is required and must reference a square image")
        return
    candidate = _relative_file_path(root, f"interface.{field}", value, errors, required=True)
    if candidate is None:
        return
    if not candidate.is_file():
        _error(errors, f"interface.{field} asset is missing: {value}")
        return
    if candidate.stat().st_size > MAX_IMAGE:
        _error(errors, f"interface.{field} image exceeds 5 MiB: {value}")
    if candidate.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        _error(errors, f"interface.{field} image format is unsupported: {value}")
        return
    try:
        width, height = _image_size(candidate)
    except Exception as exc:
        _error(errors, f"interface.{field} image unreadable: {value}: {exc}")
        return
    if width != height:
        _error(errors, f"interface.{field} image must be square: {value}")
    if width < 48 or height < 48:
        _error(errors, f"interface.{field} image dimensions must be at least 48x48: {value}")
    if candidate.suffix.lower() != ".svg" and (width > 4096 or height > 4096):
        _error(errors, f"interface.{field} raster dimensions exceed 4096x4096: {value}")


def _skill_metadata(path: Path) -> tuple[str | None, str | None]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return None, None
    end = text.find("\n---", 4)
    if end < 0:
        return None, None
    frontmatter = text[4:end]
    name = re.search(r"(?m)^name:\s*[\"']?([^\n\"']+)", frontmatter)
    description = re.search(r"(?m)^description:\s*(.+)$", frontmatter)
    return (name.group(1).strip() if name else None, description.group(1).strip() if description else None)


def _walk(root: Path, errors: list[str], exclusions: list[str]) -> tuple[list[Path], int, int]:
    files: list[Path] = []
    directories: set[Path] = set()
    total = 0
    normalized: dict[str, str] = {}
    absolute_user_path = re.compile(r"/(?:Users|home)/[A-Za-z0-9._-]+/")
    for current, dirs, names in os.walk(root, topdown=True, followlinks=False):
        current_path = Path(current)
        for name in list(dirs):
            path = current_path / name
            if path.is_symlink():
                _error(errors, f"symlink is not allowed in public plugin: {path.relative_to(root)}")
                dirs.remove(name)
                continue
            directories.add(path)
        for name in names:
            path = current_path / name
            rel = path.relative_to(root).as_posix()
            if rel != rel.strip():
                _error(errors, f"archive member path has outer whitespace: {rel!r}")
            segments = rel.split("/")
            if any(segment != segment.strip() for segment in segments):
                _error(errors, f"archive member path segment has outer whitespace: {rel!r}")
            if len(segments) > 20:
                _error(errors, f"archive member path must contain at most 20 segments: {rel}")
            try:
                mode = path.lstat().st_mode
            except OSError as exc:
                _error(errors, f"unreadable plugin member {rel}: {exc}")
                continue
            if stat.S_ISLNK(mode):
                _error(errors, f"symlink is not allowed in public plugin: {rel}")
                continue
            if not stat.S_ISREG(mode):
                _error(errors, f"unsupported plugin member type: {rel}")
                continue
            size = path.stat().st_size
            files.append(path)
            total += size
            if size > MAX_MEMBER:
                _error(errors, f"plugin member exceeds 100 MiB: {rel}")
            base = path.name
            if base in {".DS_Store", "Thumbs.db"} or base.startswith("._"):
                _error(errors, f"operating-system metadata is not allowed: {rel}")
            if SECRET_BASENAME.match(base):
                _error(errors, f"secret-shaped file is not allowed in public plugin: {rel}")
            normalized_key = unicodedata.normalize("NFC", rel).casefold()
            previous = normalized.get(normalized_key)
            if previous is not None and previous != rel:
                _error(errors, f"path normalization collision: {previous} vs {rel}")
            normalized[normalized_key] = rel
            for slug in exclusions:
                if slug and (slug in Path(rel).parts or slug in rel):
                    _error(errors, f"public exclusion remains in plugin path: {slug}: {rel}")
            if size <= 1024 * 1024 and path.suffix.lower() in TEXT_SUFFIXES:
                try:
                    text = path.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    text = ""
                if absolute_user_path.search(text):
                    _error(errors, f"absolute user path found in public text file: {rel}")
                for slug in exclusions:
                    if slug and slug in text:
                        _error(errors, f"public exclusion remains in plugin text: {slug}: {rel}")
    entry_count = len(files) + len(directories)
    if entry_count > MAX_ENTRIES:
        _error(errors, f"plugin would exceed 5000 archive entries: {entry_count}")
    if total > MAX_TOTAL:
        _error(errors, f"plugin extracted size exceeds 512 MiB: {total}")
    return sorted(files), entry_count, total


def validate_plugin(plugin_root: str, exclusions: list[str] | None = None) -> dict:
    root = Path(plugin_root).expanduser().resolve()
    exclusions = sorted({item for item in (exclusions or []) if item})
    errors: list[str] = []
    warnings: list[str] = []
    if not root.is_dir():
        return {"ok": False, "architecture": "unknown", "skills": [], "errors": [f"plugin root is not a directory: {root}"], "warnings": []}

    manifest_path = root / ".codex-plugin" / "plugin.json"
    if not manifest_path.is_file():
        _error(errors, "missing .codex-plugin/plugin.json")
        manifest: dict = {}
    else:
        manifest = _load_json(manifest_path, errors)

    name = manifest.get("name")
    if not isinstance(name, str) or not PLUGIN_NAME.fullmatch(name):
        _error(errors, "plugin name must be 1..64 characters using supported ASCII letters, digits, _ or -")
    version = manifest.get("version")
    if not isinstance(version, str) or len(version) > 64 or not SEMVER.fullmatch(version):
        _error(errors, "plugin version must be strict semver and <=64 characters")
    description = manifest.get("description")
    if not isinstance(description, str) or not description or len(description) > 1024:
        _error(errors, "plugin description is required and must be <=1024 characters")
    author = manifest.get("author")
    author_name = author.get("name") if isinstance(author, dict) else None
    if not isinstance(author_name, str) or not author_name or len(author_name) > 120:
        _error(errors, "author.name is required and must be <=120 characters")
    if isinstance(author, dict):
        _public_https(author.get("url"), "author.url", errors, 2048)
    _public_https(manifest.get("homepage"), "homepage", errors, 2048)

    mcp_declared = _component_path(root, manifest, "mcpServers", ".mcp.json", errors) if "mcpServers" in manifest else False
    apps_declared = _component_path(root, manifest, "apps", ".app.json", errors) if "apps" in manifest else False
    if "hooks" in manifest:
        hook_value = manifest.get("hooks")
        hook_path = _relative_file_path(root, "manifest hooks", hook_value, errors)
        if hook_path is not None and not hook_path.is_file():
            _error(errors, f"manifest hooks file is missing: {hook_value}")
    has_mcp = mcp_declared or apps_declared or (root / ".mcp.json").exists() or (root / ".app.json").exists()
    skill_path_value = manifest.get("skills", "./skills/")
    has_skills = False
    skills: list[str] = []
    if isinstance(skill_path_value, str):
        if not skill_path_value.startswith("./"):
            _error(errors, f"manifest skills path must start with ./: {skill_path_value}")
        relative = skill_path_value[2:] if skill_path_value.startswith("./") else skill_path_value
        if relative.rstrip("/") != "skills":
            _error(errors, f"manifest skills path must resolve to ./skills/: {skill_path_value}")
        skill_root = (root / relative).resolve()
        try:
            skill_root.relative_to(root)
        except ValueError:
            _error(errors, f"manifest skills path escapes plugin root: {skill_path_value}")
            skill_root = root / "__invalid__"
        if skill_root.is_dir():
            for directory in sorted((item for item in skill_root.iterdir() if item.is_dir()), key=lambda item: item.name):
                definition = directory / "SKILL.md"
                if not definition.is_file():
                    _error(errors, f"skill directory is missing SKILL.md: {directory.name}")
                    continue
                try:
                    skill_name, skill_description = _skill_metadata(definition)
                except Exception as exc:
                    _error(errors, f"skill definition unreadable: {directory.name}: {exc}")
                    continue
                if skill_name != directory.name:
                    _error(errors, f"skill name must match directory: {directory.name}")
                if not skill_description:
                    _error(errors, f"skill description is required: {directory.name}")
                elif len(skill_description.strip("\"'")) > 1024:
                    _error(errors, f"skill description exceeds 1024 characters: {directory.name}")
                try:
                    skill_text = definition.read_text(encoding="utf-8")
                    front_end = skill_text.find("\n---", 4)
                    body = skill_text[front_end + 4:].strip() if front_end >= 0 else ""
                    if not body:
                        _error(errors, f"skill body must not be empty: {directory.name}")
                except Exception as exc:
                    _error(errors, f"skill body unreadable: {directory.name}: {exc}")
                if isinstance(name, str) and skill_name and len(f"{name}:{skill_name}") > 64:
                    _error(errors, f"combined plugin and skill identity exceeds 64 characters: {directory.name}")
                if directory.name.startswith("."):
                    _error(errors, f"skill directory must not be hidden: {directory.name}")
                skills.append(directory.name)
            has_skills = bool(skills)
        elif "skills" in manifest:
            _error(errors, f"manifest skills path is missing: {skill_path_value}")
    else:
        _error(errors, "manifest skills must be a relative path string")

    architecture = "hybrid" if has_mcp and has_skills else "MCP-backed" if has_mcp else "skills-only"
    if not has_skills and not has_mcp:
        _error(errors, "plugin must contain at least one Skill or an MCP-backed capability")

    interface = manifest.get("interface")
    if not isinstance(interface, dict):
        _error(errors, "manifest interface is required and must be an object")
        interface = {}
    for field, limit in (("displayName", 30), ("shortDescription", 30), ("longDescription", 4000), ("developerName", 80)):
        value = interface.get(field)
        if not isinstance(value, str) or not value:
            _error(errors, f"interface.{field} is required")
        elif len(value) > limit:
            _error(errors, f"interface.{field} exceeds final directory limit of {limit} characters")
        if field == "shortDescription" and isinstance(value, str) and ("\n" in value or "\r" in value):
            _error(errors, "interface.shortDescription must fit on one line")
    category = interface.get("category")
    if not isinstance(category, str) or not category:
        _error(errors, "interface.category is required for final directory submission")
    elif category not in CATEGORIES:
        _error(errors, f"interface.category is unsupported: {category}")
    capabilities = interface.get("capabilities")
    if capabilities is not None:
        if not isinstance(capabilities, list) or len(capabilities) > 20:
            _error(errors, "interface.capabilities must be an array with at most 20 items")
        elif any(not isinstance(item, str) or not item or len(item) > 120 or "\n" in item or "\r" in item for item in capabilities):
            _error(errors, "each interface.capabilities item must be a non-empty one-line string <=120 characters")

    prompts = interface.get("defaultPrompt")
    if prompts is not None:
        prompt_list = [prompts] if isinstance(prompts, str) else prompts if isinstance(prompts, list) else None
        if prompt_list is None:
            _error(errors, "interface.defaultPrompt must be a string or list of strings")
        else:
            if len(prompt_list) > 3:
                _error(errors, "interface.defaultPrompt must contain at most 3 prompts")
            normalized_prompts: set[str] = set()
            for prompt in prompt_list:
                if not isinstance(prompt, str) or not prompt.strip():
                    _error(errors, "each interface.defaultPrompt must be a non-empty string")
                    continue
                if len(prompt) > 128 or "\n" in prompt or "\r" in prompt:
                    _error(errors, "each interface.defaultPrompt must be one line and <=128 characters")
                if re.search(r"(?<![A-Za-z0-9._%+-])@[A-Za-z0-9_-]+", prompt):
                    _error(errors, "interface.defaultPrompt must not contain an app @mention")
                normalized_prompt = " ".join(unicodedata.normalize("NFKC", prompt).split()).casefold()
                if normalized_prompt in normalized_prompts:
                    _error(errors, "interface.defaultPrompt entries must be unique after normalization")
                normalized_prompts.add(normalized_prompt)

    _validate_brand_color(interface, "brandColor", "#FFFFFF", errors)
    _validate_brand_color(interface, "brandColorDark", "#212121", errors)

    for field in ("websiteURL", "privacyPolicyURL", "termsOfServiceURL", "supportURL"):
        _https(interface.get(field), field, errors, required=has_mcp)
    _validate_image(root, "logo", interface.get("logo"), errors)
    _validate_image(root, "composerIcon", interface.get("composerIcon"), errors)

    files, entry_count, total_bytes = _walk(root, errors, exclusions)
    if not exclusions:
        warnings.append("no explicit public exclusions supplied; confirm the repository has no internal-only capabilities")

    return {
        "ok": not errors,
        "pluginRoot": str(root),
        "name": name if isinstance(name, str) else "",
        "version": version if isinstance(version, str) else "",
        "architecture": architecture,
        "skills": skills,
        "exclusions": exclusions,
        "entries": entry_count,
        "uncompressedBytes": total_bytes,
        "files": len(files),
        "errors": errors,
        "warnings": warnings,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plugin_root")
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument("--exclude", action="append", default=[], help="public capability slug that must not occur in paths or text")
    args = parser.parse_args(argv)
    report = validate_plugin(args.plugin_root, args.exclude)
    if args.as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print("plugin preflight: " + ("PASS" if report["ok"] else "FAIL"))
        print(f"architecture: {report['architecture']}; skills: {len(report['skills'])}; entries: {report['entries']}")
        for warning in report["warnings"]:
            print(f"warning: {warning}")
        for error in report["errors"]:
            print(f"error: {error}", file=sys.stderr)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
