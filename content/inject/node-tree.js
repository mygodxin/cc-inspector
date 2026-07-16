/**
 * CC Inspector - 节点树构建模块
 * 负责构建场景节点树和节点类型检测
 */
(function () {
  const utils = window.__CCInspector?.utils;
  if (!utils) {
    console.error('[CC Inspector] cc-utils.js 未加载');
    return;
  }

  const NodeTree = {
    /**
     * 获取节点类型
     */
    getNodeType(node) {
      if (!node) return 'node';

      // 优先检查 FairyGUI 节点
      const fairygui = window.__CCInspector?.fairygui;
      if (fairygui && fairygui.isFairyGUINode(node)) {
        return fairygui.getFairyGUINodeType(node);
      }

      const components = utils.getComponents(node);

      // 优先级顺序检查组件类型
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        if (!comp) continue;
        const compName = utils.getComponentName(comp);

        // UI组件
        if (compName.includes('Button')) return 'button';
        if (compName.includes('Label') || compName.includes('RichText')) return 'label';
        if (compName.includes('Sprite')) return 'sprite';
        if (compName.includes('EditBox')) return 'editbox';
        if (compName.includes('ScrollView')) return 'scrollview';
        if (compName.includes('PageView')) return 'pageview';
        if (compName.includes('Toggle')) return 'toggle';
        if (compName.includes('ProgressBar')) return 'progressbar';
        if (compName.includes('Slider')) return 'slider';
        if (compName.includes('Layout')) return 'layout';
        if (compName.includes('Widget')) return 'widget';
        if (compName.includes('Mask')) return 'mask';

        // 渲染组件
        if (compName.includes('ParticleSystem')) return 'particle';
        if (compName.includes('TiledMap')) return 'tilemap';
        if (compName.includes('Spine') || compName.includes('sp.Skeleton')) return 'spine';
        if (compName.includes('DragonBones')) return 'dragonbones';
        if (compName.includes('Graphics')) return 'graphics';

        // 音频
        if (compName.includes('AudioSource')) return 'audio';

        // 摄像机和光照
        if (compName.includes('Camera')) return 'camera';
        if (compName.includes('Light')) return 'light';

        // 动画
        if (compName.includes('Animation')) return 'animation';

        // Canvas
        if (compName.includes('Canvas')) return 'canvas';
      }

      return 'node';
    },

    /**
     * 构建节点树
     */
    buildTree(node) {
      if (!node) return null;
      const children = [];

      // 检查是否为 FairyGUI 的 GRoot 节点
      const fairygui = window.__CCInspector?.fairygui;
      const isGRoot = fairygui && this.isGRootNode(node, fairygui);

      if (isGRoot) {
        // GRoot 节点：使用 FairyGUI 的 GObject 树作为子节点
        const fguiModule = fairygui.getFGUIModule();
        if (fguiModule && fguiModule.GRoot) {
          try {
            const gRoot = fguiModule.GRoot.inst;
            if (gRoot) {
              const fguiChildren = this.buildGObjectChildren(gRoot, fairygui);
              children.push(...fguiChildren);
            }
          } catch (e) {
            console.warn('[CC Inspector] 构建 GRoot 子节点失败:', e);
          }
        }
      } else {
        // 普通节点：使用 Cocos 节点的 children
        const nodeChildren = node.children || node._children || [];
        for (let i = 0; i < nodeChildren.length; i++) {
          const child = this.buildTree(nodeChildren[i]);
          if (child) children.push(child);
        }
      }

      // Scene 节点没有 active 和 activeInHierarchy 属性
      const isScene = node.isScene || (node.uuid && !node.parent && !node._parent);
      let isActive = true;
      if (!isScene) {
        isActive = node.active !== false && node.activeInHierarchy !== false;
      }

      return {
        uuid: node.uuid || node._id || String(Math.random()),
        name: node.name || 'unnamed',
        active: isActive,
        nodeType: this.getNodeType(node),
        children: children
      };
    },

    /**
     * 检查是否为 GRoot 节点
     */
    isGRootNode(node, fairygui) {
      if (!node || !fairygui) return false;

      // 检查节点名称
      if (node.name === 'GRoot') return true;

      // 检查是否有 GRoot 组件或标记
      const components = utils.getComponents(node);
      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        if (!comp) continue;
        const compName = utils.getComponentName(comp);
        if (compName.includes('GRoot') || compName.includes('UIRoot')) {
          return true;
        }
      }

      return false;
    },

    /**
     * 构建 GObject 子节点树
     */
    buildGObjectChildren(gObject, fairygui) {
      if (!gObject || !fairygui) return [];

      const children = [];
      const numChildren = gObject.numChildren || 0;

      for (let i = 0; i < numChildren; i++) {
        const child = gObject.getChildAt(i);
        if (child) {
          const childTree = this.buildGObjectTree(child, fairygui);
          if (childTree) children.push(childTree);
        }
      }

      return children;
    },

    /**
     * 递归构建 GObject 树
     */
    buildGObjectTree(gObject, fairygui) {
      if (!gObject || !fairygui) return null;

      const children = [];
      const nodeType = fairygui.getGObjectTypeName(gObject);
      const isGroup = nodeType === 'ggroup';

      // GGroup 的子节点需要通过 group 属性来判断
      if (isGroup) {
        // 从父节点获取所有子节点，然后筛选出属于这个 group 的
        const parent = gObject.parent;
        if (parent) {
          const parentNumChildren = parent.numChildren || 0;
          for (let i = 0; i < parentNumChildren; i++) {
            const child = parent.getChildAt(i);
            // 检查 child.group 是否指向当前 GGroup
            // 使用 id 比较而不是对象引用比较
            if (child && child.group && child.group.id === gObject.id) {
              const childTree = this.buildGObjectTree(child, fairygui);
              if (childTree) children.push(childTree);
            }
          }
        }
      } else {
        // 普通节点使用 numChildren
        const numChildren = gObject.numChildren || 0;
        for (let i = 0; i < numChildren; i++) {
          const child = gObject.getChildAt(i);
          if (child) {
            // 跳过属于某个 Group 的节点（它们会在 Group 下显示）
            if (child.group) {
              continue;
            }
            const childTree = this.buildGObjectTree(child, fairygui);
            if (childTree) children.push(childTree);
          }
        }
      }

      const className = gObject.constructor?.name || 'GObject';
      const nodeId = gObject.id || gObject.__id || String(Math.random());

      return {
        uuid: 'fgui_' + nodeId,
        name: gObject.name || className,
        active: gObject.visible !== false,
        nodeType: nodeType,
        children: children,
        // FairyGUI 特殊标记
        __isFairyGUI: true,
        __gObjectId: nodeId
      };
    },

    /**
     * 查找所有 Sprite 节点
     */
    findSpriteNodes(node, result = []) {
      if (!node) return result;

      const spriteComp = utils.findComponent(node, 'Sprite');
      if (spriteComp) {
        let spriteFrameName = '';
        if (spriteComp.spriteFrame) {
          spriteFrameName = spriteComp.spriteFrame.name || spriteComp.spriteFrame._name || '';
        }
        result.push({
          uuid: node.uuid || node._id,
          name: node.name || 'unnamed',
          spriteFrame: spriteFrameName
        });
      }

      const children = node.children || node._children || [];
      for (let i = 0; i < children.length; i++) {
        this.findSpriteNodes(children[i], result);
      }

      return result;
    }
  };

  // 导出到全局命名空间
  window.__CCInspector.nodeTree = NodeTree;
})();