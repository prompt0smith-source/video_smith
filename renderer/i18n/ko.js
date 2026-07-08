(() => {
  window.PearlLangKo = {
    btnUpload: "파일 업로드",
    btnSave: "프로젝트 저장 (Ctrl+S)",
    btnLoad: "프로젝트 불러오기",
    btnRender: "렌더 (Ctrl+R)",
    btnSettings: "설정",
    btnPickOutputFolder: "폴더 지정",
    btnOk: "확인",
    btnTermsAccept: "동의하고 시작하기",
    btnTermsDecline: "동의하지 않음(종료)",
    preview: "미리보기",
    panelLeftTitle: "1. 편집 도구",
    panelRightTitle: "2. 미리보기",
    panelBottomTitle: "3. 타임라인",
    sectionTransitions: "전환 효과 (Transitions)",
    sectionBackgroundClip: "배경 색상",
    sectionText: "자막 및 텍스트 효과 (Text Overlays)",
    sectionRender: "렌더 설정",
    sectionClips: "클립 목록",
    hintTransitions: "타임라인에서 클립 경계로 드래그하면 근처에서 자동 스냅됩니다.",
    hintBackgroundClip: "타임라인 비디오 섹션으로 드래그하면 5초 배경 클립이 생성됩니다.",
    hintText: "영상 영역으로 드래그하면 실제 텍스트 overlay clip이 생성됩니다.",
    labelFps: "프레임",
    labelRes: "해상도",
    labelFmt: "형식",
    labelBackgroundColor: "배경 색상",
    labelBackgroundClipColor: "색상",
    labelZoom: "Zoom",
    labelLanguage: "언어",
    labelOutputFolder: "저장 폴더",
    labelRegion: "영역 지정 모드",
    regionOn: "영역 지정 On",
    regionOff: "영역 지정 Off",
    emptyClips: "아직 업로드된 파일이 없습니다.",
    dropHint1: "하단 타임라인에 동영상/오디오 파일을 드래그 & 드롭",
    dropHint2: "(또는 상단 세팅 내부 파일 업로드 버튼)",
    trackVideo: "영상",
    trackAudio: "음성",
    kbdSplit: "Split",
    kbdMerge: "Merge",
    kbdDivide: "Divide",
    kbdDelete: "Delete",
    kbdSelectAll: "전체영역",
    titleBack10: "뒤로 10초",
    titleStop: "정지",
    titlePause: "일시정지",
    titlePlay: "재생",
    titleFwd10: "앞으로 10초",
    alertTitle: "Alert!",
    termsTitle: "소프트웨어 이용 약관",
    termsAgreeText: "[필수] 위 \"소프트웨어 이용 약관\"을 읽었으며, 내용에 동의합니다.",
    settingsTitle: "설정",
    settingsLegalTitle: "법적 고지",
    btnThirdPartyNotices: "오픈소스 고지",
    thirdPartyNoticesTitle: "오픈소스 및 제3자 고지",
    thirdPartyNoticesHint: "FFmpeg 및 제3자 구성요소의 라이선스 정보를 확인합니다.",
    thirdPartyNoticesBody: `
      <div class="noticeIntro">
        <p>VideoSmith는 아래 오픈소스 및 제3자 구성요소를 사용합니다. 각 구성요소는 원 저작권자에게 귀속되며, 해당 라이선스 조건이 우선 적용됩니다.</p>
        <p class="noticeCaution">이 고지는 법률 자문이 아닙니다. 공개 배포 전에는 실제 패키징된 바이너리, 라이선스 전문, 소스 제공 방식, 특허/코덱 관련 조건을 최종 확인해야 합니다.</p>
      </div>
      <section class="noticeSection">
        <h4>FFmpeg / FFprobe</h4>
        <ul>
          <li><b>FFmpeg</b>: ffmpeg-static 5.3.0을 통해 번들됩니다. 현재 로컬 바이너리는 FFmpeg 6.0이며 패키지 라이선스는 GPL-3.0-or-later입니다.</li>
          <li>현재 FFmpeg 바이너리 구성에는 <span class="noticeCode">--enable-gpl</span> 및 <span class="noticeCode">--enable-nonfree</span> 플래그가 확인됩니다. 배포 전 재배포 가능 여부와 소스 제공 방식을 별도 검토해야 합니다.</li>
          <li><b>FFprobe</b>: @ffprobe-installer/ffprobe 2.1.2를 우선 사용합니다. 현재 mac arm64 패키지는 LGPL-2.1이며, 다른 플랫폼 패키지는 GPL-3.0일 수 있습니다.</li>
          <li>FFmpeg/FFprobe를 배포하는 경우 적용 라이선스에 따라 라이선스 전문, 저작권 표시, 비보증 고지, 실제 바이너리와 일치하는 소스 코드 또는 소스 다운로드 위치를 제공해야 합니다.</li>
          <li>참고: ffmpeg.org, ffmpeg.org/legal.html, github.com/FFmpeg/FFmpeg</li>
        </ul>
      </section>
      <section class="noticeSection">
        <h4>주요 런타임 구성요소</h4>
        <div class="noticeTable" role="table" aria-label="Third-party runtime package licenses">
          <div class="noticeRow noticeRowHead" role="row"><span>구성요소</span><span>버전</span><span>라이선스/비고</span></div>
          <div class="noticeRow" role="row"><span>ffmpeg-static</span><span>5.3.0</span><span>GPL-3.0-or-later, FFmpeg 6.0 바이너리 포함</span></div>
          <div class="noticeRow" role="row"><span>@ffprobe-installer/ffprobe</span><span>2.1.2</span><span>LGPL-2.1 래퍼, 플랫폼 바이너리 라이선스 상이</span></div>
          <div class="noticeRow" role="row"><span>ffprobe-static</span><span>3.1.0</span><span>MIT 패키지, 번들 바이너리는 대상 플랫폼별 확인 필요</span></div>
          <div class="noticeRow" role="row"><span>fluent-ffmpeg</span><span>2.1.3</span><span>MIT</span></div>
          <div class="noticeRow" role="row"><span>pitchfinder</span><span>2.3.4</span><span>GNU v3</span></div>
          <div class="noticeRow" role="row"><span>nanoid</span><span>5.1.6</span><span>MIT</span></div>
          <div class="noticeRow" role="row"><span>Electron</span><span>29.4.6</span><span>MIT, Chromium/Node.js 관련 고지 포함</span></div>
        </div>
      </section>
      <section class="noticeSection">
        <h4>배포 전 확인 항목</h4>
        <ol>
          <li>패키징 결과물에 실제 포함되는 FFmpeg/FFprobe 바이너리의 라이선스와 구성 플래그를 확인합니다.</li>
          <li>GPL/LGPL/MIT 등 각 라이선스 전문과 저작권 표시를 앱 또는 배포물에 포함합니다.</li>
          <li>FFmpeg/FFprobe 바이너리를 배포한다면 해당 바이너리와 일치하는 소스 코드 또는 소스 다운로드 위치를 함께 제공합니다.</li>
          <li>약관이나 UI 문구가 오픈소스 라이선스가 허용하는 권리를 제한하지 않도록 유지합니다.</li>
        </ol>
      </section>
    `,
    outputFolderDefault: "기본값: 프로젝트 폴더",
    close: "닫기",
    genericClip: "클립",
    backgroundClipCardName: "배경 클립",
    backgroundClipCardDesc: "드래그하면 5초 배경 클립이 추가됩니다.",
    backgroundClipDefaultName: "배경",
    backgroundClipApplied: "배경 클립이 추가되었습니다.",
    backgroundClipCreateFailed: "배경 클립 생성 실패",
    backgroundColorWhite: "화이트",
    backgroundColorSoftWhite: "소프트 화이트",
    backgroundColorLightGray: "라이트 그레이",
    backgroundColorCharcoal: "차콜",
    backgroundColorNavy: "네이비",
    backgroundColorSky: "스카이",
    videoInspectorSectionTitle: "영상 클립 속성",
    videoInspectorEmpty: "타임라인에서 영상 클립의 우측 상단 옵션 버튼을 누르거나, 영상 클립을 선택하면 여기서 표시 방식과 재생 구간을 조절할 수 있습니다.",
    videoInspectorNone: "선택된 클립 없음",
    videoPreviewEdit: "미리보기 편집",
    videoTransform: "변형",
    videoCrop: "자르기",
    videoScale: "크기",
    videoScaleX: "가로 크기",
    videoScaleY: "세로 크기",
    videoPositionX: "위치 X",
    videoPositionY: "위치 Y",
    videoAnchorX: "기준점 X",
    videoAnchorY: "기준점 Y",
    videoRotation: "회전",
    videoOpacity: "불투명도",
    videoCropVisibleArea: "자르기 / 표시 영역",
    videoFitMode: "맞춤 방식",
    fitContain: "맞춤",
    fitFill: "채우기",
    fitStretch: "늘이기",
    videoCropLeft: "왼쪽 자르기",
    videoCropRight: "오른쪽 자르기",
    videoCropTop: "위 자르기",
    videoCropBottom: "아래 자르기",
    videoPlaybackRange: "재생 구간",
    videoSourceIn: "소스 시작",
    videoSourceOut: "소스 끝",
    videoPlacement: "배치",
    videoPresetCenter: "가운데",
    videoPresetTopLeft: "왼쪽 위",
    videoPresetTopRight: "오른쪽 위",
    videoPresetBottomLeft: "왼쪽 아래",
    videoPresetBottomRight: "오른쪽 아래",
    videoResetTransform: "변형 초기화",
    videoResetCrop: "자르기 초기화",
    videoResetAll: "전체 초기화",
    videoCropPreviewTitle: "자르기 미리보기",
    videoCropPreviewClose: "자르기 미리보기 닫기",
    videoCropPreviewHint: "여기서는 원본 화면에서 보일 영역만 자르고, 크기와 위치는 기존 메인 미리보기에서 계속 조절합니다.",
    videoCropDone: "완료",
    videoMetaTimelineDuration: "타임라인 길이",
    videoMetaSourceWindow: "소스 구간",
    videoPlaybackWindowTimeline: "타임라인 트림",
    videoPlaybackWindowSource: "소스 구간",
    cropPreviewSourceLabel: "소스",
    videoClipOptionsAria: "표시 설정",
    overlaySettingsAria: "설정",
    transitionTypeCut: "컷",
    transitionTypeFade: "페이드 인/아웃",
    transitionTypeCross: "크로스 디졸브",
    transitionTypeSunGlitterFlash: "웜 선 글리터",
    transitionTypeFocusPullIn: "포커스 빨려들기",
    transitionTypeCyberMosaicBurst: "사이버 모자이크 버스트",
    transitionTypeBlurSlideLeft: "블러 슬라이드 왼쪽",
    transitionTypeBlurSlideRight: "블러 슬라이드 오른쪽",
    transitionTypeBlurSlideUp: "블러 슬라이드 위쪽",
    transitionTypeBlurSlideDown: "블러 슬라이드 아래쪽",
    transitionDescCut: "효과 없이 바로 전환",
    transitionDescFade: "프로젝트 배경색을 거치며 부드럽게 전환",
    transitionDescCross: "두 클립이 자연스럽게 겹치며 전환",
    transitionDescSunGlitterFlash: "따뜻한 태양빛 글리터가 두 번 번쩍이고 다음 장면으로 넘어갑니다.",
    transitionDescFocusPullIn: "지정한 중심점으로 빨려들며 정리됩니다.",
    transitionDescCyberMosaicBurst: "불규칙한 직사각형 클러스터가 점프하듯 번지며 다음 장면을 드러냅니다.",
    transitionDescBlurSlideLeft: "현재 클립만 왼쪽으로 블러 아웃됩니다.",
    transitionDescBlurSlideRight: "현재 클립만 오른쪽으로 블러 아웃됩니다.",
    transitionDescBlurSlideUp: "현재 클립만 위로 블러 아웃됩니다.",
    transitionDescBlurSlideDown: "현재 클립만 아래로 블러 아웃됩니다.",
    transitionPopoverBoundaryTitle: "경계 전환",
    transitionPopoverIntroTitle: "클립 시작 전환",
    transitionPopoverOutroTitle: "클립 끝 전환",
    transitionPopoverType: "타입",
    transitionPopoverDuration: "길이",
    transitionPopoverStrength: "강도",
    transitionPopoverIntensity: "강도",
    transitionPopoverTileDensity: "타일 밀도",
    transitionPopoverSizeVariance: "크기 편차",
    transitionPopoverClusterCount: "클러스터 수",
    transitionPopoverClusterSpread: "클러스터 퍼짐",
    transitionPopoverJitterSpeed: "점프 속도",
    transitionPopoverSeed: "시드",
    transitionPopoverEdgeSoftness: "경계 부드러움",
    transitionPopoverFocusX: "포커스 X",
    transitionPopoverFocusY: "포커스 Y",
    transitionPopoverEasing: "이징",
    transitionEasingDynamic: "다이내믹",
    transitionEasingGentle: "부드럽게",
    transitionPopoverRemoveBoundary: "컷으로 변경",
    transitionPopoverRemoveEdge: "전환 제거",
    transitionDropInvalid: "전환효과는 클립 경계 또는 시작/끝 edge에 넣을 수 있어요.",
    transitionApplied: "전환효과 적용 완료"
  };
})();
