(() => {
  window.PearlLangEn = {
    btnUpload: "Upload",
    btnSave: "Save Project (Ctrl+S)",
    btnSaveAs: "Save As",
    btnLoad: "Load Project",
    btnRender: "Render (Ctrl+R)",
    btnSettings: "Settings",
    titleUploadProject: "Upload files",
    titleSaveProject: "Save project",
    titleSaveProjectAs: "Save project as",
    titleLoadProject: "Load project",
    titleRenderProject: "Render",
    titleUndo: "Undo",
    titleRedo: "Redo",
    titleSettings: "Settings",
    btnPickOutputFolder: "Choose Folder",
    btnOk: "OK",
    btnTermsAccept: "Agree and Start",
    btnTermsDecline: "Disagree (Exit)",
    preview: "Preview",
    panelLeftTitle: "1. Edit Tools",
    panelRightTitle: "2. Preview",
    panelBottomTitle: "3. Timeline",
    sectionTransitions: "Transitions",
    sectionBackgroundClip: "Background Color",
    sectionText: "Text Overlays",
    sectionRender: "Render Settings",
    sectionClips: "Clip List",
    hintTransitions: "Drag to clip boundaries on the timeline for auto snap.",
    hintBackgroundClip: "Drag to a video section on the timeline to add a 5-second background clip.",
    hintText: "Drag into the preview area to create a real text overlay clip.",
    labelFps: "FPS",
    labelRes: "Resolution",
    labelFmt: "Format",
    labelBackgroundColor: "Background Color",
    labelBackgroundClipColor: "Color",
    labelZoom: "Zoom",
    labelLanguage: "Language",
    labelOutputFolder: "Output Folder",
    labelRegion: "Region Mode",
    regionOn: "Region On",
    regionOff: "Region Off",
    emptyClips: "No files uploaded yet.",
    dropHint1: "Drag & drop video/audio files to the timeline below",
    dropHint2: "(or use the upload button in the top-left toolbar)",
    trackVideo: "Video",
    trackAudio: "Audio",
    kbdSplit: "Split",
    kbdMerge: "Merge",
    kbdDivide: "Divide",
    kbdDelete: "Delete",
    kbdSelectAll: "Select All",
    titleBack10: "Back 10s",
    titleStop: "Stop",
    titlePause: "Pause",
    titlePlay: "Play",
    titleFwd10: "Forward 10s",
    alertTitle: "Alert!",
    termsTitle: "Software Terms of Use",
    termsAgreeText: "[Required] I have read and agree to the \"Software Terms of Use\".",
    settingsTitle: "Settings",
    settingsLegalTitle: "Legal",
    legalNoticeTitle: "VideoSmith Notice",
    legalNoticeBody: `
      <p>VideoSmith is an open-source personal portfolio video editing tool.</p>
      <p>The program uses open-source and third-party components, and users are responsible for verifying rights to imported content.</p>
      <p>More details are available anytime under Settings &gt; Legal.</p>
    `,
    btnLegalNoticeView: "View Notice",
    btnLegalNoticeAccept: "I Understand",
    btnLegalNotice: "Legal Notice",
    btnOpenSourceLicenses: "Open Source Licenses",
    btnFfmpegNotice: "FFmpeg Notice",
    btnPrivacyPolicy: "Privacy Policy",
    btnUserContentNotice: "User Content Notice",
    legalNoticePanelTitle: "Legal Notice",
    legalNoticePanelBody: `
      <section class="noticeSection">
        <p>VideoSmith is an open-source personal portfolio video editing tool. VideoSmith source code is provided under GPL-3.0-or-later, while third-party components remain under their own license terms.</p>
        <p class="noticeCaution">This notice is not legal advice. Review the repository documents and verify final release requirements before distributing packaged builds.</p>
      </section>
      <section class="noticeSection"><h4>Documents</h4><ul>
        <li>LICENSE</li><li>THIRD_PARTY_NOTICES.md</li><li>OPEN_SOURCE_LICENSES.md</li><li>FFMPEG_NOTICE.md</li><li>TERMS_OF_USE.md</li><li>PRIVACY_POLICY.md</li><li>USER_CONTENT_NOTICE.md</li><li>NOTICE.md</li>
      </ul></section>
    `,
    openSourceLicensesTitle: "Open Source Licenses",
    openSourceLicensesBody: `
      <section class="noticeSection">
        <p>VideoSmith source code is licensed under GPL-3.0-or-later. Third-party components are governed by their respective licenses.</p>
        <div class="noticeTable" role="table" aria-label="Open source license summary">
          <div class="noticeRow noticeRowHead" role="row"><span>Area</span><span>License / notice</span><span>Repository file</span></div>
          <div class="noticeRow" role="row"><span>VideoSmith source</span><span>GPL-3.0-or-later</span><span>LICENSE</span></div>
          <div class="noticeRow" role="row"><span>MIT packages</span><span>Keep copyright and permission notices</span><span>OPEN_SOURCE_LICENSES.md</span></div>
          <div class="noticeRow" role="row"><span>LGPL/GPL binaries</span><span>Depends on build/package</span><span>FFMPEG_NOTICE.md</span></div>
        </div>
      </section>
    `,
    ffmpegNoticeTitle: "FFmpeg Notice",
    ffmpegNoticeBody: `
      <section class="noticeSection">
        <p>VideoSmith may use FFmpeg/FFprobe for video and audio processing. FFmpeg/FFprobe are projects of their own developers and contributors; VideoSmith does not claim ownership of them.</p>
        <p>The license of the actual FFmpeg/FFprobe binary depends on the binary, build configuration, and package used. Packaged releases must verify GPL components, nonfree flags, source-code availability, and license text requirements.</p>
        <p>See FFMPEG_NOTICE.md for the full repository notice.</p>
      </section>
    `,
    privacyPolicyTitle: "Privacy Policy",
    privacyPolicyBody: `
      <section class="noticeSection">
        <p>VideoSmith is designed as a local desktop application. By default, editing features do not upload project files or media files to an external server.</p>
        <p>Local project files, autosave/cache data, user settings, output paths, temporary render files, and debug files may be created on the user's machine.</p>
        <p>See PRIVACY_POLICY.md for details.</p>
      </section>
    `,
    userContentNoticeTitle: "User Content Notice",
    userContentNoticeBody: `
      <section class="noticeSection">
        <p>Users are responsible for verifying rights to imported video, image, audio, subtitle, font, template, and other content.</p>
        <p>VideoSmith does not claim ownership of rendered output created by users, but separate rights may apply to materials included in that output.</p>
        <p>See USER_CONTENT_NOTICE.md for details.</p>
      </section>
    `,
    btnThirdPartyNotices: "Open Source Notices",
    thirdPartyNoticesTitle: "Open Source and Third-party Notices",
    thirdPartyNoticesHint: "Review license information for FFmpeg and third-party components.",
    thirdPartyNoticesBody: `
      <div class="noticeIntro">
        <p>VideoSmith uses the open-source and third-party components listed below. Each component remains owned by its original rights holders, and its license terms apply first.</p>
        <p class="noticeCaution">This notice is not legal advice. Before public distribution, verify the exact packaged binaries, full license texts, source-code availability, and any patent or codec obligations.</p>
      </div>
      <section class="noticeSection">
        <h4>FFmpeg / FFprobe</h4>
        <ul>
          <li><b>FFmpeg</b>: bundled through ffmpeg-static 5.3.0. The current local binary reports FFmpeg 6.0, and the package license is GPL-3.0-or-later.</li>
          <li>The official FFmpeg legal page states that FFmpeg is generally LGPL 2.1-or-later, while enabling GPL components can make GPL terms apply to the FFmpeg build. The final packaged binary and configure flags must be checked before distribution.</li>
          <li>The current FFmpeg binary configuration includes <span class="noticeCode">--enable-gpl</span> and <span class="noticeCode">--enable-nonfree</span>. A binary built with nonfree options may have redistribution limits, so legal/license review is required before shipping.</li>
          <li><b>FFprobe</b>: @ffprobe-installer/ffprobe 2.1.2 is preferred at runtime. The current mac arm64 package is LGPL-2.1, while other platform packages may be GPL-3.0.</li>
          <li>When distributing FFmpeg/FFprobe, provide the applicable license text, copyright notices, no-warranty notice, and source code or source-download location matching the shipped binary.</li>
        </ul>
      </section>
      <section class="noticeSection">
        <h4>Official-source Notice</h4>
        <ul>
          <li><b>Electron</b>: Electron's official docs describe Electron as MIT-licensed and free for commercial and personal use. Notices for Chromium, Node.js, and related bundled components still need to be preserved.</li>
          <li><b>MIT packages</b>: The SPDX MIT text requires the copyright notice and permission notice to remain with copies or substantial portions. Do not remove notices just because the package is permissive.</li>
          <li><b>Display name</b>: The user-visible app name is VideoS in the window title, taskbar, Start menu, and shortcuts. Video Smith/VideoSmith in terms and project filters refers to the same product identity.</li>
          <li><b>User content and fonts</b>: Users are responsible for checking rights for imported video, images, audio, subtitles, and font files, including commercial-use and redistribution permissions. The app does not guarantee rights for external content.</li>
          <li>Official references: ffmpeg.org/legal.html, github.com/FFmpeg/FFmpeg LICENSE.md, electronjs.org/docs/latest/why-electron, spdx.org/licenses/MIT</li>
        </ul>
      </section>
      <section class="noticeSection">
        <h4>Key Runtime Components</h4>
        <div class="noticeTable" role="table" aria-label="Third-party runtime package licenses">
          <div class="noticeRow noticeRowHead" role="row"><span>Component</span><span>Version</span><span>License / note</span></div>
          <div class="noticeRow" role="row"><span>ffmpeg-static</span><span>5.3.0</span><span>GPL-3.0-or-later, includes FFmpeg 6.0 binary</span></div>
          <div class="noticeRow" role="row"><span>@ffprobe-installer/ffprobe</span><span>2.1.2</span><span>LGPL-2.1 wrapper, platform binary licenses vary</span></div>
          <div class="noticeRow" role="row"><span>ffprobe-static</span><span>3.1.0</span><span>MIT package, bundled binary should be checked per target platform</span></div>
          <div class="noticeRow" role="row"><span>fluent-ffmpeg</span><span>2.1.3</span><span>MIT</span></div>
          <div class="noticeRow" role="row"><span>pitchfinder</span><span>2.3.4</span><span>GNU v3</span></div>
          <div class="noticeRow" role="row"><span>nanoid</span><span>5.1.6</span><span>MIT</span></div>
          <div class="noticeRow" role="row"><span>Electron</span><span>29.4.6</span><span>MIT, includes Chromium/Node.js related notices</span></div>
        </div>
      </section>
      <section class="noticeSection">
        <h4>Pre-distribution Checklist</h4>
        <ol>
          <li>Confirm the license and configure flags of the FFmpeg/FFprobe binaries actually included in the packaged app.</li>
          <li>Include full license texts and copyright notices for GPL, LGPL, MIT, and other applicable licenses.</li>
          <li>If FFmpeg/FFprobe binaries are distributed, provide matching source code or a source-download location with the distribution.</li>
          <li>Keep the terms of use and UI copy from restricting rights granted by open-source licenses.</li>
        </ol>
      </section>
    `,
    outputFolderDefault: "Default: project folder",
    close: "Close",
    genericClip: "Clip",
    backgroundClipCardName: "Background Clip",
    backgroundClipCardDesc: "Drag to add a 5-second background clip.",
    backgroundClipDefaultName: "Background",
    backgroundClipApplied: "Background clip added",
    backgroundClipCreateFailed: "Failed to create background clip",
    backgroundColorWhite: "White",
    backgroundColorSoftWhite: "Soft White",
    backgroundColorLightGray: "Light Gray",
    backgroundColorCharcoal: "Charcoal",
    backgroundColorNavy: "Navy",
    backgroundColorSky: "Sky",
    videoInspectorSectionTitle: "Video Clip Settings",
    videoInspectorEmpty: "Click the top-right option button on a timeline video clip, or select a video clip, to adjust its display style and playback range here.",
    videoInspectorNone: "No clip selected",
    videoPreviewEdit: "Preview Edit",
    videoTransform: "Transform",
    videoCrop: "Crop",
    videoScale: "Scale",
    videoScaleX: "Scale X",
    videoScaleY: "Scale Y",
    videoPositionX: "Position X",
    videoPositionY: "Position Y",
    videoAnchorX: "Anchor X",
    videoAnchorY: "Anchor Y",
    videoRotation: "Rotation",
    videoOpacity: "Opacity",
    videoCropVisibleArea: "Crop / Visible Area",
    videoFitMode: "Fit Mode",
    fitContain: "Contain",
    fitFill: "Fill",
    fitStretch: "Stretch",
    videoCropLeft: "Crop Left",
    videoCropRight: "Crop Right",
    videoCropTop: "Crop Top",
    videoCropBottom: "Crop Bottom",
    videoPlaybackRange: "Playback Range",
    videoSourceIn: "Source In",
    videoSourceOut: "Source Out",
    videoPlacement: "Placement",
    videoPresetCenter: "Center",
    videoPresetTopLeft: "Top Left",
    videoPresetTopRight: "Top Right",
    videoPresetBottomLeft: "Bottom Left",
    videoPresetBottomRight: "Bottom Right",
    videoResetTransform: "Reset Transform",
    videoResetCrop: "Reset Crop",
    videoResetAll: "Full Reset",
    videoCropPreviewTitle: "Crop Preview",
    videoCropPreviewClose: "Close crop preview",
    videoCropPreviewHint: "Crop only the visible source area here, and keep adjusting size and position in the main preview.",
    videoCropDone: "Done",
    videoMetaTimelineDuration: "Timeline",
    videoMetaSourceWindow: "Source Window",
    videoPlaybackWindowTimeline: "Timeline Trim",
    videoPlaybackWindowSource: "Source Window",
    cropPreviewSourceLabel: "Source",
    videoClipOptionsAria: "visual settings",
    overlaySettingsAria: "settings",
    transitionTypeCut: "Cut",
    transitionTypeFade: "Fade In/Out",
    transitionTypeCross: "Cross Dissolve",
    transitionTypeSunGlitterFlash: "Warm Sun Glitter",
    transitionTypeFocusPullIn: "Focus Pull-In",
    transitionTypeCyberMosaicBurst: "Cyber Mosaic Burst",
    transitionTypeBlurSlideLeft: "Blur Slide Left",
    transitionTypeBlurSlideRight: "Blur Slide Right",
    transitionTypeBlurSlideUp: "Blur Slide Up",
    transitionTypeBlurSlideDown: "Blur Slide Down",
    transitionDescCut: "Switch immediately with no effect.",
    transitionDescFade: "Transition softly through the project background color.",
    transitionDescCross: "Blend both clips smoothly together.",
    transitionDescSunGlitterFlash: "Flash twice with warm sunlight glitter before handing off to the next scene.",
    transitionDescFocusPullIn: "Pull the current clip into a chosen focus point.",
    transitionDescCyberMosaicBurst: "Jump across irregular rectangular clusters and reveal the next scene in controlled digital patches.",
    transitionDescBlurSlideLeft: "Blur and slide only the current clip to the left.",
    transitionDescBlurSlideRight: "Blur and slide only the current clip to the right.",
    transitionDescBlurSlideUp: "Blur and slide only the current clip upward.",
    transitionDescBlurSlideDown: "Blur and slide only the current clip downward.",
    transitionPopoverBoundaryTitle: "Boundary Transition",
    transitionPopoverIntroTitle: "Clip Intro Transition",
    transitionPopoverOutroTitle: "Clip Outro Transition",
    transitionPopoverType: "Type",
    transitionPopoverDuration: "Duration",
    transitionPopoverStrength: "Strength",
    transitionPopoverIntensity: "Intensity",
    transitionPopoverTileDensity: "Tile Density",
    transitionPopoverSizeVariance: "Size Variance",
    transitionPopoverClusterCount: "Cluster Count",
    transitionPopoverClusterSpread: "Cluster Spread",
    transitionPopoverJitterSpeed: "Jitter Speed",
    transitionPopoverSeed: "Seed",
    transitionPopoverEdgeSoftness: "Edge Softness",
    transitionPopoverFocusX: "Focus X",
    transitionPopoverFocusY: "Focus Y",
    transitionPopoverEasing: "Easing",
    transitionEasingDynamic: "Dynamic",
    transitionEasingGentle: "Gentle",
    transitionPopoverRemoveBoundary: "Change to Cut",
    transitionPopoverRemoveEdge: "Remove Transition",
    transitionDropInvalid: "Transitions can be dropped only on clip boundaries or clip start/end edges.",
    transitionApplied: "Transition applied"
  };
})();
