/**
 * CC Inspector - 节点属性模块
 * 负责获取和设置节点属性
 */
(function () {
  const utils = window.__CCInspector?.utils;
  if (!utils) {
    console.error('[CC Inspector] cc-utils.js 未加载');
    return;
  }

  const NodeProps = {
    // ========== 属性辅助函数 ==========
    addProp(group, name, value, type) {
      if (value === undefined) return;
      group.properties.push({ name, value, type, editable: true });
    },

    addVec2(group, name, v) {
      group.properties.push({ name, type: 'vec2', editable: true, x: v.x || 0, y: v.y || 0 });
    },

    addVec3(group, name, v) {
      group.properties.push({ name, type: 'vec3', editable: true, x: v.x || 0, y: v.y || 0, z: v.z || 0 });
    },

    addSize(group, name, s) {
      group.properties.push({ name, type: 'size', editable: true, width: s.width || 0, height: s.height || 0 });
    },

    addColor(group, name, c) {
      group.properties.push({ name, type: 'color', editable: true, r: c.r || 0, g: c.g || 0, b: c.b || 0, a: c.a !== undefined ? c.a : 255 });
    },

    // ========== 获取节点属性 ==========
    getProps(node) {
      if (!node) return [];
      const result = [];

      try {
        // Node基本属性
        const nodeProps = { name: 'Node', properties: [] };
        const addedNodeProps = new Set();
        const addUniqueNodeProp = (name, value, type, extra = {}) => {
          if (addedNodeProps.has(name)) return;
          addedNodeProps.add(name);
          nodeProps.properties.push({ name, value, type, editable: true, ...extra });
        };

        // 基础属性
        try { if (node.name !== undefined) addUniqueNodeProp('name', node.name, 'string'); } catch (e) { }
        try { if (node.active !== undefined) addUniqueNodeProp('active', node.active, 'boolean'); } catch (e) { }

        // 位置 - 多分量
        try {
          if (node.position) {
            addedNodeProps.add('position');
            this.addVec3(nodeProps, 'position', node.position);
          } else {
            if (node.x !== undefined) addUniqueNodeProp('x', node.x, 'number');
            if (node.y !== undefined) addUniqueNodeProp('y', node.y, 'number');
            if (node.z !== undefined) addUniqueNodeProp('z', node.z, 'number');
          }
        } catch (e) { }

        // 旋转
        try { if (node.angle !== undefined) addUniqueNodeProp('angle', node.angle, 'number'); } catch (e) { }
        try { if (node.eulerAngles) { addedNodeProps.add('eulerAngles'); this.addVec3(nodeProps, 'eulerAngles', node.eulerAngles); } } catch (e) { }

        // 缩放
        try {
          if (node.scale && typeof node.scale === 'object') {
            addedNodeProps.add('scale');
            this.addVec3(nodeProps, 'scale', node.scale);
          } else {
            if (node.scaleX !== undefined) addUniqueNodeProp('scaleX', node.scaleX, 'number');
            if (node.scaleY !== undefined) addUniqueNodeProp('scaleY', node.scaleY, 'number');
            if (node.scaleZ !== undefined) addUniqueNodeProp('scaleZ', node.scaleZ, 'number');
          }
        } catch (e) { }

        // 锚点和尺寸 (3.x 移到了 UITransform)
        const is3x = utils.is3x();
        let uiTransform = null;
        if (is3x) {
          uiTransform = utils.findComponent(node, 'UITransform');
        }

        // 锚点
        try {
          if (uiTransform) {
            addedNodeProps.add('anchor');
            this.addVec2(nodeProps, 'anchor', uiTransform.anchorPoint);
          } else if (!is3x && (node.anchorX !== undefined || node.anchorY !== undefined)) {
            addedNodeProps.add('anchor');
            this.addVec2(nodeProps, 'anchor', { x: node.anchorX ?? 0, y: node.anchorY ?? 0 });
          }
        } catch (e) { }

        // 尺寸
        try {
          if (uiTransform) {
            addedNodeProps.add('contentSize');
            this.addSize(nodeProps, 'contentSize', uiTransform.contentSize);
          } else if (!is3x && node.contentSize) {
            addedNodeProps.add('contentSize');
            this.addSize(nodeProps, 'contentSize', node.contentSize);
          } else if (!is3x && (node.width !== undefined || node.height !== undefined)) {
            addedNodeProps.add('size');
            this.addSize(nodeProps, 'size', { width: node.width ?? 0, height: node.height ?? 0 });
          }
        } catch (e) { }

        // 透明度和颜色
        try { if (node.opacity !== undefined) addUniqueNodeProp('opacity', node.opacity, 'number'); } catch (e) { }
        try { if (node.color) { addedNodeProps.add('color'); this.addColor(nodeProps, 'color', node.color); } } catch (e) { }

        // 层级
        try { if (node.zIndex !== undefined) addUniqueNodeProp('zIndex', node.zIndex, 'number'); } catch (e) { }
        try {
          if (node.layer !== undefined) {
            addUniqueNodeProp('layer', node.layer, 'layer', { options: utils.getLayers() });
          }
        } catch (e) { }

        // 检查是否为 FairyGUI 节点
        const fairygui = window.__CCInspector?.fairygui;
        if (fairygui && fairygui.isFairyGUINode(node)) {
          const fguiProps = fairygui.getFairyGUIProps(node);
          result.push(...fguiProps);
        }

        // 对 Node 也进行一次通用扫描，以防有自定义扩展属性
        this.addGenericProps(node, nodeProps, addedNodeProps);

        result.push(nodeProps);

        // 组件属性
        const components = utils.getComponents(node);
        components.forEach(comp => {
          if (!comp) return;
          try {
            const compName = utils.getComponentName(comp) || 'Component';
            const compProps = { name: compName, properties: [] };

            // 通用组件属性
            try { if (comp.enabled !== undefined) this.addProp(compProps, 'enabled', comp.enabled, 'boolean'); } catch (e) { }

            // 根据组件类型添加特定属性
            this.addComponentProps(comp, compName, compProps);

            // UUID只读 (已隐藏)
            // try { if (comp.uuid) compProps.properties.push({ name: 'uuid', value: comp.uuid, type: 'string', editable: false }); } catch(e) {}

            if (compProps.properties.length > 0) result.push(compProps);
          } catch (e) { }
        });
      } catch (e) { }

      return result;
    },

    /**
     * 根据组件类型添加特定属性
     */
    addComponentProps(comp, compName, compProps) {
      const isSprite = compName.includes('Sprite');
      const isLabel = compName.includes('Label');
      const isButton = compName.includes('Button');
      const isUITransform = compName.includes('UITransform');
      const isWidget = compName.includes('Widget');
      const isProgressBar = compName.includes('ProgressBar');
      const isToggle = compName.includes('Toggle');

      // 记录已添加的属性名，避免重复
      const addedProps = new Set();
      const addUniqueProp = (name, value, type, extra = {}) => {
        if (addedProps.has(name)) return;
        addedProps.add(name);
        compProps.properties.push({ name, value, type, editable: true, ...extra });
      };

      if (isSprite) {
        try { if (comp.spriteFrame) { addUniqueProp('spriteFrame', comp.spriteFrame.name || comp.spriteFrame._name || 'SpriteFrame', 'string', { editable: false }); } } catch (e) { }
        try {
          if (comp.type !== undefined) {
            addUniqueProp('type', comp.type, 'enum', { options: utils.getSpriteTypes() });
          }
        } catch (e) { }
        try {
          if (comp.sizeMode !== undefined) {
            addUniqueProp('sizeMode', comp.sizeMode, 'enum', { options: utils.getSpriteSizeModes() });
          }
        } catch (e) { }
        try {
          if (comp.fillType !== undefined) {
            addUniqueProp('fillType', comp.fillType, 'enum', { options: utils.getSpriteFillTypes() });
          }
        } catch (e) { }
        try { if (comp.color) { addedProps.add('color'); this.addColor(compProps, 'color', comp.color); } } catch (e) { }
      } else if (isLabel) {
        try { if (comp.string !== undefined) { addUniqueProp('string', comp.string, 'string'); } } catch (e) { }
        try {
          if (comp.horizontalAlign !== undefined) {
            addUniqueProp('horizontalAlign', comp.horizontalAlign, 'enum', { options: utils.getLabelHorizontalAligns() });
          }
        } catch (e) { }
        try {
          if (comp.verticalAlign !== undefined) {
            addUniqueProp('verticalAlign', comp.verticalAlign, 'enum', { options: utils.getLabelVerticalAligns() });
          }
        } catch (e) { }
        try {
          if (comp.overflow !== undefined) {
            addUniqueProp('overflow', comp.overflow, 'enum', { options: utils.getLabelOverflows() });
          }
        } catch (e) { }
        try { if (comp.color) { addedProps.add('color'); this.addColor(compProps, 'color', comp.color); } } catch (e) { }
      } else if (isButton) {
        try { if (comp.interactable !== undefined) { addUniqueProp('interactable', comp.interactable, 'boolean'); } } catch (e) { }
        try { if (comp.normalColor) { addedProps.add('normalColor'); this.addColor(compProps, 'normalColor', comp.normalColor); } } catch (e) { }
      } else if (isUITransform) {
        try { if (comp.contentSize) { addedProps.add('contentSize'); this.addSize(compProps, 'contentSize', comp.contentSize); } } catch (e) { }
        try { if (comp.anchorPoint) { addedProps.add('anchorPoint'); this.addVec2(compProps, 'anchorPoint', comp.anchorPoint); } } catch (e) { }
      }

      // 无论是否是内置组件，最后都进行通用属性扫描，以显示所有可见属性
      this.addGenericProps(comp, compProps, addedProps);
    },

    /**
     * 添加通用组件属性
     */
    addGenericProps(comp, compProps, addedProps = new Set()) {
      const keys = new Set();

      // 1. 获取实例上的所有属性
      for (const key in comp) {
        keys.add(key);
      }

      // 2. 获取 Cocos 类定义的属性 (2.x 为 __props__, 3.x 较为复杂但通常也在实例上)
      if (comp.constructor && comp.constructor.__props__) {
        comp.constructor.__props__.forEach(k => keys.add(k));
      }

      // 3. 遍历并过滤
      for (const key of keys) {
        // 过滤掉已添加的、内部私有的、以及基础字段
        if (addedProps.has(key)) continue;
        // 过滤掉下划线开头的私有属性、内部字段以及基础字段
        if (key.startsWith('_') || key === 'node' || key === 'enabled' || key === 'uuid') continue;

        // 过滤掉函数
        try {
          if (typeof comp[key] === 'function') continue;
        } catch (e) { continue; }

        try {
          let val = comp[key];
          if (val === undefined) continue;

          let type = typeof val;

          if (val === null) {
            this.addProp(compProps, key, 'null', 'string');
          } else if (type === 'number') {
            this.addProp(compProps, key, val, 'number');
          } else if (type === 'string') {
            this.addProp(compProps, key, val, 'string');
          } else if (type === 'boolean') {
            this.addProp(compProps, key, val, 'boolean');
          } else if (type === 'object') {
            // 识别 Cocos 特殊对象类型
            const constructorName = val.constructor?.name;

            if (constructorName === 'Color' || (val.r !== undefined && val.g !== undefined && val.b !== undefined)) {
              this.addColor(compProps, key, val);
            } else if (constructorName === 'Vec3' || (val.x !== undefined && val.y !== undefined && val.z !== undefined)) {
              this.addVec3(compProps, key, val);
            } else if (constructorName === 'Vec2' || constructorName === 'Size' || (val.x !== undefined && val.y !== undefined) || (val.width !== undefined && val.height !== undefined)) {
              if (val.width !== undefined) this.addSize(compProps, key, val);
              else this.addVec2(compProps, key, val);
            } else if (utils.isNode(val) || utils.isComponent(val) || utils.isAsset(val)) {
              // 识别节点、组件或资源引用
              const isNode = utils.isNode(val);
              const isComp = utils.isComponent(val);
              const isAsset = utils.isAsset(val);

              let targetUuid = val.uuid || val._uuid;
              if (isComp && val.node) {
                targetUuid = val.node.uuid || val.node._id;
              }

              const compName = utils.getComponentName(val);
              let displayName = val.name || val._name || (val.node ? val.node.name : '') || compName || 'Reference';

              // 统一显示格式：显示所属节点名称
              if (isNode || isComp) {
                displayName = isNode ? val.name : (val.node ? val.node.name : 'Unknown');
              }

              let nodeType = 'node';
              if (isNode || isComp) {
                const targetNode = isNode ? val : val.node;
                if (targetNode && window.__CCInspector.nodeTree) {
                  nodeType = window.__CCInspector.nodeTree.getNodeType(targetNode);
                }
              } else if (isAsset) {
                nodeType = 'asset';
              }

              compProps.properties.push({
                name: key,
                value: displayName,
                targetType: compName || (isAsset ? 'cc.Asset' : 'cc.Node'),
                uuid: (isNode || isComp) ? targetUuid : null,
                nodeType: nodeType,
                type: (isNode || isComp || isAsset) ? 'node-ref' : 'string',
                editable: false
              });
            }
          }
        } catch (e) { }
      }
    },

    // ========== 设置属性 ==========
    setProp(node, comp, prop, value) {
      const target = comp === 'Node' ? node : utils.findComponent(node, comp);
      if (target) {
        let v = value;
        if (value === 'true') v = true;
        else if (value === 'false') v = false;
        else if (!isNaN(Number(value))) v = Number(value);
        target[prop] = v;
      }
    },

    setVec(node, comp, prop, value) {
      let target = comp === 'Node' ? node : utils.findComponent(node, comp);
      const is3x = utils.is3x();

      // 3.x 兼容性处理：anchor 移到了 UITransform
      if (is3x && comp === 'Node' && prop === 'anchor') {
        const uiTransform = utils.findComponent(node, 'UITransform');
        if (uiTransform) {
          uiTransform.anchorX = Number(value.x);
          uiTransform.anchorY = Number(value.y);
          return;
        }
      }

      if (target && target[prop]) {
        target[prop].x = Number(value.x);
        target[prop].y = Number(value.y);
        if (value.z !== undefined) target[prop].z = Number(value.z);
      } else if (target) {
        if (prop === 'position' && target.setPosition) target.setPosition(Number(value.x), Number(value.y), Number(value.z) || 0);
        else if (prop === 'scale' && target.setScale) target.setScale(Number(value.x), Number(value.y), Number(value.z) || 1);
        else if (prop === 'anchor' && !is3x) { target.anchorX = Number(value.x); target.anchorY = Number(value.y); }
      }
    },

    setSize(node, comp, prop, value) {
      let target = comp === 'Node' ? node : utils.findComponent(node, comp);
      const is3x = utils.is3x();

      // 3.x 兼容性处理：size 移到了 UITransform
      if (is3x && comp === 'Node' && (prop === 'size' || prop === 'contentSize')) {
        const uiTransform = utils.findComponent(node, 'UITransform');
        if (uiTransform) {
          uiTransform.setContentSize(Number(value.width), Number(value.height));
          return;
        }
      }

      if (target) {
        if (target[prop]) {
          target[prop].width = Number(value.width);
          target[prop].height = Number(value.height);
        } else if (prop === 'size' || prop === 'contentSize') {
          if (target.setContentSize) target.setContentSize(Number(value.width), Number(value.height));
          else if (!is3x) { target.width = Number(value.width); target.height = Number(value.height); }
        }
      }
    },

    setColor(node, comp, prop, value) {
      const target = comp === 'Node' ? node : utils.findComponent(node, comp);
      if (target && target[prop]) {
        target[prop].r = Number(value.r);
        target[prop].g = Number(value.g);
        target[prop].b = Number(value.b);
        target[prop].a = Number(value.a);
      }
    }
  };

  // 导出到全局命名空间
  window.__CCInspector.nodeProps = NodeProps;
})();