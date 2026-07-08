# PearlCut (prototype)
요구하신 UI/단축키/타임라인(0.1s 단위 플레이헤드)/Split(S)/Merge(M)/드래그&드롭/포맷 통합(내부 MP4) + 4K/60fps 제한 경고 및 자동 변환을 포함한 **동영상 편집기 프로토타입**입니다.

> ⚠️ 이 버전(v0.1)은 '실제로 돌아가는 골격 + 핵심 동작'을 우선 구현했습니다.  
> - 기본 컷 편집/분할/병합/선택구간 렌더, 프로젝트 저장/불러오기, 드래그 스냅 UI는 구현됨  
> - 전환효과(특히 cross dissolve)는 UI/데이터 구조까지 연결해두었고, 렌더 필터그래프 적용은 TODO로 남겨둠(코드 주석 참고)

## 실행
1) Node.js LTS 설치  
2) 프로젝트 폴더에서:
```bash
npm install
npm start
```

## 지원/제약
- 최대 지원: 60fps, 4K(3840x2160)
- 업로드/렌더 포맷: MP4, MOV, AVI, MKV, WMV, WebM
- 업로드 시 다양한 포맷이 들어와도 내부에서는 MP4(H.264/AAC)로 자동 변환해 동일하게 편집 가능

### 경고 문구
- 4K 초과: `현재 지원되는 최대 해상도 이상의 파일 형식은 4K로 자동 변환됩니다.`
- 60fps 초과: `현재 지원되는 최대 프레임 이상의 파일 형식은 60fps로 자동 변환됩니다.`

## 단축키
- S: 플레이헤드 위치 기준 Split
- M: 플레이헤드 경계 기준 Merge
- Ctrl+Z / Ctrl+Y: Undo / Redo
- Ctrl+S: 프리셋(프로젝트) 저장
- Ctrl+R: 렌더링
- Space: 재생/일시정지

## 파일 구조
- main.js: Electron 메인 + FFprobe/FFmpeg 처리 (import/transcode/render)
- preload.js: 안전한 IPC 브릿지
- renderer/: UI (HTML/CSS/JS)
  - app.js: 상태/이벤트/단축키
  - timeline.js: 타임라인 렌더/스냅/선택구간
  - commands.js: undo/redo 커맨드 스택
  - pitch.js: 오디오 피치 그래프(canvas)

## Overlap Manual Test
- 1) 서로 다른 두 영상 겹침 1초: 앞 영상/음성 fade out, 뒤 영상/음성 fade in, 종료 후 뒤 영상 계속 재생
- 2) 같은 source를 split한 두 clip overlap: 앞부분 재반복 없음, overlap 종료 후 점프 없음
- 3) 겹침 3초 / 5초 / 8초: 겹침 길이에 비례하여 crossfade 길이 증가, 루프 없음
- 4) non-overlap cut: 기존 cut 재생 유지
- 5) 겹침 직전 재생 시작: 검은 화면 고정이나 멈춤 없음
- 6) 겹침 내부 직접 클릭 후 재생: overlap 내부와 이후 구간이 연속 재생
- 7) 빠른 반복 seek: 이전 구간 복귀 금지, A/V 분리 최소화
