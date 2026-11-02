chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OPEN_FLOW") return;
  chrome.tabs.create({ url: "https://flow.google.com/" })
    .then(tab => sendResponse({ ok: true, tabId: tab.id }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});