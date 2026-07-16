/**
 * CC Inspector - 主入口文件
 * 加载所有模块并处理消息通信
 */
(function () {
  // 确保全局命名空间存在
  window.__CCInspector = window.__CCInspector || {};

  // 等待所有模块加载完成
  function waitForModules(callback, maxRetries = 50) {
    const required = ['utils', 'nodeTree', 'nodeProps', 'performance', 'textureReplace', 'nodeHighlight'];
    let retries = 0;

    const check = () => {
      const allLoaded = required.every(mod => window.__CCInspector[mod]);
      if (allLoaded) {
        callback();
      } else if (retries++ < maxRetries) {
        setTimeout(check, 50);
      } else {
        console.error('[CC Inspector] 模块加载超时');
      }
    };
    check();
  }

  waitForModules(() => {
    const { utils, nodeTree, nodeProps, performance, textureReplace, nodeHighlight } = window.__CCInspector;

    // 定时检测 Cocos 引擎并报告状态
    let lastDetected = false;
    setInterval(() => {
      const cc = utils.getCC();
      const isDetected = !!cc;
      if (isDetected !== lastDetected) {
        lastDetected = isDetected;
        if (isDetected) {
          window.postMessage({
            source: 'cc-inspector-inject',
            type: 'status',
            data: 'detected',
            version: utils.getVersion()
          }, '*');
        }
      }
    }, 1000);

    // ========== DevTools 面板消息处理 ==========
    window.addEventListener('message', e => {
      if (e.data && e.data.source === 'cc-inspector') {
        const cc = utils.getCC();
        if (!cc) {
          window.postMessage({ source: 'cc-inspector-inject', type: 'error', msg: 'no cc' }, '*');
          return;
        }

        const scene = utils.getScene();

        // 记录最后一次发送的树的 JSON，避免频繁发送相同数据
        let lastTreeJson = '';

        switch (e.data.type) {
          case 'getTree': {
            const tree = scene ? [nodeTree.buildTree(scene)] : [];
            window.postMessage({
              source: 'cc-inspector-inject',
              type: 'tree',
              tree: tree,
              version: utils.getVersion()
            }, '*');
            break;
          }

          case 'startAutoRefresh': {
            if (window.__CCInspector._refreshTimer) clearInterval(window.__CCInspector._refreshTimer);
            window.__CCInspector._refreshTimer = setInterval(() => {
              const currentScene = utils.getScene();
              if (currentScene) {
                const tree = [nodeTree.buildTree(currentScene)];
                const treeJson = JSON.stringify(tree);
                if (treeJson !== lastTreeJson) {
                  lastTreeJson = treeJson;
                  window.postMessage({
                    source: 'cc-inspector-inject',
                    type: 'tree',
                    tree: tree,
                    version: utils.getVersion()
                  }, '*');
                }
              }
            }, 1000); // 1秒检查一次变化
            break;
          }

          case 'getProps': {
            // 先检查是否是 FairyGUI 节点
            const fairygui = window.__CCInspector?.fairygui;
            let props = null;

            if (fairygui && e.data.uuid && e.data.uuid.startsWith('fgui_')) {
              const fguiNode = fairygui.findFairyGUINodeByUuid(scene, e.data.uuid);
              if (fguiNode && fguiNode.gObject) {
                props = fairygui.getFairyGUIProps(fguiNode.gObject);
              }
            } else {
              const node = utils.getNodeByUuid(scene, e.data.uuid);
              if (node) {
                props = nodeProps.getProps(node);
              }
            }

            if (props) {
              window.postMessage({ source: 'cc-inspector-inject', type: 'props', props: props }, '*');
            }

            // 选中节点时同时高亮显示
            if (nodeHighlight) {
              nodeHighlight.highlightNode(e.data.uuid);
            }
            break;
          }

          case 'setProp': {
            // 检查是否是 FairyGUI 节点
            const fairygui = window.__CCInspector?.fairygui;
            if (fairygui && e.data.uuid && e.data.uuid.startsWith('fgui_')) {
              const fguiNode = fairygui.findFairyGUINodeByUuid(scene, e.data.uuid);
              if (fguiNode && fguiNode.gObject) {
                fairygui.setGObjectProp(fguiNode.gObject, e.data.prop, e.data.value);
              }
            } else {
              const node = utils.getNodeByUuid(scene, e.data.uuid);
              if (node && nodeProps) {
                nodeProps.setProp(node, e.data.comp, e.data.prop, e.data.value);
              }
            }
            break;
          }

          case 'setVec': {
            const node = utils.getNodeByUuid(scene, e.data.uuid);
            if (node && nodeProps) {
              nodeProps.setVec(node, e.data.comp, e.data.prop, e.data.value);
            }
            break;
          }

          case 'setSize': {
            const node = utils.getNodeByUuid(scene, e.data.uuid);
            if (node && nodeProps) {
              nodeProps.setSize(node, e.data.comp, e.data.prop, e.data.value);
            }
            break;
          }

          case 'setColor': {
            const node = utils.getNodeByUuid(scene, e.data.uuid);
            if (node && nodeProps) {
              nodeProps.setColor(node, e.data.comp, e.data.prop, e.data.value);
            }
            break;
          }

          case 'highlightNode': {
            if (nodeHighlight) nodeHighlight.highlightNode(e.data.uuid);
            break;
          }

          case 'clearHighlight': {
            if (nodeHighlight) nodeHighlight.clearHighlight();
            break;
          }
        }
      }

      // ========== 浮窗功能消息处理 ==========
      if (e.data && e.data.source === 'cc-inspector-float') {
        const cc = utils.getCC();
        if (!cc) return;

        switch (e.data.type) {
          case 'getPerf': {
            const perfData = performance.getPerfData();
            window.postMessage({
              source: 'cc-inspector-float-inject',
              type: 'perf',
              data: perfData
            }, '*');
            break;
          }

          case 'getSpriteNodes': {
            const scene = utils.getScene();
            const nodes = nodeTree.findSpriteNodes(scene);
            window.postMessage({
              source: 'cc-inspector-float-inject',
              type: 'spriteNodes',
              nodes: nodes
            }, '*');
            break;
          }

          case 'replaceSpriteTexture': {
            textureReplace.replaceSpriteTexture(e.data.uuid, e.data.imageData)
              .then(result => {
                window.postMessage({
                  source: 'cc-inspector-float-inject',
                  type: 'replaceResult',
                  ...result
                }, '*');
              });
            break;
          }

          case 'resetSpriteTexture': {
            const result = textureReplace.resetSpriteTexture(e.data.uuid);
            window.postMessage({
              source: 'cc-inspector-float-inject',
              type: 'resetResult',
              ...result
            }, '*');
            break;
          }

          case 'highlightNode': {
            nodeHighlight.highlightNode(e.data.uuid);
            break;
          }
        }
      }
    });

    console.log('[CC Inspector] 注入脚本已加载，版本: 模块化');
  });
})();