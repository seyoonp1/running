# Running Project

## 가상 환경 설정

### 1. 가상 환경 생성 (이미 완료됨)
```bash
python3 -m venv venv
```

### 2. 가상 환경 활성화

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 3. 패키지 설치
```bash
pip install -r requirements.txt
```

### 4. 가상 환경 비활성화
```bash
deactivate
```

## 프로젝트 구조
```
running/
├── venv/              # 가상 환경 (git에 포함되지 않음)
├── requirements.txt   # 프로젝트 의존성
└── README.md         # 프로젝트 설명
```
