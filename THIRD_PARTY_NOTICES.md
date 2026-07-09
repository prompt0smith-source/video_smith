# Third-Party Notices

VideoSmith uses open-source and third-party software components. Each component is provided under its own license terms and remains the property of its respective copyright holders. VideoSmith does not claim ownership of third-party components.

This notice is an informational project notice for a GitHub portfolio/source distribution. It is not legal advice. Packaged binary releases should be checked against the exact binaries, package versions, and build configuration included in that release.

## Major Components

| Component | Purpose | License | Notes |
| --- | --- | --- | --- |
| Electron | Desktop application runtime | MIT | Includes Chromium and Node.js components |
| FFmpeg / FFprobe | Video and audio processing | LGPL/GPL depending on build | See FFMPEG_NOTICE.md |
| ffmpeg-static | Bundled FFmpeg binary package, if used | GPL-3.0-or-later, verify package | Review before binary distribution |
| @ffprobe-installer/ffprobe | FFprobe binary helper, if used | LGPL-2.1 / package-specific | Verify installed package and platform binary |
| ffprobe-static | FFprobe binary package, if used | MIT package, binary license must be verified | Review before binary distribution |
| fluent-ffmpeg | Node.js wrapper for FFmpeg | MIT | Wrapper only |
| pitchfinder | Audio pitch detection, if used | GPL/GNU v3, verify package | Review before binary distribution |
| nanoid | ID generation | MIT | Used for local IDs |

## Verification Notes

- The table lists packages that are currently declared in package.json and relevant runtime components.
- Licenses should be verified from package-lock.json, node_modules package metadata, package LICENSE files, and the exact binary packages distributed.
- If a license cannot be verified, mark it as `verify required` in generated notices rather than guessing.
- MIT packages generally require copyright and permission notices to remain with copies or substantial portions. See OPEN_SOURCE_LICENSES.md.
- FFmpeg/FFprobe licensing depends on binary source, build flags, and package. See FFMPEG_NOTICE.md.

## Generated Dependency Notice

Run `npm run notices` to generate THIRD_PARTY_NOTICES.generated.md from package-lock.json and local node_modules metadata. The generated file is support material and should be reviewed before release.
