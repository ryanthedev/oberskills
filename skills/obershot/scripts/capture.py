#!/usr/bin/env python3
"""
obershot capture script - Cross-platform screenshot with context-efficient output.

Usage:
    python capture.py [--mode full|active|window] [--name NAME] [--output DIR] [--thumb-width WIDTH]
    python capture.py --list-windows

Modes:
    full    - Capture entire screen (default)
    active  - Capture the frontmost window
    window  - Capture a specific window by name (requires --name)

Outputs:
    - Full resolution: {output}/obershot_full.png
    - Thumbnail: {output}/obershot_thumb.png (default 480px width)
    - Metadata JSON to stdout
"""

import argparse
import json
import platform
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

try:
    import mss
    import mss.tools
except ImportError:
    print("Error: mss not installed. Run: pip install mss", file=sys.stderr)
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow not installed. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)


def get_active_window_bounds():
    """Get active window bounds. Returns (x, y, width, height) or None."""
    system = platform.system()

    if system == "Darwin":  # macOS
        try:
            # Get active window info using AppleScript
            script = '''
            tell application "System Events"
                set frontApp to first application process whose frontmost is true
                set frontWindow to first window of frontApp
                set {x, y} to position of frontWindow
                set {w, h} to size of frontWindow
                return {x, y, w, h}
            end tell
            '''
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                # Parse "x, y, w, h" format
                values = [int(v.strip()) for v in result.stdout.strip().split(",")]
                return {"left": values[0], "top": values[1],
                        "width": values[2], "height": values[3]}
        except Exception as e:
            print(f"Warning: Could not get active window: {e}", file=sys.stderr)
            return None

    elif system == "Windows":
        try:
            import ctypes
            from ctypes import wintypes

            user32 = ctypes.windll.user32
            hwnd = user32.GetForegroundWindow()

            rect = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))

            return {
                "left": rect.left,
                "top": rect.top,
                "width": rect.right - rect.left,
                "height": rect.bottom - rect.top
            }
        except Exception as e:
            print(f"Warning: Could not get active window: {e}", file=sys.stderr)
            return None

    elif system == "Linux":
        try:
            # Use xdotool to get active window geometry
            result = subprocess.run(
                ["xdotool", "getactivewindow", "getwindowgeometry", "--shell"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                geo = {}
                for line in result.stdout.strip().split("\n"):
                    if "=" in line:
                        key, val = line.split("=")
                        geo[key] = int(val)
                return {
                    "left": geo.get("X", 0),
                    "top": geo.get("Y", 0),
                    "width": geo.get("WIDTH", 800),
                    "height": geo.get("HEIGHT", 600)
                }
        except Exception as e:
            print(f"Warning: Could not get active window: {e}", file=sys.stderr)
            return None

    return None


def _run_thegrid(*args):
    """Run a thegrid subcommand and return parsed JSON.

    Raises RuntimeError if thegrid is not installed, not running, or the
    command fails. The caller should start grid-server if thegrid reports
    it is not running.
    """
    result = subprocess.run(
        ["thegrid"] + list(args) + ["--json"],
        capture_output=True, text=True, timeout=10
    )
    if result.returncode != 0:
        stderr = result.stderr.strip()
        if "not running" in stderr.lower() or "connection refused" in stderr.lower():
            raise RuntimeError(
                f"thegrid is not running. Start grid-server first.\nDetails: {stderr}"
            )
        raise RuntimeError(f"thegrid command failed: {stderr}")
    return json.loads(result.stdout)


def list_windows():
    """List visible windows via thegrid. Returns list of dicts with id, name, owner."""
    windows = _run_thegrid("list", "windows")
    return [{"id": w["id"], "name": w["title"], "owner": w["appName"]} for w in windows]


def find_window_by_name(name):
    """Find a window by name substring via thegrid. Returns dict with id, name, owner.

    thegrid handles case-insensitive substring matching. Raises RuntimeError with
    available windows listed if no match is found.
    """
    matches = _run_thegrid("window", "find", name)
    if not matches:
        available = list_windows()
        available_str = "\n  ".join(
            f"{w['owner']}: {w['name']}" for w in available[:20]
        )
        raise RuntimeError(
            f"No window matching '{name}'. Available windows:\n  {available_str}"
        )
    match = matches[0]
    return {"id": match["id"], "name": match["title"], "owner": match["appName"]}


def capture_named_window(name, output_path):
    """Capture a specific window by name. Returns (width, height, window_info)."""
    window_info = find_window_by_name(name)
    subprocess.run(
        ["screencapture", "-x", "-o", "-l", str(window_info["id"]), str(output_path)],
        check=True, timeout=10
    )
    with Image.open(output_path) as img:
        return img.width, img.height, window_info


def capture_screenshot(mode="full", output_dir=None, thumb_width=480, window_name=None):
    """Capture screenshot and create thumbnail."""

    if output_dir is None:
        output_dir = tempfile.gettempdir()

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    full_path = output_dir / "obershot_full.png"
    thumb_path = output_dir / "obershot_thumb.png"

    window_info = None

    if mode == "window":
        if not window_name:
            raise ValueError("--name is required for window mode")
        width, height, window_info = capture_named_window(window_name, full_path)

    else:
        with mss.mss() as sct:
            if mode == "active":
                bounds = get_active_window_bounds()
                if bounds:
                    monitor = bounds
                else:
                    print("Warning: Falling back to full screen capture", file=sys.stderr)
                    monitor = sct.monitors[0]
            else:
                monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]

            screenshot = sct.grab(monitor)
            mss.tools.to_png(screenshot.rgb, screenshot.size, output=str(full_path))
            width, height = screenshot.size

    # Create thumbnail with Pillow
    with Image.open(full_path) as img:
        ratio = thumb_width / img.width
        thumb_height = int(img.height * ratio)
        thumb = img.resize((thumb_width, thumb_height), Image.LANCZOS)
        thumb.save(thumb_path, "PNG", optimize=True)

    # Build metadata
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "mode": mode,
        "platform": platform.system(),
        "full_resolution": {
            "path": str(full_path),
            "width": width,
            "height": height,
            "size_bytes": full_path.stat().st_size
        },
        "thumbnail": {
            "path": str(thumb_path),
            "width": thumb_width,
            "height": thumb_height,
            "size_bytes": thumb_path.stat().st_size
        }
    }

    if window_info:
        metadata["window"] = {
            "matched_name": window_info.get("name", ""),
            "owner": window_info.get("owner", ""),
            "id": window_info.get("id")
        }

    return metadata


def main():
    parser = argparse.ArgumentParser(description="Capture screenshot with thumbnail")
    parser.add_argument(
        "--mode", choices=["full", "active", "window"], default="full",
        help="Capture mode: full screen, active window, or named window"
    )
    parser.add_argument(
        "--name", type=str, default=None,
        help="Window name to capture (required for --mode window). "
             "Matches window title first, then app name. Case-insensitive substring match."
    )
    parser.add_argument(
        "--output", "-o", type=str, default=None,
        help="Output directory (default: system temp)"
    )
    parser.add_argument(
        "--thumb-width", type=int, default=480,
        help="Thumbnail width in pixels (default: 480)"
    )
    parser.add_argument(
        "--list-windows", action="store_true",
        help="List available windows and exit"
    )

    args = parser.parse_args()

    try:
        if args.list_windows:
            windows = list_windows()
            print(json.dumps(windows, indent=2))
            return

        metadata = capture_screenshot(
            mode=args.mode,
            output_dir=args.output,
            thumb_width=args.thumb_width,
            window_name=args.name
        )
        print(json.dumps(metadata, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
