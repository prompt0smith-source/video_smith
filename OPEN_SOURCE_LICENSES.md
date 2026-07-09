# Open Source Licenses

This file summarizes the main license families relevant to VideoSmith. The complete applicable terms are the license texts of the relevant projects and packages.

## GPL-3.0-or-later

- VideoSmith source code is released under GPL-3.0-or-later.
- See LICENSE for the project license text.
- Some included packages or algorithms may also use GPL-family terms.

## MIT

- Several JavaScript packages and Electron-related packages use MIT-style terms.
- MIT generally requires that copyright and permission notices remain included in copies or substantial portions of the software.
- Verify each package's own LICENSE file before binary distribution.

## LGPL-2.1-or-later / LGPL-related

- Some FFmpeg/FFprobe-related binaries or wrappers may be licensed under LGPL depending on the exact build and package.
- The actual binary/package license must be verified.
- Do not assume FFmpeg is LGPL-only. Builds that enable GPL components or use GPL static packages may be subject to GPL terms.

## FFmpeg

- FFmpeg/FFprobe are separate open-source projects used for media processing.
- License terms depend on the exact binary, package, and build configuration.
- See FFMPEG_NOTICE.md.

## Generated Notices

THIRD_PARTY_NOTICES.generated.md can be generated with:

```bash
npm run notices
```

Generated notices are only a starting point and must be reviewed before distribution.
