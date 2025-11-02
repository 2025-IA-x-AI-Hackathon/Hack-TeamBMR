# 🏠 부메랑 (Boomerang)
### AI 부동산 메이트랑: https://bmr.minjacho.com/

![부메랑 로고](https://img.shields.io/badge/부메랑-AI%20부동산%20메이트-blue?style=for-the-badge)

## 🎯 프로젝트 개요

청년들에게 부동산 계약은 여전히 낯설고 어렵습니다. 현장에서 중개인과 나눈 대화 속 약속이 실제 계약서에 반영되었는지, 계약서를 다 읽어보지 않으면 알기 어렵습니다.

**부메랑**은 현장 대화를 실시간으로 인식(STT) 하고, 이후 계약서 내용을 함께 분석하여 **대화 속 약속이 제대로 반영됐는지 검증하는 AI 메이트**입니다. AI는 이를 기반으로 종합 리포트를 생성하고, 누락·불일치·위험 항목을 표시해 사용자가 쉽게 확인하도록 돕습니다.

부메랑은 법률 자문이나 사후 분쟁 대응이 아닌, **계약 현장에서 바로 신뢰를 확인하게 하는 실시간 동반자**를 목표로 합니다.

## ✨ 주요 기능 (v1)

### 1. 📋 매물 체크리스트 기능
- **현장 점검 도구**: 매물을 보며 체크리스트를 생성하여 평가
- **세부 항목 체크**: 곰팡이, 수압, 채광, 소음, 누수, 시설물 상태 등 체계적 점검
- **평가 결과 저장**: 체크리스트 결과를 매물별로 저장하고 관리

### 2. 🎤 계약 대화 모니터링 기능
- **실시간 STT**: 계약 현장에서 녹음한 음성을 실시간으로 텍스트 변환
- **즉시 표시**: 대화 내용을 바로 화면에 보여주어 확인 가능
- **중요 약속 추출**: 계약 관련 핵심 약속과 조건을 자동 식별

### 3. 📄 주요 문서 업로드 및 분석 기능
- **OCR 텍스트화**: 계약서, 등기부등본, 중개대상물확인서 등 핵심 문서를 자동 스캔
- **구조화된 저장**: 추출된 텍스트를 체계적으로 저장하여 활용 가능
- **문서 통합 관리**: 매물별로 관련 문서들을 연결하여 통합 관리

### 4. 🤖 AI 종합 리포트 기능
- **통합 분석**: LLM으로 대화 분석 결과, 문서 분석 결과, 매물 체크리스트 내용을 종합
- **누락·불일치 탐지**: 대화와 문서 간 누락되거나 일치하지 않는 항목 자동 식별
- **위험 요소 알림**: 조심해야 할 내용과 주의사항을 정리한 리포트 자동 생성

## 🛠 기술 스택

### Frontend
- **React 18** with TypeScript
- **Vite** - 빠른 개발 환경
- **WebSocket** - 실시간 STT 통신
- **WebRTC** - 실시간 오디오 처리

### Backend
- **FastAPI** - 고성능 Python 웹 프레임워크
- **MongoDB** - 유연한 문서 저장소
- **WebSocket** - 실시간 통신
- **Motor** - 비동기 MongoDB 드라이버

### AI & ML Services
- **STT Engine** - 음성 인식
- **OCR Service** - 문서 텍스트 추출
- **LLM** - 자연어 처리 및 분석

### Infrastructure
- **Docker & Docker Compose** - 컨테이너화
- **MongoDB Atlas** - 데이터베이스
- **S3 File Storage** - 문서 및 오디오 파일 저장
- **EC2 & Cloudflare** - 백엔드 배포를 위한 EC2와 ip 매핑
- **Vercel** - 프론트 배포를 위한 자동화 서비스
- **Github Actions** - 백엔드 배포를 위한 자동화 스크립트

## 🚀 빠른 시작

### 사전 요구사항

**운영 환경 (일반 사용자)**
- Docker & Docker Compose

**개발 환경 (개발자)**
- Docker & Docker Compose
- Node.js 20+ (프론트엔드 로컬 개발용)
- Python 3.11+ (백엔드 로컬 개발용)

### 설치 및 실행

1. **프로젝트 클론**
```bash
git clone https://github.com/your-org/boomerang.git
cd boomerang
```

2. **환경 변수 설정**
```bash
# 백엔드 환경 변수
cp BE/.env.example BE/.env

# 프론트엔드 환경 변수
cp FE/.env.example FE/.env
```

3. **Docker Compose로 실행**
```bash
docker-compose up -d
```

4. **서비스 접속**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Documentation: http://localhost:8080/docs

### 개발 환경 설정

**백엔드 개발**
```bash
cd BE
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

**프론트엔드 개발**
```bash
cd FE
npm install
npm run dev
```

## 📱 사용 방법

### 1. 매물 등록 및 체크리스트 작성
1. 부메랑 앱을 실행하고 새 매물을 등록합니다
2. 매물 현장에서 체크리스트를 열어 항목별로 점검합니다
   - 곰팡이, 수압, 채광, 소음, 누수, 시설물 상태 등
3. 평가 결과를 저장하여 매물별로 관리합니다

### 2. 계약 대화 녹음 및 모니터링
1. 중개인과의 계약 상담 시 '녹음 시작' 버튼을 눌러주세요
2. 실시간으로 대화 내용이 텍스트로 변환되어 화면에 표시됩니다
3. 중요한 약속과 조건들이 자동으로 식별됩니다

### 3. 계약서 및 문서 업로드
1. 계약서, 등기부등본, 중개대상물확인서 등을 촬영하거나 스캔합니다
2. OCR 기능으로 자동으로 텍스트가 추출됩니다
3. 추출된 내용이 매물과 연결되어 저장됩니다

### 4. AI 종합 리포트 확인
1. 체크리스트, 대화, 문서 분석이 완료되면 종합 리포트가 생성됩니다
2. 누락·불일치 항목, 위험 요소를 확인하세요
3. AI가 제안하는 주의사항과 개선 방안을 검토하세요

## 📋 API 문서

### 주요 엔드포인트

#### 매물 관리
- `POST /v1/rooms` - 매물 등록
- `GET /v1/rooms` - 매물 목록 조회
- `GET /v1/rooms/{room_id}` - 매물 상세 조회
- `POST /v1/rooms/{room_id}/photos` - 매물 사진 업로드

#### STT (실시간 음성 인식)
- `WebSocket /v1/stt/session` - STT 세션 연결
- `GET /v1/stt/results` - STT 결과 조회

#### OCR (문서 분석)
- `POST /v1/ocr/upload` - 문서 업로드
- `GET /v1/ocr/results/{ocr_id}` - OCR 결과 조회

#### LLM (AI 분석)
- `POST /v1/llm/analyze` - 대화-계약서 분석 요청
- `GET /v1/llm/reports/{report_id}` - 분석 리포트 조회

#### 체크리스트
- `GET /v1/checklists/templates` - 체크리스트 템플릿 조회
- `POST /v1/checklists/save` - 체크리스트 저장

자세한 API 문서는 서버 실행 후 `/docs`에서 확인할 수 있습니다.

## 🏗 시스템 아키텍처

```
부메랑 시스템 구조

📱 프론트엔드 (React)
├── 실시간 STT 컴포넌트
├── 매물 관리 패널
├── 체크리스트 패널
├── OCR 처리 패널
└── AI 리포트 패널

⚙️ 백엔드 (FastAPI)
├── REST API (매물, OCR, LLM, 체크리스트)
├── WebSocket (실시간 STT)
├── 세션 관리 (음성 인식 세션)
└── 데이터 저장 (MongoDB)

🧠 AI 서비스
├── STT 엔진 (음성→텍스트)
├── OCR 서비스 (이미지→텍스트)
└── LLM (대화-계약서 분석)
```

## 👥 팀

### Team BMR

<table>
<tr>
<td align="center">
<a href="https://github.com/Rillmo">
<img src="https://github.com/Rillmo.png" width="80px;" alt="Rillmo"/>
<br />
<sub><b>Rillmo</b></sub>
</a>
<br />
PM
</td>
<td align="center">
<a href="https://github.com/sanglee2">
<img src="https://github.com/sanglee2.png" width="80px;" alt="sanglee2"/>
<br />
<sub><b>sanglee2</b></sub>
</a>
<br />
LLM 기능 개발
</td>
<td align="center">
<a href="https://github.com/lm9204">
<img src="https://github.com/lm9204.png" width="80px;" alt="lm9204"/>
<br />
<sub><b>lm9204</b></sub>
</a>
<br />
프론트엔드 및 STT 기능 개발
</td>
<td align="center">
<a href="https://github.com/minjacho42">
<img src="https://github.com/minjacho42.png" width="80px;" alt="minjacho42"/>
<br />
<sub><b>minjacho42</b></sub>
</a>
<br />
백엔드 개발 및 인프라 운영
</td>
<td align="center">
<a href="https://github.com/yjy323">
<img src="https://github.com/yjy323.png" width="80px;" alt="yjy323"/>
<br />
<sub><b>yjy323</b></sub>
</a>
<br />
OCR 기능 개발
</td>
</tr>
</table>

---
