# expo-clipboard 사용 방법

## 방법 1: expo prebuild 실행 (권장)

가장 확실한 방법은 Expo가 자동으로 설정을 생성하도록 하는 것입니다:

```bash
cd running/Frontend
npx expo prebuild --clean
```

이 명령어는 Android/iOS 네이티브 설정을 재생성하며, `expo-module-gradle-plugin` 설정도 자동으로 포함됩니다.

## 방법 2: settings.gradle 수정

`expo prebuild`를 실행하지 않고 수동으로 설정하려면:

### 1. expo-clipboard 설치
```bash
cd running/Frontend
npx expo install expo-clipboard
```

### 2. settings.gradle 수정

`running/Frontend/android/settings.gradle`의 `pluginManagement` 블록에 다음을 추가:

```gradle
pluginManagement {
  def version = providers.exec {
    commandLine("node", "-e", "console.log(require('react-native/package.json').version);")
  }.standardOutput.asText.get().trim()
  def (_, reactNativeMinor, reactNativePatch) = version.split("-")[0].tokenize('.').collect { it.toInteger() }

  includeBuild(new File(["node", "--print", "require.resolve('@react-native/gradle-plugin/package.json')"].execute(null, rootDir).text.trim()).getParentFile().toString())
  if(reactNativeMinor == 74 && reactNativePatch <= 3){
    includeBuild("react-settings-plugin")
  }
  
  // Expo module gradle plugin for expo-clipboard and other Expo modules
  def expoModulesCorePath = new File(["node", "--print", "require.resolve('expo-modules-core/package.json')"].execute(null, rootDir).text.trim()).getParentFile()
  def gradlePluginPath = new File(expoModulesCorePath, "android/gradle-plugin")
  if (gradlePluginPath.exists()) {
    includeBuild(gradlePluginPath)
  }
}
```

### 3. 코드에서 사용

```javascript
import * as Clipboard from 'expo-clipboard';

// 비동기 방식
const copyToClipboard = async () => {
  await Clipboard.setStringAsync('복사할 텍스트');
};

// 읽기
const getClipboardText = async () => {
  const text = await Clipboard.getStringAsync();
  return text;
};
```

## 방법 3: expo install --fix 실행

의존성 문제를 자동으로 해결:

```bash
cd running/Frontend
npx expo install --fix
npx expo install expo-clipboard
```

## 주의사항

- `expo prebuild --clean`을 실행하면 기존 네이티브 설정이 재생성됩니다. 커스텀 설정이 있다면 백업하세요.
- `expo-module-gradle-plugin`은 Expo SDK 51에서 `expo-modules-core` 패키지에 포함되어 있습니다.
- 빌드 오류가 계속 발생하면 `android` 폴더를 삭제하고 `expo prebuild`를 다시 실행하세요.
