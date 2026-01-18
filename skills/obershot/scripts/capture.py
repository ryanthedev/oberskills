#!/usr/bin/env python3
"""
obershot capture script - Cross-platform screenshot with context-efficient output.

Usage:
    python capture.py [--mode full|active] [--output DIR] [--thumb-width WIDTH]

Outputs:
    - Full resolution: {output}/obershot_full.png
    - Thumbnail: {output}/obershot_thumb.png (default 480px width)
    - Metadata JSON to stdout
"""

import argparse
import json
import os
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


def capture_screenshot(mode="full", output_dir=None, thumb_width=480):
    """Capture screenshot and create thumbnail."""

    if output_dir is None:
        output_dir = tempfile.gettempdir()

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    full_path = output_dir / "obershot_full.png"
    thumb_path = output_dir / "obershot_thumb.png"

    with mss.mss() as sct:
        if mode == "active":
            # Try to get active window bounds
            bounds = get_active_window_bounds()
            if bounds:
                monitor = bounds
            else:
                print("Warning: Falling back to full screen capture", file=sys.stderr)
                monitor = sct.monitors[0]  # Full virtual screen
        else:
            # Full screen (primary monitor)
            monitor = sct.monitors[1] if len(sct.monitors) > 1 else sct.monitors[0]

        # Capture
        screenshot = sct.grab(monitor)

        # Save full resolution
        mss.tools.to_png(screenshot.rgb, screenshot.size, output=str(full_path))

        # Get dimensions
        width, height = screenshot.size

    # Create thumbnail with Pillow
    with Image.open(full_path) as img:
        # Calculate thumbnail dimensions maintaining aspect ratio
        ratio = thumb_width / img.width
        thumb_height = int(img.height * ratio)

        # Resize with high-quality downsampling
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

    return metadata


def main():
    parser = argparse.ArgumentParser(description="Capture screenshot with thumbnail")
    parser.add_argument(
        "--mode", choices=["full", "active"], default="full",
        help="Capture mode: full screen or active window"
    )
    parser.add_argument(
        "--output", "-o", type=str, default=None,
        help="Output directory (default: system temp)"
    )
    parser.add_argument(
        "--thumb-width", type=int, default=480,
        help="Thumbnail width in pixels (default: 480)"
    )

    args = parser.parse_args()

    try:
        metadata = capture_screenshot(
            mode=args.mode,
            output_dir=args.output,
            thumb_width=args.thumb_width
        )
        # Output metadata as JSON for easy parsing
        print(json.dumps(metadata, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
