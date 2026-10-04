
  // 预览/开发专用：file:// 直接打开本文件时提供 chrome.* 最小桩（?demo=pro|free|paywall）。
  // 真实扩展环境中不生效。
  if (typeof chrome === "undefined" || !chrome.storage) {
    const DEMO_SITES = [
      ["Deep Work essay — Longreads", "https://longreads.com/stories/deep-work"],
      ["Q4 roadmap — Notion", "https://notion.so/wd/q4-roadmap"],
      ["Inbox — Gmail", "https://mail.google.com/mail/u/0"],
      ["Pricing benchmarks — Linear", "https://linear.app/pricing"],
      ["GitHub notifications", "https://github.com/notifications"],
      ["Figma — Sidebar redesign", "https://figma.com/file/sidebar-redesign"],
      ["Hacker News front page", "https://news.ycombinator.com/"],
      ["Issues board — Shortcut", "https://app.shortcut.com/team/board"],
    ];
    const fakeTabs = (n) => Array.from({ length: n }, (_, i) => ({
      title: DEMO_SITES[i % 8][0],
      url: DEMO_SITES[i % 8][1] + "?p=" + i,
      favIconUrl: "https://www.google.com/s2/favicons?domain=" + new URL(DEMO_SITES[i % 8][1]).hostname + "&sz=64",
    }));
    window.__previewMode = true;
    window.chrome = {
      storage: { onChanged: { addListener: () => {} }, local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
      runtime: { sendMessage: () => Promise.resolve(), onMessage: { addListener: () => {} }, getURL: (p) => p },
      tabs: {
        query: async (q) => (q && q.currentWindow ? fakeTabs(6) : fakeTabs(3)),
        create: async () => ({}), remove: async () => {}, update: async () => ({}),
      },
      windows: { create: async () => ({ id: 1 }), get: async () => ({ id: 1 }), remove: async () => {} },
      alarms: { create: () => {}, clear: () => {} },
    };
    window.__demoFakeTabs = fakeTabs;
  }
  