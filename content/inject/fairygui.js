/**
 * CC Inspector - FairyGUI 扩展模块
 * 提供 FairyGUI UI 框架的节点识别、属性获取和类型检测支持
 */
(function () {
    const utils = window.__CCInspector?.utils;
    if (!utils) {
        console.error('[CC Inspector] cc-utils.js 未加载');
        return;
    }

    const FairyGUI = {
        _detected: null,

        /**
         * 检测当前页面是否使用 FairyGUI
         */
        isFairyGUIPresent() {
            if (this._detected !== null) return this._detected;

            const cc = utils.getCC();
            if (!cc) {
                this._detected = false;
                return false;
            }

            this._detected = !!(cc.fgui || window.fgui || cc.FairyGUI);
            return this._detected;
        },

        /**
         * 获取 FairyGUI 模块
         */
        getFGUIModule() {
            const cc = utils.getCC();
            if (!cc) return null;
            const fgui = cc.fgui || window.fgui || cc.FairyGUI || null;
            return fgui;
        },

        /**
         * 判断节点是否为 FairyGUI 节点
         */
        isFairyGUINode(node) {
            if (!node) return false;
            if (node.name === 'GRoot') return true;

            const components = utils.getComponents(node);
            for (let i = 0; i < components.length; i++) {
                const comp = components[i];
                if (!comp) continue;
                const compName = utils.getComponentName(comp);
                if (compName.includes('UIPanel') || compName.includes('FairyGUI')) {
                    return true;
                }
            }

            if (node.__fguiObject || node._fguiObject) return true;
            if (node.__isFairyGUINode) return true;

            return false;
        },

        /**
         * 获取节点关联的 FairyGUI GObject
         */
        getGObject(node) {
            if (!node) return null;
            if (node.__fguiObject) return node.__fguiObject;
            if (node._fguiObject) return node._fguiObject;

            const panelComp = utils.findComponent(node, 'UIPanel');
            if (panelComp) {
                return panelComp.ui || panelComp._ui || null;
            }

            return null;
        },

        /**
         * 获取 GObject 的类型名称
         */
        getGObjectTypeName(gObject) {
            if (!gObject) return 'gcomponent';

            // 使用原型链检测（instanceof）
            const fguiModule = this.getFGUIModule();
            if (fguiModule) {
                const typeChecks = [
                    'GRoot', 'GTree', 'GList', 'GComboBox', 'GScrollBar',
                    'GSlider', 'GProgressBar', 'GButton', 'GLabel',
                    'GTextInput', 'GRichTextField', 'GTextField',
                    'GLoader3D', 'GLoader', 'GMovieClip', 'GImage', 'GGraph',
                    'GGroup', 'GComponent'
                ];

                for (const typeName of typeChecks) {
                    const TypeClass = fguiModule[typeName];
                    if (TypeClass && gObject instanceof TypeClass) {
                        return this.constructorNameToType(typeName);
                    }
                }
            }

            return 'gcomponent';
        },

        /**
         * 将类名转换为节点类型
         */
        constructorNameToType(className) {
            if (!className) return 'gcomponent';

            const typeMap = {
                'GRoot': 'groot',
                'GComponent': 'gcomponent',
                'GButton': 'gbutton',
                'GLabel': 'glabel',
                'GProgressBar': 'gprogressbar',
                'GSlider': 'gslider',
                'GScrollBar': 'gscrollbar',
                'GTextField': 'gtextfield',
                'GInputTextField': 'ginputtextfield',
                'GRichTextField': 'grichtextfield',
                'GImage': 'gimage',
                'GGroup': 'ggroup',
                'GList': 'glist',
                'GComboBox': 'gcombobox',
                'GGraph': 'ggraph',
                'GLoader': 'gloader',
                'GTree': 'gtree',
                'MovieClip': 'gmovieclip',
                'GTextInput': 'ginputtextfield'
            };

            for (const [key, type] of Object.entries(typeMap)) {
                if (className.includes(key)) {
                    return type;
                }
            }

            return 'gcomponent';
        },

        /**
         * 获取 FairyGUI 节点类型（用于节点树显示）
         */
        getFairyGUINodeType(node) {
            if (!node) return 'node';

            const gObject = this.getGObject(node);
            if (gObject) {
                return this.getGObjectTypeName(gObject);
            }

            const components = utils.getComponents(node);
            for (let i = 0; i < components.length; i++) {
                const comp = components[i];
                if (!comp) continue;
                const compName = utils.getComponentName(comp);
                if (compName.includes('UIPanel')) return 'guipanel';
                if (compName.includes('FairyGUI')) return 'fgui';
            }

            return 'node';
        },

        /**
         * 构建 FairyGUI 节点树（从 GRoot 开始）
         */
        buildFairyGUITree(scene) {
            if (!scene) return [];

            const fguiModule = this.getFGUIModule();
            if (!fguiModule || !fguiModule.GRoot) return [];

            try {
                const gRoot = fguiModule.GRoot.inst;
                if (!gRoot) return [];

                const tree = this.buildGObjectTree(gRoot, null);
                return tree ? [tree] : [];
            } catch (e) {
                console.warn('[CC Inspector] 构建 FairyGUI 树失败:', e);
                return [];
            }
        },

        /**
         * 递归构建 GObject 树
         */
        buildGObjectTree(gObject, parentNode, depth = 0) {
            if (!gObject) return null;

            const children = [];
            const numChildren = gObject.numChildren || 0;

            for (let i = 0; i < numChildren; i++) {
                const child = gObject.getChildAt(i);
                if (child) {
                    const childTree = this.buildGObjectTree(child, parentNode, depth + 1);
                    if (childTree) children.push(childTree);
                }
            }

            const nodeType = this.getGObjectTypeName(gObject);
            const className = gObject.constructor?.name || 'GObject';
            const nodeId = gObject.id || gObject.__id || String(Math.random());

            return {
                uuid: 'fgui_' + nodeId,
                name: gObject.name || className,
                active: gObject.visible !== false,
                nodeType: nodeType,
                children: children,
                __isFairyGUI: true,
                __gObjectId: nodeId
            };
        },

        /**
         * 根据 UUID 查找 FairyGUI 节点
         */
        findFairyGUINodeByUuid(scene, uuid) {
            if (!uuid || !uuid.startsWith('fgui_')) return null;

            const fguiModule = this.getFGUIModule();
            if (!fguiModule || !fguiModule.GRoot) return null;

            try {
                const gRoot = fguiModule.GRoot.inst;
                if (!gRoot) return null;
                return this.searchGObjectByUuid(gRoot, uuid);
            } catch (e) {
                console.warn('[CC Inspector] 查找 FairyGUI 节点失败:', e);
                return null;
            }
        },

        /**
         * 递归搜索 GObject
         */
        searchGObjectByUuid(gObject, uuid) {
            if (!gObject) return null;

            const nodeId = 'fgui_' + (gObject.id || gObject.__id);
            if (nodeId === uuid) {
                return { gObject: gObject, uuid: uuid };
            }

            const numChildren = gObject.numChildren || 0;
            for (let i = 0; i < numChildren; i++) {
                const child = gObject.getChildAt(i);
                if (child) {
                    const found = this.searchGObjectByUuid(child, uuid);
                    if (found) return found;
                }
            }

            return null;
        },

        /**
         * 获取 FairyGUI 节点的属性
         */
        getFairyGUIProps(gObject) {
            if (!gObject) return [];

            const result = [];
            const className = gObject.constructor?.name || 'GObject';

            // 使用具体的组件类型名称而不是 GObject
            const typeName = this.getTypeDisplayName(gObject);

            // GObject 基础属性
            const baseProps = { name: typeName, properties: [] };
            this.addBaseProps(gObject, baseProps);
            if (baseProps.properties.length > 0) result.push(baseProps);

            // 变换属性
            const transformProps = { name: 'Transform', properties: [] };
            this.addTransformProps(gObject, transformProps);
            if (transformProps.properties.length > 0) result.push(transformProps);

            // 外观属性
            const appearanceProps = { name: 'Appearance', properties: [] };
            this.addAppearanceProps(gObject, appearanceProps);
            if (appearanceProps.properties.length > 0) result.push(appearanceProps);

            // 资源信息
            const resourceProps = { name: 'Resource', properties: [] };
            this.addResourceProps(gObject, resourceProps);
            if (resourceProps.properties.length > 0) result.push(resourceProps);

            // 根据类型添加特定属性
            if (this.isComponentObject(gObject)) {
                const compProps = { name: 'Component', properties: [] };
                this.addComponentProps(gObject, compProps);
                if (compProps.properties.length > 0) result.push(compProps);
            }

            if (this.isTextObject(gObject)) {
                const textProps = { name: 'Text', properties: [] };
                this.addTextProps(gObject, textProps);
                if (textProps.properties.length > 0) result.push(textProps);
            }

            if (this.isButtonObject(gObject)) {
                const btnProps = { name: 'Button', properties: [] };
                this.addButtonProps(gObject, btnProps);
                if (btnProps.properties.length > 0) result.push(btnProps);
            }

            if (this.isImageObject(gObject)) {
                const imgProps = { name: 'Image', properties: [] };
                this.addImageProps(gObject, imgProps);
                if (imgProps.properties.length > 0) result.push(imgProps);
            }

            if (this.isListObject(gObject)) {
                const listProps = { name: 'List', properties: [] };
                this.addListProps(gObject, listProps);
                if (listProps.properties.length > 0) result.push(listProps);
            }

            if (this.isProgressBarObject(gObject)) {
                const progressProps = { name: 'ProgressBar', properties: [] };
                this.addProgressBarProps(gObject, progressProps);
                if (progressProps.properties.length > 0) result.push(progressProps);
            }

            if (this.isSliderObject(gObject)) {
                const sliderProps = { name: 'Slider', properties: [] };
                this.addSliderProps(gObject, sliderProps);
                if (sliderProps.properties.length > 0) result.push(sliderProps);
            }

            if (this.isComboBoxObject(gObject)) {
                const comboProps = { name: 'ComboBox', properties: [] };
                this.addComboBoxProps(gObject, comboProps);
                if (comboProps.properties.length > 0) result.push(comboProps);
            }

            if (this.isLoaderObject(gObject)) {
                const loaderProps = { name: 'Loader', properties: [] };
                this.addLoaderProps(gObject, loaderProps);
                if (loaderProps.properties.length > 0) result.push(loaderProps);
            }

            if (this.isGroupObject(gObject)) {
                const groupProps = { name: 'Group', properties: [] };
                this.addGroupProps(gObject, groupProps);
                if (groupProps.properties.length > 0) result.push(groupProps);
            }

            return result;
        },

        /**
         * 获取组件类型的显示名称
         */
        getTypeDisplayName(gObject) {
            if (!gObject) return 'GObject';

            // 使用原型链检测（instanceof）- 这是最稳定的方式
            const fguiModule = this.getFGUIModule();
            if (fguiModule) {
                // 按继承顺序检查，从最具体的类型开始
                const typeChecks = [
                    'GRoot', 'GTree', 'GList', 'GComboBox', 'GScrollBar',
                    'GSlider', 'GProgressBar', 'GButton', 'GLabel',
                    'GTextInput', 'GRichTextField', 'GTextField',
                    'GLoader3D', 'GLoader', 'GMovieClip', 'GImage', 'GGraph',
                    'GGroup', 'GComponent'
                ];

                for (const typeName of typeChecks) {
                    const TypeClass = fguiModule[typeName];
                    if (TypeClass && gObject instanceof TypeClass) {
                        return typeName;
                    }
                }
            }

            // 如果 instanceof 检测失败，返回 GObject
            return 'GObject';
        },

        /**
         * 添加基础属性
         */
        addBaseProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                addProp('name', gObject.name, 'string');
                addProp('id', gObject.id, 'number', false);
                addProp('visible', gObject.visible, 'boolean');
                addProp('touchable', gObject.touchable, 'boolean');
                addProp('draggable', gObject.draggable, 'boolean');

                if (gObject.parent) {
                    addProp('siblingIndex', gObject.siblingIndex, 'number');
                }
            } catch (e) { }
        },

        /**
         * 添加变换属性
         */
        addTransformProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                addProp('x', gObject.x, 'number');
                addProp('y', gObject.y, 'number');
                addProp('width', gObject.width, 'number');
                addProp('height', gObject.height, 'number');
                addProp('pivotX', gObject.pivotX, 'number');
                addProp('pivotY', gObject.pivotY, 'number');
                addProp('scaleX', gObject.scaleX, 'number');
                addProp('scaleY', gObject.scaleY, 'number');
                addProp('rotation', gObject.rotation, 'number');
                addProp('skewX', gObject.skewX, 'number');
                addProp('skewY', gObject.skewY, 'number');
            } catch (e) { }
        },

        /**
         * 添加外观属性
         */
        addAppearanceProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                addProp('alpha', gObject.alpha, 'number');
                addProp('grayed', gObject.grayed, 'boolean');

                // blendMode 是枚举
                if (gObject.blendMode !== undefined) {
                    const blendModeEnum = this.getBlendModeEnum();
                    addProp('blendMode', gObject.blendMode, 'enum', true, { options: blendModeEnum });
                }

                if (gObject.filter) {
                    addProp('filter', gObject.filter.constructor?.name || '', 'string', false);
                }

                if (gObject.tooltips) {
                    addProp('tooltips', gObject.tooltips, 'string');
                }
            } catch (e) { }
        },

        /**
         * 添加资源属性
         */
        addResourceProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                if (gObject.packageItem) {
                    addProp('packageName', gObject.packageItem.owner?.name || '', 'string', false);
                    addProp('resourceName', gObject.packageItem.name || '', 'string', false);
                    addProp('resourceType', gObject.packageItem.type || '', 'string', false);
                }

                if (gObject.data !== undefined && gObject.data !== null) {
                    const dataStr = typeof gObject.data === 'object'
                        ? JSON.stringify(gObject.data).substring(0, 100)
                        : String(gObject.data);
                    addProp('data', dataStr, 'string', false);
                }
            } catch (e) { }
        },

        /**
         * 添加文本属性
         */
        addTextProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                addProp('text', gObject.text, 'string');
                addProp('fontSize', gObject.fontSize, 'number');
                addProp('color', this.colorToString(gObject.color), 'string');

                // align 是枚举
                if (gObject.align !== undefined) {
                    const alignEnum = this.getAlignEnum();
                    addProp('align', gObject.align, 'enum', true, { options: alignEnum });
                }

                // valign 是枚举
                if (gObject.valign !== undefined) {
                    const valignEnum = this.getValignEnum();
                    addProp('valign', gObject.valign, 'enum', true, { options: valignEnum });
                }

                addProp('bold', gObject.bold, 'boolean');
                addProp('italic', gObject.italic, 'boolean');
                addProp('underline', gObject.underline, 'boolean');

                // autoSize 是枚举
                if (gObject.autoSize !== undefined) {
                    const autoSizeEnum = this.getAutoSizeEnum();
                    addProp('autoSize', gObject.autoSize, 'enum', true, { options: autoSizeEnum });
                }

                addProp('singleLine', gObject.singleLine, 'boolean');
                addProp('leading', gObject.leading, 'number');
                addProp('letterSpacing', gObject.letterSpacing, 'number');

                if (gObject.htmlText) {
                    addProp('htmlText', gObject.htmlText.substring(0, 100), 'string');
                }
            } catch (e) { }
        },

        /**
         * 添加按钮属性
         */
        addButtonProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable });
                }
            };

            try {
                addProp('title', gObject.title, 'string');
                addProp('selectedTitle', gObject.selectedTitle, 'string');
                addProp('icon', gObject.icon, 'string');
                addProp('selectedIcon', gObject.selectedIcon, 'string');
                addProp('sound', gObject.sound, 'string', false);
                addProp('checked', gObject.checked, 'boolean');
                addProp('changeStateOnClick', gObject.changeStateOnClick, 'boolean');
                addProp('relatedController', gObject.relatedController?.name || '', 'string', false);
            } catch (e) { }
        },

        /**
         * 添加图片属性
         */
        addImageProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                addProp('icon', gObject.icon, 'string');

                // fillMethod 是枚举
                if (gObject.fillMethod !== undefined) {
                    const fillMethodEnum = this.getFillMethodEnum();
                    addProp('fillMethod', gObject.fillMethod, 'enum', true, { options: fillMethodEnum });
                }

                addProp('fillAmount', gObject.fillAmount, 'number');
                addProp('fillClockwise', gObject.fillClockwise, 'boolean');
                addProp('fillOrigin', gObject.fillOrigin, 'number');

                // flip 是枚举
                if (gObject.flip !== undefined) {
                    const flipEnum = this.getFlipEnum();
                    addProp('flip', gObject.flip, 'enum', true, { options: flipEnum });
                }

                addProp('color', this.colorToString(gObject.color), 'string');
            } catch (e) { }
        },

        /**
         * 添加列表属性
         */
        addListProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                addProp('numItems', gObject.numItems, 'number', false);

                // layout 是枚举
                if (gObject.layout !== undefined) {
                    const layoutEnum = this.getLayoutEnum();
                    addProp('layout', gObject.layout, 'enum', true, { options: layoutEnum });
                }

                // selectionMode 是枚举
                if (gObject.selectionMode !== undefined) {
                    const selectionModeEnum = this.getSelectionModeEnum();
                    addProp('selectionMode', gObject.selectionMode, 'enum', true, { options: selectionModeEnum });
                }

                addProp('scrollItemToViewOnClick', gObject.scrollItemToViewOnClick, 'boolean');

                // align 是枚举
                if (gObject.align !== undefined) {
                    const alignEnum = this.getAlignEnum();
                    addProp('align', gObject.align, 'enum', true, { options: alignEnum });
                }

                addProp('lineGap', gObject.lineGap, 'number');
                addProp('columnGap', gObject.columnGap, 'number');
                addProp('defaultItem', gObject.defaultItem, 'string', false);
            } catch (e) { }
        },

        /**
         * 添加进度条属性
         */
        addProgressBarProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable });
                }
            };

            try {
                addProp('value', gObject.value, 'number');
                addProp('min', gObject.min, 'number');
                addProp('max', gObject.max, 'number');
                addProp('title', gObject.title, 'string');
            } catch (e) { }
        },

        /**
         * 添加滑块属性
         */
        addSliderProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable });
                }
            };

            try {
                addProp('value', gObject.value, 'number');
                addProp('min', gObject.min, 'number');
                addProp('max', gObject.max, 'number');
                addProp('title', gObject.title, 'string');
                addProp('wholeNumbers', gObject.wholeNumbers, 'boolean');
            } catch (e) { }
        },

        /**
         * 添加下拉框属性
         */
        addComboBoxProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable });
                }
            };

            try {
                addProp('text', gObject.text, 'string');
                addProp('selectedIndex', gObject.selectedIndex, 'number');
                addProp('visibleItemCount', gObject.visibleItemCount, 'number');
                addProp('popupDirection', gObject.popupDirection, 'number');
            } catch (e) { }
        },

        /**
         * 添加加载器属性
         */
        addLoaderProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                addProp('url', gObject.url, 'string');
                addProp('icon', gObject.icon, 'string');

                // align 是枚举
                if (gObject.align !== undefined) {
                    const alignEnum = this.getAlignEnum();
                    addProp('align', gObject.align, 'enum', true, { options: alignEnum });
                }

                // valign 是枚举
                if (gObject.valign !== undefined) {
                    const valignEnum = this.getValignEnum();
                    addProp('valign', gObject.valign, 'enum', true, { options: valignEnum });
                }

                // fill 是枚举
                if (gObject.fill !== undefined) {
                    const fillEnum = this.getLoaderFillEnum();
                    addProp('fill', gObject.fill, 'enum', true, { options: fillEnum });
                }

                addProp('shrinkOnly', gObject.shrinkOnly, 'boolean');
                addProp('playing', gObject.playing, 'boolean');
                addProp('frame', gObject.frame, 'number');
            } catch (e) { }
        },

        /**
         * 添加分组属性
         */
        addGroupProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true, extra = {}) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable, ...extra });
                }
            };

            try {
                // layout 是枚举
                if (gObject.layout !== undefined) {
                    const layoutEnum = this.getGroupLayoutEnum();
                    addProp('layout', gObject.layout, 'enum', true, { options: layoutEnum });
                }

                addProp('lineGap', gObject.lineGap, 'number');
                addProp('columnGap', gObject.columnGap, 'number');
                addProp('excludeInvisibles', gObject.excludeInvisibles, 'boolean');
                addProp('autoSizeDisabled', gObject.autoSizeDisabled, 'boolean');
            } catch (e) { }
        },

        /**
         * 类型判断辅助方法 - 使用 instanceof 检测
         */
        isTextObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return (fguiModule.GTextField && gObject instanceof fguiModule.GTextField) ||
                (fguiModule.GRichTextField && gObject instanceof fguiModule.GRichTextField) ||
                (fguiModule.GTextInput && gObject instanceof fguiModule.GTextInput);
        },

        isButtonObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return (fguiModule.GButton && gObject instanceof fguiModule.GButton) ||
                (fguiModule.GLabel && gObject instanceof fguiModule.GLabel);
        },

        isImageObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return (fguiModule.GImage && gObject instanceof fguiModule.GImage) ||
                (fguiModule.GGraph && gObject instanceof fguiModule.GGraph);
        },

        isListObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return (fguiModule.GList && gObject instanceof fguiModule.GList) ||
                (fguiModule.GTree && gObject instanceof fguiModule.GTree);
        },

        isProgressBarObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return fguiModule.GProgressBar && gObject instanceof fguiModule.GProgressBar;
        },

        isSliderObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return fguiModule.GSlider && gObject instanceof fguiModule.GSlider;
        },

        isComboBoxObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return fguiModule.GComboBox && gObject instanceof fguiModule.GComboBox;
        },

        isLoaderObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return (fguiModule.GLoader && gObject instanceof fguiModule.GLoader) ||
                (fguiModule.GLoader3D && gObject instanceof fguiModule.GLoader3D);
        },

        isGroupObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return fguiModule.GGroup && gObject instanceof fguiModule.GGroup;
        },

        isComponentObject(gObject) {
            if (!gObject) return false;
            const fguiModule = this.getFGUIModule();
            if (!fguiModule) return false;

            return fguiModule.GComponent && gObject instanceof fguiModule.GComponent;
        },

        /**
         * 添加 GComponent 特定属性
         */
        addComponentProps(gObject, propsGroup) {
            const addProp = (name, value, type, editable = true) => {
                if (value !== undefined && value !== null) {
                    propsGroup.properties.push({ name, value, type, editable });
                }
            };

            try {
                // GComponent 特有属性
                if (gObject.opaque !== undefined) {
                    addProp('opaque', gObject.opaque, 'boolean');
                }
                if (gObject.mask !== undefined && gObject.mask !== null) {
                    addProp('mask', gObject.mask.name || 'Mask', 'string', false);
                }
                if (gObject.hitArea !== undefined && gObject.hitArea !== null) {
                    addProp('hitArea', 'Custom Hit Area', 'string', false);
                }
                if (gObject.focusable !== undefined) {
                    addProp('focusable', gObject.focusable, 'boolean');
                }
                if (gObject.tabIndex !== undefined) {
                    addProp('tabIndex', gObject.tabIndex, 'number');
                }
            } catch (e) { }
        },

        /**
         * 设置 GObject 属性
         */
        setGObjectProp(gObject, prop, value) {
            if (!gObject || !prop) return false;

            try {
                // 先检查属性是否存在，以及它的类型
                const existingValue = gObject[prop];
                const existingType = typeof existingValue;

                let v = value;

                // 根据现有属性的类型进行智能转换
                if (existingType === 'boolean') {
                    v = (value === 'true' || value === true);
                } else if (existingType === 'number' || existingType === 'enum') {
                    // 枚举类型和数字类型都转换为数字
                    v = Number(value);
                    if (isNaN(v)) {
                        console.warn('[CC Inspector] 无效的数字值:', value, 'for prop:', prop);
                        return false;
                    }
                } else if (existingType === 'string') {
                    // 字符串类型，保持原值
                    v = String(value);
                } else if (value === 'true') {
                    v = true;
                } else if (value === 'false') {
                    v = false;
                } else if (value === '' || value === null || value === undefined) {
                    v = null;
                } else if (!isNaN(Number(value)) && value !== '') {
                    // 如果原属性不存在或为 undefined，尝试转换为数字
                    v = Number(value);
                }

                // 检查属性是否存在且可写
                if (prop in gObject) {
                    const descriptor = Object.getOwnPropertyDescriptor(gObject, prop);
                    if (descriptor && descriptor.set) {
                        // 有 setter，直接赋值
                        gObject[prop] = v;
                        return true;
                    } else if (!descriptor || descriptor.writable) {
                        // 普通属性
                        gObject[prop] = v;
                        return true;
                    }
                }

                // 尝试调用 setter 方法
                const setterName = 'set' + prop.charAt(0).toUpperCase() + prop.slice(1);
                if (typeof gObject[setterName] === 'function') {
                    gObject[setterName](v);
                    return true;
                }

                console.warn('[CC Inspector] 属性', prop, '在', gObject.constructor.name, '上不存在或不可写');
            } catch (e) {
                console.error('[CC Inspector] 设置 FairyGUI 属性失败:', e, 'prop:', prop, 'value:', value);
            }

            return false;
        },

        /**
         * 工具方法：颜色转字符串
         */
        colorToString(color) {
            if (!color) return '';
            if (typeof color === 'string') return color;
            if (typeof color === 'number') {
                return '#' + color.toString(16).padStart(6, '0').toUpperCase();
            }
            return String(color);
        },

        /**
         * 获取对齐方式枚举
         */
        getAlignEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.AlignType) {
                const AlignType = fguiModule.AlignType;
                return [
                    { label: 'Left', value: AlignType.Left },
                    { label: 'Center', value: AlignType.Center },
                    { label: 'Right', value: AlignType.Right }
                ];
            }
            return [
                { label: 'Left', value: 0 },
                { label: 'Center', value: 1 },
                { label: 'Right', value: 2 }
            ];
        },

        /**
         * 获取垂直对齐方式枚举
         */
        getValignEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.VertAlignType) {
                const VertAlignType = fguiModule.VertAlignType;
                return [
                    { label: 'Top', value: VertAlignType.Top },
                    { label: 'Middle', value: VertAlignType.Middle },
                    { label: 'Bottom', value: VertAlignType.Bottom }
                ];
            }
            return [
                { label: 'Top', value: 0 },
                { label: 'Middle', value: 1 },
                { label: 'Bottom', value: 2 }
            ];
        },

        /**
         * 获取自动大小枚举
         */
        getAutoSizeEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.AutoSizeType) {
                const AutoSizeType = fguiModule.AutoSizeType;
                return [
                    { label: 'None', value: AutoSizeType.None },
                    { label: 'Both', value: AutoSizeType.Both },
                    { label: 'Height', value: AutoSizeType.Height },
                    { label: 'Shrink', value: AutoSizeType.Shrink }
                ];
            }
            return [
                { label: 'None', value: 0 },
                { label: 'Both', value: 1 },
                { label: 'Height', value: 2 },
                { label: 'Shrink', value: 3 }
            ];
        },

        /**
         * 获取填充方式枚举
         */
        getFillMethodEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.FillMethod) {
                const FillMethod = fguiModule.FillMethod;
                return [
                    { label: 'None', value: FillMethod.None },
                    { label: 'Horizontal', value: FillMethod.Horizontal },
                    { label: 'Vertical', value: FillMethod.Vertical },
                    { label: 'Radial 90', value: FillMethod.Radial90 },
                    { label: 'Radial 180', value: FillMethod.Radial180 },
                    { label: 'Radial 360', value: FillMethod.Radial360 }
                ];
            }
            return [
                { label: 'None', value: 0 },
                { label: 'Horizontal', value: 1 },
                { label: 'Vertical', value: 2 },
                { label: 'Radial 90', value: 3 },
                { label: 'Radial 180', value: 4 },
                { label: 'Radial 360', value: 5 }
            ];
        },

        /**
         * 获取翻转载枚举
         */
        getFlipEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.FlipType) {
                const FlipType = fguiModule.FlipType;
                return [
                    { label: 'None', value: FlipType.None },
                    { label: 'Horizontal', value: FlipType.Horizontal },
                    { label: 'Vertical', value: FlipType.Vertical },
                    { label: 'Both', value: FlipType.Both }
                ];
            }
            return [
                { label: 'None', value: 0 },
                { label: 'Horizontal', value: 1 },
                { label: 'Vertical', value: 2 },
                { label: 'Both', value: 3 }
            ];
        },

        /**
         * 获取布局枚举
         */
        getLayoutEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.ListLayoutType) {
                const ListLayoutType = fguiModule.ListLayoutType;
                return [
                    { label: 'None', value: ListLayoutType.None },
                    { label: 'Single Column', value: ListLayoutType.SingleColumn },
                    { label: 'Single Row', value: ListLayoutType.SingleRow },
                    { label: 'Flow Horizontal', value: ListLayoutType.FlowHorizontal },
                    { label: 'Flow Vertical', value: ListLayoutType.FlowVertical },
                    { label: 'Pagination Horizontal', value: ListLayoutType.PaginationHorizontal },
                    { label: 'Pagination Vertical', value: ListLayoutType.PaginationVertical }
                ];
            }
            return [
                { label: 'None', value: 0 },
                { label: 'Single Column', value: 1 },
                { label: 'Single Row', value: 2 },
                { label: 'Flow Horizontal', value: 3 },
                { label: 'Flow Vertical', value: 4 },
                { label: 'Pagination Horizontal', value: 5 },
                { label: 'Pagination Vertical', value: 6 }
            ];
        },

        /**
         * 获取选择模式枚举
         */
        getSelectionModeEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.ListSelectionMode) {
                const ListSelectionMode = fguiModule.ListSelectionMode;
                return [
                    { label: 'Single', value: ListSelectionMode.Single },
                    { label: 'Multiple', value: ListSelectionMode.Multiple },
                    { label: 'Multiple Single Click', value: ListSelectionMode.MultipleSingleClick },
                    { label: 'None', value: ListSelectionMode.None }
                ];
            }
            return [
                { label: 'Single', value: 0 },
                { label: 'Multiple', value: 1 },
                { label: 'Multiple Single Click', value: 2 },
                { label: 'None', value: 3 }
            ];
        },

        /**
         * 获取加载器填充枚举
         */
        getLoaderFillEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.LoaderFillType) {
                const LoaderFillType = fguiModule.LoaderFillType;
                return [
                    { label: 'Scale Free', value: LoaderFillType.ScaleFree },
                    { label: 'Scale Match Width', value: LoaderFillType.ScaleMatchWidth },
                    { label: 'Scale Match Height', value: LoaderFillType.ScaleMatchHeight },
                    { label: 'Scale Match Size', value: LoaderFillType.ScaleMatchSize },
                    { label: 'Scale No Border', value: LoaderFillType.ScaleNoBorder },
                    { label: 'Scale No Bg', value: LoaderFillType.ScaleNoBg }
                ];
            }
            return [
                { label: 'Scale Free', value: 0 },
                { label: 'Scale Match Width', value: 1 },
                { label: 'Scale Match Height', value: 2 },
                { label: 'Scale Match Size', value: 3 },
                { label: 'Scale No Border', value: 4 },
                { label: 'Scale No Bg', value: 5 }
            ];
        },

        /**
         * 获取分组布局枚举
         */
        getGroupLayoutEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.GroupLayoutType) {
                const GroupLayoutType = fguiModule.GroupLayoutType;
                return [
                    { label: 'None', value: GroupLayoutType.None },
                    { label: 'Horizontal', value: GroupLayoutType.Horizontal },
                    { label: 'Vertical', value: GroupLayoutType.Vertical }
                ];
            }
            return [
                { label: 'None', value: 0 },
                { label: 'Horizontal', value: 1 },
                { label: 'Vertical', value: 2 }
            ];
        },

        /**
         * 获取混合模式枚举
         */
        getBlendModeEnum() {
            const fguiModule = this.getFGUIModule();
            if (fguiModule && fguiModule.BlendMode) {
                const BlendMode = fguiModule.BlendMode;
                return [
                    { label: 'Normal', value: BlendMode.Normal },
                    { label: 'Add', value: BlendMode.Add },
                    { label: 'Multiply', value: BlendMode.Multiply },
                    { label: 'Screen', value: BlendMode.Screen }
                ];
            }
            return [
                { label: 'Normal', value: 0 },
                { label: 'Add', value: 1 },
                { label: 'Multiply', value: 2 },
                { label: 'Screen', value: 3 }
            ];
        }
    };

    window.__CCInspector.fairygui = FairyGUI;
    console.log('[CC Inspector] FairyGUI 模块已加载');
})();