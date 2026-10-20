// 로그인·기록 동기화용 Firebase 웹 설정.
// 이 값이 null이면 로그인 기능이 꺼지고, 기록은 이 브라우저에만 저장됩니다.
// 설정 방법은 site/README.md 의 "로그인과 기록 동기화" 항목을 참고하세요.
// (웹 앱 설정값은 공개되어도 안전합니다. 데이터 보호는 firestore.rules 가 맡습니다.)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD05_iELCScu3bLMSbeB-DF1mRTqf8DSpw",
  authDomain: "history-quiz-app-ver2.firebaseapp.com",
  projectId: "history-quiz-app-ver2",
  storageBucket: "history-quiz-app-ver2.firebasestorage.app",
  messagingSenderId: "1043035989963",
  appId: "1:1043035989963:web:e29602ddbdae626a5ef84e"
};
