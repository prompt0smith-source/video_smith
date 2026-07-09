# FFmpeg / FFprobe Notice

VideoSmith uses FFmpeg and/or FFprobe for video and audio processing. FFmpeg is a project of the FFmpeg developers and contributors. VideoSmith does not claim ownership of FFmpeg.

The license terms of FFmpeg/FFprobe depend on the exact binary, build configuration, and package used. Some FFmpeg builds are licensed under LGPL, while builds that enable GPL components or are distributed through certain static packages may be subject to GPL terms.

If VideoSmith distributes FFmpeg/FFprobe binaries, the corresponding license text, source code availability information, and build/package information must be provided with the distribution.

For portfolio/source-code distribution on GitHub:

- The VideoSmith source code is published under GPL-3.0-or-later.
- FFmpeg/FFprobe components remain under their respective licenses.
- Users and contributors should verify the actual FFmpeg/FFprobe binary license before redistributing packaged builds.

## Binary Distribution Notice

- If bundled FFmpeg binaries are distributed with a packaged build, include corresponding license text and source code offer.
- If FFmpeg is not bundled and users provide their own FFmpeg path, state that FFmpeg is installed separately by the user.
- If using ffmpeg-static, verify the exact license and source/package information for the binary included in the release.

## Source Code Offer

Corresponding source code for FFmpeg can be obtained from the FFmpeg project or the source package corresponding to the distributed binary.

If using ffmpeg-static, the exact source/package information must match the binary included in the release.

## Build Verification Checklist

- Confirm whether the binary includes GPL components.
- Confirm whether nonfree components are enabled.
- Confirm the license of the packaged binary.
- Include source code or source offer where required.
- Include FFmpeg license text in packaged release.

## Official References

- https://www.ffmpeg.org/legal.html
- https://github.com/FFmpeg/FFmpeg/blob/master/LICENSE.md
