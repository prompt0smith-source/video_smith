# VideoSmith

VideoSmith is an Electron + vanilla JavaScript + CSS video editing project. It is maintained as an open-source personal portfolio project for local desktop editing, rendering experiments, timeline workflows, effects, subtitles, chroma key, and FFmpeg-based media processing.

## Development

```bash
npm install
npm start
```

## Tests

```bash
npm test
```

## License

VideoSmith is released under GPL-3.0-or-later. See LICENSE.

## Third-Party Notices

VideoSmith uses third-party open-source components, including FFmpeg/FFprobe-related packages. See THIRD_PARTY_NOTICES.md and FFMPEG_NOTICE.md.

Generated dependency notices can be refreshed with:

```bash
npm run notices
```

## Portfolio Project Notice

VideoSmith is a personal portfolio project and is provided as-is. It may not be suitable for production-critical workflows.

## User Content

Users are responsible for ensuring they have rights to any media, fonts, subtitles, templates, or other content they import and render. VideoSmith does not claim ownership of user-created rendered output.

## Privacy

VideoSmith is designed to run locally by default. See PRIVACY_POLICY.md.

## Project Structure

- `main.js`: Electron main process, IPC, FFmpeg/FFprobe integration, render pipeline.
- `preload.js`: Safe IPC bridge.
- `renderer/`: Vanilla JavaScript/CSS UI.
- `lib/`: Shared render graph, timeline, transition, and motion helpers.
- `tests/`: Node-based regression tests.
