import { detectPushPlatform } from "@/lib/push/detectPushPlatform";

export type DeniedGuideStep = {
  text: string;
};

export function notificationDeniedGuideSteps(lang: "ko" | "en"): DeniedGuideStep[] {
  const platform = detectPushPlatform();

  if (platform === "mac-chrome") {
    return lang === "ko"
      ? [
          { text: "Chrome 주소창 왼쪽 자물쇠(또는 튜닝) 아이콘을 눌러요." },
          { text: "알림 → 허용으로 바꿔요." },
          { text: "페이지를 새로고침한 뒤 설정에서 ‘이 기기 알림 다시 연결’을 눌러요." },
        ]
      : [
          { text: "Click the lock (or tune) icon left of Chrome's address bar." },
          { text: "Set Notifications to Allow." },
          { text: "Refresh the page, then tap Reconnect notifications in Settings." },
        ];
  }

  if (platform.startsWith("mac-")) {
    return lang === "ko"
      ? [
          { text: "브라우저 메뉴 → 설정 → 웹사이트 → 알림으로 이동해요." },
          { text: "잊지마 사이트를 찾아 알림을 허용해요." },
          { text: "페이지를 새로고침한 뒤 설정에서 ‘이 기기 알림 다시 연결’을 눌러요." },
        ]
      : [
          { text: "Open browser Settings → Websites → Notifications." },
          { text: "Find Itjima and allow notifications." },
          { text: "Refresh the page, then tap Reconnect notifications in Settings." },
        ];
  }

  if (platform.startsWith("ios") || platform.startsWith("ipad")) {
    return lang === "ko"
      ? [
          { text: "iPhone/iPad 설정 앱을 열어요." },
          { text: "알림 → 잊지마를 선택해요." },
          { text: "알림 허용을 켜요." },
        ]
      : [
          { text: "Open iPhone/iPad Settings." },
          { text: "Notifications → Itjima." },
          { text: "Turn on Allow Notifications." },
        ];
  }

  if (platform.startsWith("android")) {
    return lang === "ko"
      ? [
          { text: "Chrome ⋮ 메뉴 → 설정 → 사이트 설정 → 알림으로 이동해요." },
          { text: "잊지마를 찾아 알림을 허용해요." },
          { text: "페이지를 새로고침한 뒤 설정에서 ‘이 기기 알림 다시 연결’을 눌러요." },
        ]
      : [
          { text: "Chrome menu → Settings → Site settings → Notifications." },
          { text: "Find Itjima and allow notifications." },
          { text: "Refresh the page, then tap Reconnect notifications in Settings." },
        ];
  }

  if (platform.startsWith("windows")) {
    return lang === "ko"
      ? [
          { text: "주소창 왼쪽 사이트 정보 아이콘을 눌러요." },
          { text: "알림 권한을 허용으로 바꿔요." },
          { text: "페이지를 새로고침한 뒤 설정에서 ‘이 기기 알림 다시 연결’을 눌러요." },
        ]
      : [
          { text: "Click the site info icon left of the address bar." },
          { text: "Set notification permission to Allow." },
          { text: "Refresh the page, then tap Reconnect notifications in Settings." },
        ];
  }

  return lang === "ko"
    ? [
        { text: "브라우저 사이트 설정에서 알림을 허용해요." },
        { text: "페이지를 새로고침해요." },
        { text: "설정에서 ‘이 기기 알림 다시 연결’을 눌러요." },
      ]
    : [
        { text: "Allow notifications in your browser's site settings." },
        { text: "Refresh the page." },
        { text: "Tap Reconnect notifications in Settings." },
      ];
}
