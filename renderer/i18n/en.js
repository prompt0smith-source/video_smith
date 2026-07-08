(() => {
  window.PearlLangEn = {
    btnUpload: "Upload",
    btnSave: "Save Project (Ctrl+S)",
    btnLoad: "Load Project",
    btnRender: "Render (Ctrl+R)",
    btnSettings: "Settings",
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
    dropHint2: "(or use the Upload button in top Settings)",
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
          <li>The current FFmpeg binary configuration includes <span class="noticeCode">--enable-gpl</span> and <span class="noticeCode">--enable-nonfree</span>. Review redistributability and source-code delivery before shipping.</li>
          <li><b>FFprobe</b>: @ffprobe-installer/ffprobe 2.1.2 is preferred at runtime. The current mac arm64 package is LGPL-2.1, while other platform packages may be GPL-3.0.</li>
          <li>When distributing FFmpeg/FFprobe, provide the applicable license text, copyright notices, no-warranty notice, and source code or source-download location matching the shipped binary.</li>
          <li>References: ffmpeg.org, ffmpeg.org/legal.html, github.com/FFmpeg/FFmpeg</li>
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
