// CC Inspector - Content Script
// 注入页面脚本来访问 Cocos Creator

/**
 * 注入单个脚本
 */
function injectScript(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(file);
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = reject;
    (document.head || document.documentElement).appendChild(script);
  });
}

/**
 * 按顺序注入所有模块脚本
 */
async function injectAllScripts() {
  // 注入顺序很重要：先加载工具类，再加载依赖工具类的模块，最后加载主入口
  const modules = [
    'content/inject/cc-utils.js',       // 工具类 (无依赖)
    'content/inject/fairygui.js',       // FairyGUI 扩展 (依赖 cc-utils)
    'content/inject/node-tree.js',      // 节点树 (依赖 cc-utils, fairygui)
    'content/inject/node-props.js',     // 节点属性 (依赖 cc-utils, fairygui)
    'content/inject/performance.js',    // 性能监控 (依赖 cc-utils)
    'content/inject/texture-replace.js', // 纹理替换 (依赖 cc-utils)
    'content/inject/node-highlight.js', // 节点高亮 (依赖 cc-utils)
    'content/inject/main.js',           // 主入口 (依赖所有模块)
    'content/float-panel.js'            // 浮窗面板 (独立)
  ];

  for (const module of modules) {
    try {
      await injectScript(module);
    } catch (err) {
      console.error(`[CC Inspector] 加载模块失败: ${module}`, err);
    }
  }
}

// 开始注入
injectAllScripts().then(() => {
  // 脚本注入完成后，通知注入脚本开始自动刷新
  window.postMessage({ source: 'cc-inspector', type: 'startAutoRefresh' }, '*');
});

// ========== 消息通信 ==========
let pendingCallback = null;

// 监听来自注入脚本的消息
window.addEventListener('message', e => {
  if (e.data && e.data.source === 'cc-inspector-inject') {
    if (e.data.type === 'status' || e.data.type === 'tree' || e.data.type === 'props') {
      chrome.runtime.sendMessage({ ...e.data, source: 'cc-inspector-content' }).catch(err => {
        // 忽略背景页未就绪的错误
      });
    }
    if (pendingCallback) {
      pendingCallback(e.data);
      pendingCallback = null;
    }
  }
});

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getTree') {
    pendingCallback = data => {
      if (data && data.type === 'tree') {
        sendResponse({ tree: data.tree, version: data.version });
      } else {
        sendResponse({ tree: null });
      }
    };
    window.postMessage({ source: 'cc-inspector', type: 'getTree' }, '*');
    setTimeout(() => {
      if (pendingCallback) {
        sendResponse({ tree: null });
        pendingCallback = null;
      }
    }, 200);
    return true;
  } else if (msg.type === 'getProps') {
    pendingCallback = data => {
      if (data && data.type === 'props') {
        sendResponse({ props: data.props });
      } else {
        sendResponse({ props: null });
      }
    };
    window.postMessage({ source: 'cc-inspector', type: 'getProps', uuid: msg.uuid }, '*');
    setTimeout(() => {
      if (pendingCallback) {
        sendResponse({ props: null });
        pendingCallback = null;
      }
    }, 200);
    return true;
  } else if (msg.type === 'setProp' || msg.type === 'setVec' || msg.type === 'setSize' || msg.type === 'setColor' || msg.type === 'highlightNode' || msg.type === 'clearHighlight') {
    window.postMessage({ source: 'cc-inspector', ...msg }, '*');
  }
});