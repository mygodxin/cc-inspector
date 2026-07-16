/**
 * CC Inspector - 节点高亮模块
 * 在游戏画面中高亮显示选中的节点
 */
(function () {
  const utils = window.__CCInspector?.utils;
  if (!utils) {
    console.error('[CC Inspector] cc-utils.js 未加载');
    return;
  }

  // 高亮覆盖层状态
  let highlightOverlay = null;
  let highlightAnimation = null;

  const NodeHighlight = {
    /**
     * 高亮显示节点
     * @param {string} uuid - 节点 UUID
     */
    highlightNode(uuid) {
      const cc = utils.getCC();
      if (!cc) return;

      // 检查是否是 FairyGUI 节点
      const fairygui = window.__CCInspector?.fairygui;
      if (fairygui && uuid.startsWith('fgui_')) {
        this.highlightFairyGUINode(uuid, fairygui);
        return;
      }

      const scene = utils.getScene();
      const node = utils.getNodeByUuid(scene, uuid);
      if (!node) return;

      try {
        // 获取节点的世界坐标边界框
        const worldBounds = this.getNodeWorldBounds(node, cc);
        if (!worldBounds) return;

        // 将世界坐标转换为屏幕坐标
        const screenRect = this.worldToScreen(worldBounds, cc);
        if (!screenRect) return;

        // 创建或更新高亮覆盖层
        this.showHighlightOverlay(screenRect);
      } catch (err) {
        console.warn('[CC Inspector] 高亮节点失败', err);
      }
    },

    /**
     * 高亮显示 FairyGUI 节点
     */
    highlightFairyGUINode(uuid, fairygui) {
      try {
        const fguiModule = fairygui.getFGUIModule();
        if (!fguiModule || !fguiModule.GRoot) return;

        const gRoot = fguiModule.GRoot.inst;
        if (!gRoot) return;

        // 查找 GObject
        const fguiNode = fairygui.findFairyGUINodeByUuid(null, uuid);
        if (!fguiNode || !fguiNode.gObject) return;

        const gObject = fguiNode.gObject;

        // 获取 GObject 的世界坐标边界框（已经是屏幕坐标）
        const screenRect = this.getGObjectWorldBounds(gObject);
        if (!screenRect) return;

        // 显示高亮
        this.showHighlightOverlay(screenRect);
      } catch (err) {
        console.warn('[CC Inspector] 高亮 FairyGUI 节点失败', err);
      }
    },

    /**
     * 获取 GObject 的世界坐标边界框
     * 使用 FairyGUI 的 localToGlobal 方法
     */
    getGObjectWorldBounds(gObject) {
      try {
        const width = gObject.width || 0;
        const height = gObject.height || 0;

        // 使用 FairyGUI 的 localToGlobal 方法获取世界坐标
        if (gObject.localToGlobal) {
          // 获取左上角和右下角的世界坐标
          const topLeft = gObject.localToGlobal(0, 0);
          const bottomRight = gObject.localToGlobal(width, height);
          if (!topLeft || !bottomRight) return null;

          // 获取 Canvas 的位置
          const canvas = document.querySelector('canvas');
          if (!canvas) return null;

          const canvasRect = canvas.getBoundingClientRect();

          // localToGlobal 返回的是相对于 Canvas 内容区域的坐标
          // 需要加上 Canvas 在浏览器窗口中的偏移
          const result = {
            x: canvasRect.left + topLeft.x,
            y: canvasRect.top + topLeft.y,
            width: Math.abs(bottomRight.x - topLeft.x),
            height: Math.abs(bottomRight.y - topLeft.y)
          };

          return result;
        }

        return null;
      } catch (err) {
        console.warn('[CC Inspector] 获取 GObject 边界失败', err);
        return null;
      }
    },

    /**
     * 将 FairyGUI 坐标转换为屏幕坐标
     * FairyGUI 的 localToGlobal 返回的是相对于浏览器窗口的坐标
     */
    fguiToScreen(fguiBounds) {
      try {
        // localToGlobal 已经返回相对于浏览器窗口的坐标，直接使用
        return {
          left: fguiBounds.x,
          top: fguiBounds.y,
          width: fguiBounds.width,
          height: fguiBounds.height
        };
      } catch (err) {
        console.warn('[CC Inspector] FairyGUI 坐标转换失败', err);
        return null;
      }
    },

    /**
     * 获取 GObject 的世界坐标
     */
    getGObjectWorldPosition(gObject) {
      let x = gObject.x || 0;
      let y = gObject.y || 0;

      // 累加所有父节点的坐标
      let parent = gObject.parent;
      while (parent) {
        x += parent.x || 0;
        y += parent.y || 0;
        parent = parent.parent;
      }

      return { x, y };
    },

    /**
     * 获取节点的世界坐标边界框
     */
    getNodeWorldBounds(node, cc) {
      try {
        // Scene 节点不支持 getWorldPosition，直接返回 null
        if (node.isScene || (node.uuid && !node.parent && !node._parent)) {
          return null;
        }

        let width, height, anchorX, anchorY;
        let worldPos = { x: 0, y: 0 };

        // 获取尺寸 - 优先从 UITransform (3.x) 获取
        const is3x = utils.is3x();
        const uiTransform = is3x ? utils.findComponent(node, 'UITransform') : null;

        if (uiTransform) {
          // 3.x
          width = uiTransform.contentSize.width;
          height = uiTransform.contentSize.height;
          anchorX = uiTransform.anchorPoint.x;
          anchorY = uiTransform.anchorPoint.y;
        } else if (!is3x && node.width !== undefined && node.height !== undefined) {
          // 2.x
          width = node.width;
          height = node.height;
          anchorX = node.anchorX !== undefined ? node.anchorX : 0.5;
          anchorY = node.anchorY !== undefined ? node.anchorY : 0.5;
        } else if (!is3x && node.contentSize) {
          width = node.contentSize.width;
          height = node.contentSize.height;
          anchorX = node.anchorX !== undefined ? node.anchorX : 0.5;
          anchorY = node.anchorY !== undefined ? node.anchorY : 0.5;
        } else {
          // 默认尺寸
          width = 100;
          height = 100;
          anchorX = 0.5;
          anchorY = 0.5;
        }

        // 获取世界坐标
        if (node.worldPosition) {
          worldPos = { x: node.worldPosition.x, y: node.worldPosition.y };
        } else if (node.getWorldPosition) {
          try {
            const wp = node.getWorldPosition();
            if (wp) {
              worldPos = { x: wp.x, y: wp.y };
            }
          } catch (e) {
            // getWorldPosition 可能失败，使用备用方法
            if (node.convertToWorldSpaceAR) {
              const wp = node.convertToWorldSpaceAR(cc.v2(0, 0));
              worldPos = { x: wp.x, y: wp.y };
            } else {
              worldPos = { x: node.x || 0, y: node.y || 0 };
            }
          }
        } else if (node.convertToWorldSpaceAR) {
          const wp = node.convertToWorldSpaceAR(cc.v2(0, 0));
          worldPos = { x: wp.x, y: wp.y };
        } else {
          // 使用本地坐标
          worldPos = { x: node.x || 0, y: node.y || 0 };
        }

        // 获取缩放
        let scaleX = 1, scaleY = 1;
        if (node.scale && typeof node.scale === 'object') {
          scaleX = node.scale.x || 1;
          scaleY = node.scale.y || 1;
        } else {
          scaleX = node.scaleX !== undefined ? node.scaleX : 1;
          scaleY = node.scaleY !== undefined ? node.scaleY : 1;
        }

        // 计算世界坐标下的边界框
        const scaledWidth = width * Math.abs(scaleX);
        const scaledHeight = height * Math.abs(scaleY);

        return {
          x: worldPos.x - scaledWidth * anchorX,
          y: worldPos.y - scaledHeight * anchorY,
          width: scaledWidth,
          height: scaledHeight
        };
      } catch (err) {
        console.warn('[CC Inspector] 获取节点边界失败', err);
        return null;
      }
    },

    /**
     * 将世界坐标转换为屏幕坐标
     */
    worldToScreen(worldBounds, cc) {
      try {
        const canvas = document.querySelector('canvas');
        if (!canvas) return null;

        const canvasRect = canvas.getBoundingClientRect();

        // 获取可视尺寸
        let visibleWidth, visibleHeight;
        if (cc.view && cc.view.getVisibleSize) {
          const vs = cc.view.getVisibleSize();
          visibleWidth = vs.width;
          visibleHeight = vs.height;
        } else if (cc.winSize) {
          visibleWidth = cc.winSize.width;
          visibleHeight = cc.winSize.height;
        } else if (cc.view && cc.view.getDesignResolutionSize) {
          const size = cc.view.getDesignResolutionSize();
          visibleWidth = size.width;
          visibleHeight = size.height;
        } else {
          visibleWidth = canvasRect.width;
          visibleHeight = canvasRect.height;
        }

        // 缩放比例
        const scaleX = canvasRect.width / visibleWidth;
        const scaleY = canvasRect.height / visibleHeight;

        // Cocos 坐标系原点在左下角，y轴向上
        // 屏幕坐标系原点在左上角，y轴向下
        const cocosTopY = worldBounds.y + worldBounds.height;

        // 转换到屏幕坐标
        const screenX = canvasRect.left + worldBounds.x * scaleX;
        const screenY = canvasRect.top + (visibleHeight - cocosTopY) * scaleY;
        const screenWidth = worldBounds.width * scaleX;
        const screenHeight = worldBounds.height * scaleY;

        return {
          x: screenX,
          y: screenY,
          width: screenWidth,
          height: screenHeight
        };
      } catch (err) {
        console.warn('[CC Inspector] 坐标转换失败', err);
        return null;
      }
    },

    /**
     * 显示高亮覆盖层
     */
    showHighlightOverlay(rect) {
      // 取消之前的动画
      if (highlightAnimation) {
        clearTimeout(highlightAnimation);
        highlightAnimation = null;
      }

      // 创建或更新高亮元素
      if (!highlightOverlay) {
        highlightOverlay = document.createElement('div');
        highlightOverlay.id = 'cc-inspector-highlight';
        document.body.appendChild(highlightOverlay);
      }

      highlightOverlay.style.cssText = `
        position: fixed;
        left: ${rect.x}px;
        top: ${rect.y}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border: 2px solid #667eea;
        background: rgba(102, 126, 234, 0.25);
        pointer-events: none;
        z-index: 999996;
        box-sizing: border-box;
        transition: all 0.1s ease-out;
        box-shadow: 0 0 8px rgba(102, 126, 234, 0.6);
      `;

      // 添加动画样式
      this.ensureAnimationStyle();

      // 移除自动消失逻辑，改为由鼠标离开事件控制
    },

    /**
     * 确保动画样式存在
     */
    ensureAnimationStyle() {
      if (!document.getElementById('cc-inspector-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'cc-inspector-highlight-style';
        style.textContent = `
          @keyframes ccHighlightFlash {
            0% {
              border-color: #667eea;
              background: rgba(102, 126, 234, 0.2);
              box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
            }
            50% {
              border-color: #f59e0b;
              background: rgba(245, 158, 11, 0.3);
              box-shadow: 0 0 20px rgba(245, 158, 11, 0.8);
            }
            100% {
              border-color: #667eea;
              background: rgba(102, 126, 234, 0.2);
              box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
            }
          }
        `;
        document.head.appendChild(style);
      }
    },

    /**
     * 清除高亮
     */
    clearHighlight() {
      if (highlightAnimation) {
        clearTimeout(highlightAnimation);
        highlightAnimation = null;
      }
      if (highlightOverlay) {
        highlightOverlay.remove();
        highlightOverlay = null;
      }
    }
  };

  // 导出到全局命名空间
  window.__CCInspector.nodeHighlight = NodeHighlight;
})();