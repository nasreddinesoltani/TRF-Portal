(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // src/pages/BeachSprintCompetition.jsx
  var import_react5 = __toESM(__require("react"), 1);
  var import_react_router_dom = __require("react-router-dom");
  var import_react_toastify = __require("react-toastify");

  // src/contexts/AuthContext.jsx
  var import_react = __toESM(__require("react"), 1);
  var AuthContext = (0, import_react.createContext)();
  var useAuth = () => {
    const context = (0, import_react.useContext)(AuthContext);
    if (!context) {
      throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
  };

  // src/components/ui/button.jsx
  var React2 = __toESM(__require("react"), 1);

  // node_modules/clsx/dist/clsx.mjs
  function r(e) {
    var t, f, n = "";
    if ("string" == typeof e || "number" == typeof e) n += e;
    else if ("object" == typeof e) if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
    } else for (f in e) e[f] && (n && (n += " "), n += f);
    return n;
  }
  function clsx() {
    for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
    return n;
  }

  // node_modules/tailwind-merge/dist/bundle-mjs.mjs
  var CLASS_PART_SEPARATOR = "-";
  var createClassGroupUtils = (config) => {
    const classMap = createClassMap(config);
    const {
      conflictingClassGroups,
      conflictingClassGroupModifiers
    } = config;
    const getClassGroupId = (className) => {
      const classParts = className.split(CLASS_PART_SEPARATOR);
      if (classParts[0] === "" && classParts.length !== 1) {
        classParts.shift();
      }
      return getGroupRecursive(classParts, classMap) || getGroupIdForArbitraryProperty(className);
    };
    const getConflictingClassGroupIds = (classGroupId, hasPostfixModifier) => {
      const conflicts = conflictingClassGroups[classGroupId] || [];
      if (hasPostfixModifier && conflictingClassGroupModifiers[classGroupId]) {
        return [...conflicts, ...conflictingClassGroupModifiers[classGroupId]];
      }
      return conflicts;
    };
    return {
      getClassGroupId,
      getConflictingClassGroupIds
    };
  };
  var getGroupRecursive = (classParts, classPartObject) => {
    if (classParts.length === 0) {
      return classPartObject.classGroupId;
    }
    const currentClassPart = classParts[0];
    const nextClassPartObject = classPartObject.nextPart.get(currentClassPart);
    const classGroupFromNextClassPart = nextClassPartObject ? getGroupRecursive(classParts.slice(1), nextClassPartObject) : void 0;
    if (classGroupFromNextClassPart) {
      return classGroupFromNextClassPart;
    }
    if (classPartObject.validators.length === 0) {
      return void 0;
    }
    const classRest = classParts.join(CLASS_PART_SEPARATOR);
    return classPartObject.validators.find(({
      validator
    }) => validator(classRest))?.classGroupId;
  };
  var arbitraryPropertyRegex = /^\[(.+)\]$/;
  var getGroupIdForArbitraryProperty = (className) => {
    if (arbitraryPropertyRegex.test(className)) {
      const arbitraryPropertyClassName = arbitraryPropertyRegex.exec(className)[1];
      const property = arbitraryPropertyClassName?.substring(0, arbitraryPropertyClassName.indexOf(":"));
      if (property) {
        return "arbitrary.." + property;
      }
    }
  };
  var createClassMap = (config) => {
    const {
      theme,
      prefix
    } = config;
    const classMap = {
      nextPart: /* @__PURE__ */ new Map(),
      validators: []
    };
    const prefixedClassGroupEntries = getPrefixedClassGroupEntries(Object.entries(config.classGroups), prefix);
    prefixedClassGroupEntries.forEach(([classGroupId, classGroup]) => {
      processClassesRecursively(classGroup, classMap, classGroupId, theme);
    });
    return classMap;
  };
  var processClassesRecursively = (classGroup, classPartObject, classGroupId, theme) => {
    classGroup.forEach((classDefinition) => {
      if (typeof classDefinition === "string") {
        const classPartObjectToEdit = classDefinition === "" ? classPartObject : getPart(classPartObject, classDefinition);
        classPartObjectToEdit.classGroupId = classGroupId;
        return;
      }
      if (typeof classDefinition === "function") {
        if (isThemeGetter(classDefinition)) {
          processClassesRecursively(classDefinition(theme), classPartObject, classGroupId, theme);
          return;
        }
        classPartObject.validators.push({
          validator: classDefinition,
          classGroupId
        });
        return;
      }
      Object.entries(classDefinition).forEach(([key, classGroup2]) => {
        processClassesRecursively(classGroup2, getPart(classPartObject, key), classGroupId, theme);
      });
    });
  };
  var getPart = (classPartObject, path) => {
    let currentClassPartObject = classPartObject;
    path.split(CLASS_PART_SEPARATOR).forEach((pathPart) => {
      if (!currentClassPartObject.nextPart.has(pathPart)) {
        currentClassPartObject.nextPart.set(pathPart, {
          nextPart: /* @__PURE__ */ new Map(),
          validators: []
        });
      }
      currentClassPartObject = currentClassPartObject.nextPart.get(pathPart);
    });
    return currentClassPartObject;
  };
  var isThemeGetter = (func) => func.isThemeGetter;
  var getPrefixedClassGroupEntries = (classGroupEntries, prefix) => {
    if (!prefix) {
      return classGroupEntries;
    }
    return classGroupEntries.map(([classGroupId, classGroup]) => {
      const prefixedClassGroup = classGroup.map((classDefinition) => {
        if (typeof classDefinition === "string") {
          return prefix + classDefinition;
        }
        if (typeof classDefinition === "object") {
          return Object.fromEntries(Object.entries(classDefinition).map(([key, value]) => [prefix + key, value]));
        }
        return classDefinition;
      });
      return [classGroupId, prefixedClassGroup];
    });
  };
  var createLruCache = (maxCacheSize) => {
    if (maxCacheSize < 1) {
      return {
        get: () => void 0,
        set: () => {
        }
      };
    }
    let cacheSize = 0;
    let cache = /* @__PURE__ */ new Map();
    let previousCache = /* @__PURE__ */ new Map();
    const update = (key, value) => {
      cache.set(key, value);
      cacheSize++;
      if (cacheSize > maxCacheSize) {
        cacheSize = 0;
        previousCache = cache;
        cache = /* @__PURE__ */ new Map();
      }
    };
    return {
      get(key) {
        let value = cache.get(key);
        if (value !== void 0) {
          return value;
        }
        if ((value = previousCache.get(key)) !== void 0) {
          update(key, value);
          return value;
        }
      },
      set(key, value) {
        if (cache.has(key)) {
          cache.set(key, value);
        } else {
          update(key, value);
        }
      }
    };
  };
  var IMPORTANT_MODIFIER = "!";
  var createParseClassName = (config) => {
    const {
      separator,
      experimentalParseClassName
    } = config;
    const isSeparatorSingleCharacter = separator.length === 1;
    const firstSeparatorCharacter = separator[0];
    const separatorLength = separator.length;
    const parseClassName = (className) => {
      const modifiers = [];
      let bracketDepth = 0;
      let modifierStart = 0;
      let postfixModifierPosition;
      for (let index = 0; index < className.length; index++) {
        let currentCharacter = className[index];
        if (bracketDepth === 0) {
          if (currentCharacter === firstSeparatorCharacter && (isSeparatorSingleCharacter || className.slice(index, index + separatorLength) === separator)) {
            modifiers.push(className.slice(modifierStart, index));
            modifierStart = index + separatorLength;
            continue;
          }
          if (currentCharacter === "/") {
            postfixModifierPosition = index;
            continue;
          }
        }
        if (currentCharacter === "[") {
          bracketDepth++;
        } else if (currentCharacter === "]") {
          bracketDepth--;
        }
      }
      const baseClassNameWithImportantModifier = modifiers.length === 0 ? className : className.substring(modifierStart);
      const hasImportantModifier = baseClassNameWithImportantModifier.startsWith(IMPORTANT_MODIFIER);
      const baseClassName = hasImportantModifier ? baseClassNameWithImportantModifier.substring(1) : baseClassNameWithImportantModifier;
      const maybePostfixModifierPosition = postfixModifierPosition && postfixModifierPosition > modifierStart ? postfixModifierPosition - modifierStart : void 0;
      return {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      };
    };
    if (experimentalParseClassName) {
      return (className) => experimentalParseClassName({
        className,
        parseClassName
      });
    }
    return parseClassName;
  };
  var sortModifiers = (modifiers) => {
    if (modifiers.length <= 1) {
      return modifiers;
    }
    const sortedModifiers = [];
    let unsortedModifiers = [];
    modifiers.forEach((modifier) => {
      const isArbitraryVariant = modifier[0] === "[";
      if (isArbitraryVariant) {
        sortedModifiers.push(...unsortedModifiers.sort(), modifier);
        unsortedModifiers = [];
      } else {
        unsortedModifiers.push(modifier);
      }
    });
    sortedModifiers.push(...unsortedModifiers.sort());
    return sortedModifiers;
  };
  var createConfigUtils = (config) => ({
    cache: createLruCache(config.cacheSize),
    parseClassName: createParseClassName(config),
    ...createClassGroupUtils(config)
  });
  var SPLIT_CLASSES_REGEX = /\s+/;
  var mergeClassList = (classList, configUtils) => {
    const {
      parseClassName,
      getClassGroupId,
      getConflictingClassGroupIds
    } = configUtils;
    const classGroupsInConflict = [];
    const classNames = classList.trim().split(SPLIT_CLASSES_REGEX);
    let result = "";
    for (let index = classNames.length - 1; index >= 0; index -= 1) {
      const originalClassName = classNames[index];
      const {
        modifiers,
        hasImportantModifier,
        baseClassName,
        maybePostfixModifierPosition
      } = parseClassName(originalClassName);
      let hasPostfixModifier = Boolean(maybePostfixModifierPosition);
      let classGroupId = getClassGroupId(hasPostfixModifier ? baseClassName.substring(0, maybePostfixModifierPosition) : baseClassName);
      if (!classGroupId) {
        if (!hasPostfixModifier) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        classGroupId = getClassGroupId(baseClassName);
        if (!classGroupId) {
          result = originalClassName + (result.length > 0 ? " " + result : result);
          continue;
        }
        hasPostfixModifier = false;
      }
      const variantModifier = sortModifiers(modifiers).join(":");
      const modifierId = hasImportantModifier ? variantModifier + IMPORTANT_MODIFIER : variantModifier;
      const classId = modifierId + classGroupId;
      if (classGroupsInConflict.includes(classId)) {
        continue;
      }
      classGroupsInConflict.push(classId);
      const conflictGroups = getConflictingClassGroupIds(classGroupId, hasPostfixModifier);
      for (let i = 0; i < conflictGroups.length; ++i) {
        const group = conflictGroups[i];
        classGroupsInConflict.push(modifierId + group);
      }
      result = originalClassName + (result.length > 0 ? " " + result : result);
    }
    return result;
  };
  function twJoin() {
    let index = 0;
    let argument;
    let resolvedValue;
    let string = "";
    while (index < arguments.length) {
      if (argument = arguments[index++]) {
        if (resolvedValue = toValue(argument)) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  }
  var toValue = (mix) => {
    if (typeof mix === "string") {
      return mix;
    }
    let resolvedValue;
    let string = "";
    for (let k = 0; k < mix.length; k++) {
      if (mix[k]) {
        if (resolvedValue = toValue(mix[k])) {
          string && (string += " ");
          string += resolvedValue;
        }
      }
    }
    return string;
  };
  function createTailwindMerge(createConfigFirst, ...createConfigRest) {
    let configUtils;
    let cacheGet;
    let cacheSet;
    let functionToCall = initTailwindMerge;
    function initTailwindMerge(classList) {
      const config = createConfigRest.reduce((previousConfig, createConfigCurrent) => createConfigCurrent(previousConfig), createConfigFirst());
      configUtils = createConfigUtils(config);
      cacheGet = configUtils.cache.get;
      cacheSet = configUtils.cache.set;
      functionToCall = tailwindMerge;
      return tailwindMerge(classList);
    }
    function tailwindMerge(classList) {
      const cachedResult = cacheGet(classList);
      if (cachedResult) {
        return cachedResult;
      }
      const result = mergeClassList(classList, configUtils);
      cacheSet(classList, result);
      return result;
    }
    return function callTailwindMerge() {
      return functionToCall(twJoin.apply(null, arguments));
    };
  }
  var fromTheme = (key) => {
    const themeGetter = (theme) => theme[key] || [];
    themeGetter.isThemeGetter = true;
    return themeGetter;
  };
  var arbitraryValueRegex = /^\[(?:([a-z-]+):)?(.+)\]$/i;
  var fractionRegex = /^\d+\/\d+$/;
  var stringLengths = /* @__PURE__ */ new Set(["px", "full", "screen"]);
  var tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  var lengthUnitRegex = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  var colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/;
  var shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  var imageRegex = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  var isLength = (value) => isNumber(value) || stringLengths.has(value) || fractionRegex.test(value);
  var isArbitraryLength = (value) => getIsArbitraryValue(value, "length", isLengthOnly);
  var isNumber = (value) => Boolean(value) && !Number.isNaN(Number(value));
  var isArbitraryNumber = (value) => getIsArbitraryValue(value, "number", isNumber);
  var isInteger = (value) => Boolean(value) && Number.isInteger(Number(value));
  var isPercent = (value) => value.endsWith("%") && isNumber(value.slice(0, -1));
  var isArbitraryValue = (value) => arbitraryValueRegex.test(value);
  var isTshirtSize = (value) => tshirtUnitRegex.test(value);
  var sizeLabels = /* @__PURE__ */ new Set(["length", "size", "percentage"]);
  var isArbitrarySize = (value) => getIsArbitraryValue(value, sizeLabels, isNever);
  var isArbitraryPosition = (value) => getIsArbitraryValue(value, "position", isNever);
  var imageLabels = /* @__PURE__ */ new Set(["image", "url"]);
  var isArbitraryImage = (value) => getIsArbitraryValue(value, imageLabels, isImage);
  var isArbitraryShadow = (value) => getIsArbitraryValue(value, "", isShadow);
  var isAny = () => true;
  var getIsArbitraryValue = (value, label, testValue) => {
    const result = arbitraryValueRegex.exec(value);
    if (result) {
      if (result[1]) {
        return typeof label === "string" ? result[1] === label : label.has(result[1]);
      }
      return testValue(result[2]);
    }
    return false;
  };
  var isLengthOnly = (value) => (
    // `colorFunctionRegex` check is necessary because color functions can have percentages in them which which would be incorrectly classified as lengths.
    // For example, `hsl(0 0% 0%)` would be classified as a length without this check.
    // I could also use lookbehind assertion in `lengthUnitRegex` but that isn't supported widely enough.
    lengthUnitRegex.test(value) && !colorFunctionRegex.test(value)
  );
  var isNever = () => false;
  var isShadow = (value) => shadowRegex.test(value);
  var isImage = (value) => imageRegex.test(value);
  var getDefaultConfig = () => {
    const colors = fromTheme("colors");
    const spacing = fromTheme("spacing");
    const blur = fromTheme("blur");
    const brightness = fromTheme("brightness");
    const borderColor = fromTheme("borderColor");
    const borderRadius = fromTheme("borderRadius");
    const borderSpacing = fromTheme("borderSpacing");
    const borderWidth = fromTheme("borderWidth");
    const contrast = fromTheme("contrast");
    const grayscale = fromTheme("grayscale");
    const hueRotate = fromTheme("hueRotate");
    const invert = fromTheme("invert");
    const gap = fromTheme("gap");
    const gradientColorStops = fromTheme("gradientColorStops");
    const gradientColorStopPositions = fromTheme("gradientColorStopPositions");
    const inset = fromTheme("inset");
    const margin = fromTheme("margin");
    const opacity = fromTheme("opacity");
    const padding = fromTheme("padding");
    const saturate = fromTheme("saturate");
    const scale = fromTheme("scale");
    const sepia = fromTheme("sepia");
    const skew = fromTheme("skew");
    const space = fromTheme("space");
    const translate = fromTheme("translate");
    const getOverscroll = () => ["auto", "contain", "none"];
    const getOverflow = () => ["auto", "hidden", "clip", "visible", "scroll"];
    const getSpacingWithAutoAndArbitrary = () => ["auto", isArbitraryValue, spacing];
    const getSpacingWithArbitrary = () => [isArbitraryValue, spacing];
    const getLengthWithEmptyAndArbitrary = () => ["", isLength, isArbitraryLength];
    const getNumberWithAutoAndArbitrary = () => ["auto", isNumber, isArbitraryValue];
    const getPositions = () => ["bottom", "center", "left", "left-bottom", "left-top", "right", "right-bottom", "right-top", "top"];
    const getLineStyles = () => ["solid", "dashed", "dotted", "double", "none"];
    const getBlendModes = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    const getAlign = () => ["start", "end", "center", "between", "around", "evenly", "stretch"];
    const getZeroAndEmpty = () => ["", "0", isArbitraryValue];
    const getBreaks = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"];
    const getNumberAndArbitrary = () => [isNumber, isArbitraryValue];
    return {
      cacheSize: 500,
      separator: ":",
      theme: {
        colors: [isAny],
        spacing: [isLength, isArbitraryLength],
        blur: ["none", "", isTshirtSize, isArbitraryValue],
        brightness: getNumberAndArbitrary(),
        borderColor: [colors],
        borderRadius: ["none", "", "full", isTshirtSize, isArbitraryValue],
        borderSpacing: getSpacingWithArbitrary(),
        borderWidth: getLengthWithEmptyAndArbitrary(),
        contrast: getNumberAndArbitrary(),
        grayscale: getZeroAndEmpty(),
        hueRotate: getNumberAndArbitrary(),
        invert: getZeroAndEmpty(),
        gap: getSpacingWithArbitrary(),
        gradientColorStops: [colors],
        gradientColorStopPositions: [isPercent, isArbitraryLength],
        inset: getSpacingWithAutoAndArbitrary(),
        margin: getSpacingWithAutoAndArbitrary(),
        opacity: getNumberAndArbitrary(),
        padding: getSpacingWithArbitrary(),
        saturate: getNumberAndArbitrary(),
        scale: getNumberAndArbitrary(),
        sepia: getZeroAndEmpty(),
        skew: getNumberAndArbitrary(),
        space: getSpacingWithArbitrary(),
        translate: getSpacingWithArbitrary()
      },
      classGroups: {
        // Layout
        /**
         * Aspect Ratio
         * @see https://tailwindcss.com/docs/aspect-ratio
         */
        aspect: [{
          aspect: ["auto", "square", "video", isArbitraryValue]
        }],
        /**
         * Container
         * @see https://tailwindcss.com/docs/container
         */
        container: ["container"],
        /**
         * Columns
         * @see https://tailwindcss.com/docs/columns
         */
        columns: [{
          columns: [isTshirtSize]
        }],
        /**
         * Break After
         * @see https://tailwindcss.com/docs/break-after
         */
        "break-after": [{
          "break-after": getBreaks()
        }],
        /**
         * Break Before
         * @see https://tailwindcss.com/docs/break-before
         */
        "break-before": [{
          "break-before": getBreaks()
        }],
        /**
         * Break Inside
         * @see https://tailwindcss.com/docs/break-inside
         */
        "break-inside": [{
          "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
        }],
        /**
         * Box Decoration Break
         * @see https://tailwindcss.com/docs/box-decoration-break
         */
        "box-decoration": [{
          "box-decoration": ["slice", "clone"]
        }],
        /**
         * Box Sizing
         * @see https://tailwindcss.com/docs/box-sizing
         */
        box: [{
          box: ["border", "content"]
        }],
        /**
         * Display
         * @see https://tailwindcss.com/docs/display
         */
        display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
        /**
         * Floats
         * @see https://tailwindcss.com/docs/float
         */
        float: [{
          float: ["right", "left", "none", "start", "end"]
        }],
        /**
         * Clear
         * @see https://tailwindcss.com/docs/clear
         */
        clear: [{
          clear: ["left", "right", "both", "none", "start", "end"]
        }],
        /**
         * Isolation
         * @see https://tailwindcss.com/docs/isolation
         */
        isolation: ["isolate", "isolation-auto"],
        /**
         * Object Fit
         * @see https://tailwindcss.com/docs/object-fit
         */
        "object-fit": [{
          object: ["contain", "cover", "fill", "none", "scale-down"]
        }],
        /**
         * Object Position
         * @see https://tailwindcss.com/docs/object-position
         */
        "object-position": [{
          object: [...getPositions(), isArbitraryValue]
        }],
        /**
         * Overflow
         * @see https://tailwindcss.com/docs/overflow
         */
        overflow: [{
          overflow: getOverflow()
        }],
        /**
         * Overflow X
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-x": [{
          "overflow-x": getOverflow()
        }],
        /**
         * Overflow Y
         * @see https://tailwindcss.com/docs/overflow
         */
        "overflow-y": [{
          "overflow-y": getOverflow()
        }],
        /**
         * Overscroll Behavior
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        overscroll: [{
          overscroll: getOverscroll()
        }],
        /**
         * Overscroll Behavior X
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-x": [{
          "overscroll-x": getOverscroll()
        }],
        /**
         * Overscroll Behavior Y
         * @see https://tailwindcss.com/docs/overscroll-behavior
         */
        "overscroll-y": [{
          "overscroll-y": getOverscroll()
        }],
        /**
         * Position
         * @see https://tailwindcss.com/docs/position
         */
        position: ["static", "fixed", "absolute", "relative", "sticky"],
        /**
         * Top / Right / Bottom / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        inset: [{
          inset: [inset]
        }],
        /**
         * Right / Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-x": [{
          "inset-x": [inset]
        }],
        /**
         * Top / Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        "inset-y": [{
          "inset-y": [inset]
        }],
        /**
         * Start
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        start: [{
          start: [inset]
        }],
        /**
         * End
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        end: [{
          end: [inset]
        }],
        /**
         * Top
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        top: [{
          top: [inset]
        }],
        /**
         * Right
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        right: [{
          right: [inset]
        }],
        /**
         * Bottom
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        bottom: [{
          bottom: [inset]
        }],
        /**
         * Left
         * @see https://tailwindcss.com/docs/top-right-bottom-left
         */
        left: [{
          left: [inset]
        }],
        /**
         * Visibility
         * @see https://tailwindcss.com/docs/visibility
         */
        visibility: ["visible", "invisible", "collapse"],
        /**
         * Z-Index
         * @see https://tailwindcss.com/docs/z-index
         */
        z: [{
          z: ["auto", isInteger, isArbitraryValue]
        }],
        // Flexbox and Grid
        /**
         * Flex Basis
         * @see https://tailwindcss.com/docs/flex-basis
         */
        basis: [{
          basis: getSpacingWithAutoAndArbitrary()
        }],
        /**
         * Flex Direction
         * @see https://tailwindcss.com/docs/flex-direction
         */
        "flex-direction": [{
          flex: ["row", "row-reverse", "col", "col-reverse"]
        }],
        /**
         * Flex Wrap
         * @see https://tailwindcss.com/docs/flex-wrap
         */
        "flex-wrap": [{
          flex: ["wrap", "wrap-reverse", "nowrap"]
        }],
        /**
         * Flex
         * @see https://tailwindcss.com/docs/flex
         */
        flex: [{
          flex: ["1", "auto", "initial", "none", isArbitraryValue]
        }],
        /**
         * Flex Grow
         * @see https://tailwindcss.com/docs/flex-grow
         */
        grow: [{
          grow: getZeroAndEmpty()
        }],
        /**
         * Flex Shrink
         * @see https://tailwindcss.com/docs/flex-shrink
         */
        shrink: [{
          shrink: getZeroAndEmpty()
        }],
        /**
         * Order
         * @see https://tailwindcss.com/docs/order
         */
        order: [{
          order: ["first", "last", "none", isInteger, isArbitraryValue]
        }],
        /**
         * Grid Template Columns
         * @see https://tailwindcss.com/docs/grid-template-columns
         */
        "grid-cols": [{
          "grid-cols": [isAny]
        }],
        /**
         * Grid Column Start / End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start-end": [{
          col: ["auto", {
            span: ["full", isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Column Start
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-start": [{
          "col-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Column End
         * @see https://tailwindcss.com/docs/grid-column
         */
        "col-end": [{
          "col-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Template Rows
         * @see https://tailwindcss.com/docs/grid-template-rows
         */
        "grid-rows": [{
          "grid-rows": [isAny]
        }],
        /**
         * Grid Row Start / End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start-end": [{
          row: ["auto", {
            span: [isInteger, isArbitraryValue]
          }, isArbitraryValue]
        }],
        /**
         * Grid Row Start
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-start": [{
          "row-start": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Row End
         * @see https://tailwindcss.com/docs/grid-row
         */
        "row-end": [{
          "row-end": getNumberWithAutoAndArbitrary()
        }],
        /**
         * Grid Auto Flow
         * @see https://tailwindcss.com/docs/grid-auto-flow
         */
        "grid-flow": [{
          "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
        }],
        /**
         * Grid Auto Columns
         * @see https://tailwindcss.com/docs/grid-auto-columns
         */
        "auto-cols": [{
          "auto-cols": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Grid Auto Rows
         * @see https://tailwindcss.com/docs/grid-auto-rows
         */
        "auto-rows": [{
          "auto-rows": ["auto", "min", "max", "fr", isArbitraryValue]
        }],
        /**
         * Gap
         * @see https://tailwindcss.com/docs/gap
         */
        gap: [{
          gap: [gap]
        }],
        /**
         * Gap X
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-x": [{
          "gap-x": [gap]
        }],
        /**
         * Gap Y
         * @see https://tailwindcss.com/docs/gap
         */
        "gap-y": [{
          "gap-y": [gap]
        }],
        /**
         * Justify Content
         * @see https://tailwindcss.com/docs/justify-content
         */
        "justify-content": [{
          justify: ["normal", ...getAlign()]
        }],
        /**
         * Justify Items
         * @see https://tailwindcss.com/docs/justify-items
         */
        "justify-items": [{
          "justify-items": ["start", "end", "center", "stretch"]
        }],
        /**
         * Justify Self
         * @see https://tailwindcss.com/docs/justify-self
         */
        "justify-self": [{
          "justify-self": ["auto", "start", "end", "center", "stretch"]
        }],
        /**
         * Align Content
         * @see https://tailwindcss.com/docs/align-content
         */
        "align-content": [{
          content: ["normal", ...getAlign(), "baseline"]
        }],
        /**
         * Align Items
         * @see https://tailwindcss.com/docs/align-items
         */
        "align-items": [{
          items: ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Align Self
         * @see https://tailwindcss.com/docs/align-self
         */
        "align-self": [{
          self: ["auto", "start", "end", "center", "stretch", "baseline"]
        }],
        /**
         * Place Content
         * @see https://tailwindcss.com/docs/place-content
         */
        "place-content": [{
          "place-content": [...getAlign(), "baseline"]
        }],
        /**
         * Place Items
         * @see https://tailwindcss.com/docs/place-items
         */
        "place-items": [{
          "place-items": ["start", "end", "center", "baseline", "stretch"]
        }],
        /**
         * Place Self
         * @see https://tailwindcss.com/docs/place-self
         */
        "place-self": [{
          "place-self": ["auto", "start", "end", "center", "stretch"]
        }],
        // Spacing
        /**
         * Padding
         * @see https://tailwindcss.com/docs/padding
         */
        p: [{
          p: [padding]
        }],
        /**
         * Padding X
         * @see https://tailwindcss.com/docs/padding
         */
        px: [{
          px: [padding]
        }],
        /**
         * Padding Y
         * @see https://tailwindcss.com/docs/padding
         */
        py: [{
          py: [padding]
        }],
        /**
         * Padding Start
         * @see https://tailwindcss.com/docs/padding
         */
        ps: [{
          ps: [padding]
        }],
        /**
         * Padding End
         * @see https://tailwindcss.com/docs/padding
         */
        pe: [{
          pe: [padding]
        }],
        /**
         * Padding Top
         * @see https://tailwindcss.com/docs/padding
         */
        pt: [{
          pt: [padding]
        }],
        /**
         * Padding Right
         * @see https://tailwindcss.com/docs/padding
         */
        pr: [{
          pr: [padding]
        }],
        /**
         * Padding Bottom
         * @see https://tailwindcss.com/docs/padding
         */
        pb: [{
          pb: [padding]
        }],
        /**
         * Padding Left
         * @see https://tailwindcss.com/docs/padding
         */
        pl: [{
          pl: [padding]
        }],
        /**
         * Margin
         * @see https://tailwindcss.com/docs/margin
         */
        m: [{
          m: [margin]
        }],
        /**
         * Margin X
         * @see https://tailwindcss.com/docs/margin
         */
        mx: [{
          mx: [margin]
        }],
        /**
         * Margin Y
         * @see https://tailwindcss.com/docs/margin
         */
        my: [{
          my: [margin]
        }],
        /**
         * Margin Start
         * @see https://tailwindcss.com/docs/margin
         */
        ms: [{
          ms: [margin]
        }],
        /**
         * Margin End
         * @see https://tailwindcss.com/docs/margin
         */
        me: [{
          me: [margin]
        }],
        /**
         * Margin Top
         * @see https://tailwindcss.com/docs/margin
         */
        mt: [{
          mt: [margin]
        }],
        /**
         * Margin Right
         * @see https://tailwindcss.com/docs/margin
         */
        mr: [{
          mr: [margin]
        }],
        /**
         * Margin Bottom
         * @see https://tailwindcss.com/docs/margin
         */
        mb: [{
          mb: [margin]
        }],
        /**
         * Margin Left
         * @see https://tailwindcss.com/docs/margin
         */
        ml: [{
          ml: [margin]
        }],
        /**
         * Space Between X
         * @see https://tailwindcss.com/docs/space
         */
        "space-x": [{
          "space-x": [space]
        }],
        /**
         * Space Between X Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-x-reverse": ["space-x-reverse"],
        /**
         * Space Between Y
         * @see https://tailwindcss.com/docs/space
         */
        "space-y": [{
          "space-y": [space]
        }],
        /**
         * Space Between Y Reverse
         * @see https://tailwindcss.com/docs/space
         */
        "space-y-reverse": ["space-y-reverse"],
        // Sizing
        /**
         * Width
         * @see https://tailwindcss.com/docs/width
         */
        w: [{
          w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", isArbitraryValue, spacing]
        }],
        /**
         * Min-Width
         * @see https://tailwindcss.com/docs/min-width
         */
        "min-w": [{
          "min-w": [isArbitraryValue, spacing, "min", "max", "fit"]
        }],
        /**
         * Max-Width
         * @see https://tailwindcss.com/docs/max-width
         */
        "max-w": [{
          "max-w": [isArbitraryValue, spacing, "none", "full", "min", "max", "fit", "prose", {
            screen: [isTshirtSize]
          }, isTshirtSize]
        }],
        /**
         * Height
         * @see https://tailwindcss.com/docs/height
         */
        h: [{
          h: [isArbitraryValue, spacing, "auto", "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Min-Height
         * @see https://tailwindcss.com/docs/min-height
         */
        "min-h": [{
          "min-h": [isArbitraryValue, spacing, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Max-Height
         * @see https://tailwindcss.com/docs/max-height
         */
        "max-h": [{
          "max-h": [isArbitraryValue, spacing, "min", "max", "fit", "svh", "lvh", "dvh"]
        }],
        /**
         * Size
         * @see https://tailwindcss.com/docs/size
         */
        size: [{
          size: [isArbitraryValue, spacing, "auto", "min", "max", "fit"]
        }],
        // Typography
        /**
         * Font Size
         * @see https://tailwindcss.com/docs/font-size
         */
        "font-size": [{
          text: ["base", isTshirtSize, isArbitraryLength]
        }],
        /**
         * Font Smoothing
         * @see https://tailwindcss.com/docs/font-smoothing
         */
        "font-smoothing": ["antialiased", "subpixel-antialiased"],
        /**
         * Font Style
         * @see https://tailwindcss.com/docs/font-style
         */
        "font-style": ["italic", "not-italic"],
        /**
         * Font Weight
         * @see https://tailwindcss.com/docs/font-weight
         */
        "font-weight": [{
          font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black", isArbitraryNumber]
        }],
        /**
         * Font Family
         * @see https://tailwindcss.com/docs/font-family
         */
        "font-family": [{
          font: [isAny]
        }],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-normal": ["normal-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-ordinal": ["ordinal"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-slashed-zero": ["slashed-zero"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-figure": ["lining-nums", "oldstyle-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-spacing": ["proportional-nums", "tabular-nums"],
        /**
         * Font Variant Numeric
         * @see https://tailwindcss.com/docs/font-variant-numeric
         */
        "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
        /**
         * Letter Spacing
         * @see https://tailwindcss.com/docs/letter-spacing
         */
        tracking: [{
          tracking: ["tighter", "tight", "normal", "wide", "wider", "widest", isArbitraryValue]
        }],
        /**
         * Line Clamp
         * @see https://tailwindcss.com/docs/line-clamp
         */
        "line-clamp": [{
          "line-clamp": ["none", isNumber, isArbitraryNumber]
        }],
        /**
         * Line Height
         * @see https://tailwindcss.com/docs/line-height
         */
        leading: [{
          leading: ["none", "tight", "snug", "normal", "relaxed", "loose", isLength, isArbitraryValue]
        }],
        /**
         * List Style Image
         * @see https://tailwindcss.com/docs/list-style-image
         */
        "list-image": [{
          "list-image": ["none", isArbitraryValue]
        }],
        /**
         * List Style Type
         * @see https://tailwindcss.com/docs/list-style-type
         */
        "list-style-type": [{
          list: ["none", "disc", "decimal", isArbitraryValue]
        }],
        /**
         * List Style Position
         * @see https://tailwindcss.com/docs/list-style-position
         */
        "list-style-position": [{
          list: ["inside", "outside"]
        }],
        /**
         * Placeholder Color
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/placeholder-color
         */
        "placeholder-color": [{
          placeholder: [colors]
        }],
        /**
         * Placeholder Opacity
         * @see https://tailwindcss.com/docs/placeholder-opacity
         */
        "placeholder-opacity": [{
          "placeholder-opacity": [opacity]
        }],
        /**
         * Text Alignment
         * @see https://tailwindcss.com/docs/text-align
         */
        "text-alignment": [{
          text: ["left", "center", "right", "justify", "start", "end"]
        }],
        /**
         * Text Color
         * @see https://tailwindcss.com/docs/text-color
         */
        "text-color": [{
          text: [colors]
        }],
        /**
         * Text Opacity
         * @see https://tailwindcss.com/docs/text-opacity
         */
        "text-opacity": [{
          "text-opacity": [opacity]
        }],
        /**
         * Text Decoration
         * @see https://tailwindcss.com/docs/text-decoration
         */
        "text-decoration": ["underline", "overline", "line-through", "no-underline"],
        /**
         * Text Decoration Style
         * @see https://tailwindcss.com/docs/text-decoration-style
         */
        "text-decoration-style": [{
          decoration: [...getLineStyles(), "wavy"]
        }],
        /**
         * Text Decoration Thickness
         * @see https://tailwindcss.com/docs/text-decoration-thickness
         */
        "text-decoration-thickness": [{
          decoration: ["auto", "from-font", isLength, isArbitraryLength]
        }],
        /**
         * Text Underline Offset
         * @see https://tailwindcss.com/docs/text-underline-offset
         */
        "underline-offset": [{
          "underline-offset": ["auto", isLength, isArbitraryValue]
        }],
        /**
         * Text Decoration Color
         * @see https://tailwindcss.com/docs/text-decoration-color
         */
        "text-decoration-color": [{
          decoration: [colors]
        }],
        /**
         * Text Transform
         * @see https://tailwindcss.com/docs/text-transform
         */
        "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
        /**
         * Text Overflow
         * @see https://tailwindcss.com/docs/text-overflow
         */
        "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
        /**
         * Text Wrap
         * @see https://tailwindcss.com/docs/text-wrap
         */
        "text-wrap": [{
          text: ["wrap", "nowrap", "balance", "pretty"]
        }],
        /**
         * Text Indent
         * @see https://tailwindcss.com/docs/text-indent
         */
        indent: [{
          indent: getSpacingWithArbitrary()
        }],
        /**
         * Vertical Alignment
         * @see https://tailwindcss.com/docs/vertical-align
         */
        "vertical-align": [{
          align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", isArbitraryValue]
        }],
        /**
         * Whitespace
         * @see https://tailwindcss.com/docs/whitespace
         */
        whitespace: [{
          whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
        }],
        /**
         * Word Break
         * @see https://tailwindcss.com/docs/word-break
         */
        break: [{
          break: ["normal", "words", "all", "keep"]
        }],
        /**
         * Hyphens
         * @see https://tailwindcss.com/docs/hyphens
         */
        hyphens: [{
          hyphens: ["none", "manual", "auto"]
        }],
        /**
         * Content
         * @see https://tailwindcss.com/docs/content
         */
        content: [{
          content: ["none", isArbitraryValue]
        }],
        // Backgrounds
        /**
         * Background Attachment
         * @see https://tailwindcss.com/docs/background-attachment
         */
        "bg-attachment": [{
          bg: ["fixed", "local", "scroll"]
        }],
        /**
         * Background Clip
         * @see https://tailwindcss.com/docs/background-clip
         */
        "bg-clip": [{
          "bg-clip": ["border", "padding", "content", "text"]
        }],
        /**
         * Background Opacity
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/background-opacity
         */
        "bg-opacity": [{
          "bg-opacity": [opacity]
        }],
        /**
         * Background Origin
         * @see https://tailwindcss.com/docs/background-origin
         */
        "bg-origin": [{
          "bg-origin": ["border", "padding", "content"]
        }],
        /**
         * Background Position
         * @see https://tailwindcss.com/docs/background-position
         */
        "bg-position": [{
          bg: [...getPositions(), isArbitraryPosition]
        }],
        /**
         * Background Repeat
         * @see https://tailwindcss.com/docs/background-repeat
         */
        "bg-repeat": [{
          bg: ["no-repeat", {
            repeat: ["", "x", "y", "round", "space"]
          }]
        }],
        /**
         * Background Size
         * @see https://tailwindcss.com/docs/background-size
         */
        "bg-size": [{
          bg: ["auto", "cover", "contain", isArbitrarySize]
        }],
        /**
         * Background Image
         * @see https://tailwindcss.com/docs/background-image
         */
        "bg-image": [{
          bg: ["none", {
            "gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
          }, isArbitraryImage]
        }],
        /**
         * Background Color
         * @see https://tailwindcss.com/docs/background-color
         */
        "bg-color": [{
          bg: [colors]
        }],
        /**
         * Gradient Color Stops From Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from-pos": [{
          from: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops Via Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via-pos": [{
          via: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops To Position
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to-pos": [{
          to: [gradientColorStopPositions]
        }],
        /**
         * Gradient Color Stops From
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-from": [{
          from: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops Via
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-via": [{
          via: [gradientColorStops]
        }],
        /**
         * Gradient Color Stops To
         * @see https://tailwindcss.com/docs/gradient-color-stops
         */
        "gradient-to": [{
          to: [gradientColorStops]
        }],
        // Borders
        /**
         * Border Radius
         * @see https://tailwindcss.com/docs/border-radius
         */
        rounded: [{
          rounded: [borderRadius]
        }],
        /**
         * Border Radius Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-s": [{
          "rounded-s": [borderRadius]
        }],
        /**
         * Border Radius End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-e": [{
          "rounded-e": [borderRadius]
        }],
        /**
         * Border Radius Top
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-t": [{
          "rounded-t": [borderRadius]
        }],
        /**
         * Border Radius Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-r": [{
          "rounded-r": [borderRadius]
        }],
        /**
         * Border Radius Bottom
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-b": [{
          "rounded-b": [borderRadius]
        }],
        /**
         * Border Radius Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-l": [{
          "rounded-l": [borderRadius]
        }],
        /**
         * Border Radius Start Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ss": [{
          "rounded-ss": [borderRadius]
        }],
        /**
         * Border Radius Start End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-se": [{
          "rounded-se": [borderRadius]
        }],
        /**
         * Border Radius End End
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-ee": [{
          "rounded-ee": [borderRadius]
        }],
        /**
         * Border Radius End Start
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-es": [{
          "rounded-es": [borderRadius]
        }],
        /**
         * Border Radius Top Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tl": [{
          "rounded-tl": [borderRadius]
        }],
        /**
         * Border Radius Top Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-tr": [{
          "rounded-tr": [borderRadius]
        }],
        /**
         * Border Radius Bottom Right
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-br": [{
          "rounded-br": [borderRadius]
        }],
        /**
         * Border Radius Bottom Left
         * @see https://tailwindcss.com/docs/border-radius
         */
        "rounded-bl": [{
          "rounded-bl": [borderRadius]
        }],
        /**
         * Border Width
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w": [{
          border: [borderWidth]
        }],
        /**
         * Border Width X
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-x": [{
          "border-x": [borderWidth]
        }],
        /**
         * Border Width Y
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-y": [{
          "border-y": [borderWidth]
        }],
        /**
         * Border Width Start
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-s": [{
          "border-s": [borderWidth]
        }],
        /**
         * Border Width End
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-e": [{
          "border-e": [borderWidth]
        }],
        /**
         * Border Width Top
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-t": [{
          "border-t": [borderWidth]
        }],
        /**
         * Border Width Right
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-r": [{
          "border-r": [borderWidth]
        }],
        /**
         * Border Width Bottom
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-b": [{
          "border-b": [borderWidth]
        }],
        /**
         * Border Width Left
         * @see https://tailwindcss.com/docs/border-width
         */
        "border-w-l": [{
          "border-l": [borderWidth]
        }],
        /**
         * Border Opacity
         * @see https://tailwindcss.com/docs/border-opacity
         */
        "border-opacity": [{
          "border-opacity": [opacity]
        }],
        /**
         * Border Style
         * @see https://tailwindcss.com/docs/border-style
         */
        "border-style": [{
          border: [...getLineStyles(), "hidden"]
        }],
        /**
         * Divide Width X
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x": [{
          "divide-x": [borderWidth]
        }],
        /**
         * Divide Width X Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-x-reverse": ["divide-x-reverse"],
        /**
         * Divide Width Y
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y": [{
          "divide-y": [borderWidth]
        }],
        /**
         * Divide Width Y Reverse
         * @see https://tailwindcss.com/docs/divide-width
         */
        "divide-y-reverse": ["divide-y-reverse"],
        /**
         * Divide Opacity
         * @see https://tailwindcss.com/docs/divide-opacity
         */
        "divide-opacity": [{
          "divide-opacity": [opacity]
        }],
        /**
         * Divide Style
         * @see https://tailwindcss.com/docs/divide-style
         */
        "divide-style": [{
          divide: getLineStyles()
        }],
        /**
         * Border Color
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color": [{
          border: [borderColor]
        }],
        /**
         * Border Color X
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-x": [{
          "border-x": [borderColor]
        }],
        /**
         * Border Color Y
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-y": [{
          "border-y": [borderColor]
        }],
        /**
         * Border Color S
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-s": [{
          "border-s": [borderColor]
        }],
        /**
         * Border Color E
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-e": [{
          "border-e": [borderColor]
        }],
        /**
         * Border Color Top
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-t": [{
          "border-t": [borderColor]
        }],
        /**
         * Border Color Right
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-r": [{
          "border-r": [borderColor]
        }],
        /**
         * Border Color Bottom
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-b": [{
          "border-b": [borderColor]
        }],
        /**
         * Border Color Left
         * @see https://tailwindcss.com/docs/border-color
         */
        "border-color-l": [{
          "border-l": [borderColor]
        }],
        /**
         * Divide Color
         * @see https://tailwindcss.com/docs/divide-color
         */
        "divide-color": [{
          divide: [borderColor]
        }],
        /**
         * Outline Style
         * @see https://tailwindcss.com/docs/outline-style
         */
        "outline-style": [{
          outline: ["", ...getLineStyles()]
        }],
        /**
         * Outline Offset
         * @see https://tailwindcss.com/docs/outline-offset
         */
        "outline-offset": [{
          "outline-offset": [isLength, isArbitraryValue]
        }],
        /**
         * Outline Width
         * @see https://tailwindcss.com/docs/outline-width
         */
        "outline-w": [{
          outline: [isLength, isArbitraryLength]
        }],
        /**
         * Outline Color
         * @see https://tailwindcss.com/docs/outline-color
         */
        "outline-color": [{
          outline: [colors]
        }],
        /**
         * Ring Width
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w": [{
          ring: getLengthWithEmptyAndArbitrary()
        }],
        /**
         * Ring Width Inset
         * @see https://tailwindcss.com/docs/ring-width
         */
        "ring-w-inset": ["ring-inset"],
        /**
         * Ring Color
         * @see https://tailwindcss.com/docs/ring-color
         */
        "ring-color": [{
          ring: [colors]
        }],
        /**
         * Ring Opacity
         * @see https://tailwindcss.com/docs/ring-opacity
         */
        "ring-opacity": [{
          "ring-opacity": [opacity]
        }],
        /**
         * Ring Offset Width
         * @see https://tailwindcss.com/docs/ring-offset-width
         */
        "ring-offset-w": [{
          "ring-offset": [isLength, isArbitraryLength]
        }],
        /**
         * Ring Offset Color
         * @see https://tailwindcss.com/docs/ring-offset-color
         */
        "ring-offset-color": [{
          "ring-offset": [colors]
        }],
        // Effects
        /**
         * Box Shadow
         * @see https://tailwindcss.com/docs/box-shadow
         */
        shadow: [{
          shadow: ["", "inner", "none", isTshirtSize, isArbitraryShadow]
        }],
        /**
         * Box Shadow Color
         * @see https://tailwindcss.com/docs/box-shadow-color
         */
        "shadow-color": [{
          shadow: [isAny]
        }],
        /**
         * Opacity
         * @see https://tailwindcss.com/docs/opacity
         */
        opacity: [{
          opacity: [opacity]
        }],
        /**
         * Mix Blend Mode
         * @see https://tailwindcss.com/docs/mix-blend-mode
         */
        "mix-blend": [{
          "mix-blend": [...getBlendModes(), "plus-lighter", "plus-darker"]
        }],
        /**
         * Background Blend Mode
         * @see https://tailwindcss.com/docs/background-blend-mode
         */
        "bg-blend": [{
          "bg-blend": getBlendModes()
        }],
        // Filters
        /**
         * Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/filter
         */
        filter: [{
          filter: ["", "none"]
        }],
        /**
         * Blur
         * @see https://tailwindcss.com/docs/blur
         */
        blur: [{
          blur: [blur]
        }],
        /**
         * Brightness
         * @see https://tailwindcss.com/docs/brightness
         */
        brightness: [{
          brightness: [brightness]
        }],
        /**
         * Contrast
         * @see https://tailwindcss.com/docs/contrast
         */
        contrast: [{
          contrast: [contrast]
        }],
        /**
         * Drop Shadow
         * @see https://tailwindcss.com/docs/drop-shadow
         */
        "drop-shadow": [{
          "drop-shadow": ["", "none", isTshirtSize, isArbitraryValue]
        }],
        /**
         * Grayscale
         * @see https://tailwindcss.com/docs/grayscale
         */
        grayscale: [{
          grayscale: [grayscale]
        }],
        /**
         * Hue Rotate
         * @see https://tailwindcss.com/docs/hue-rotate
         */
        "hue-rotate": [{
          "hue-rotate": [hueRotate]
        }],
        /**
         * Invert
         * @see https://tailwindcss.com/docs/invert
         */
        invert: [{
          invert: [invert]
        }],
        /**
         * Saturate
         * @see https://tailwindcss.com/docs/saturate
         */
        saturate: [{
          saturate: [saturate]
        }],
        /**
         * Sepia
         * @see https://tailwindcss.com/docs/sepia
         */
        sepia: [{
          sepia: [sepia]
        }],
        /**
         * Backdrop Filter
         * @deprecated since Tailwind CSS v3.0.0
         * @see https://tailwindcss.com/docs/backdrop-filter
         */
        "backdrop-filter": [{
          "backdrop-filter": ["", "none"]
        }],
        /**
         * Backdrop Blur
         * @see https://tailwindcss.com/docs/backdrop-blur
         */
        "backdrop-blur": [{
          "backdrop-blur": [blur]
        }],
        /**
         * Backdrop Brightness
         * @see https://tailwindcss.com/docs/backdrop-brightness
         */
        "backdrop-brightness": [{
          "backdrop-brightness": [brightness]
        }],
        /**
         * Backdrop Contrast
         * @see https://tailwindcss.com/docs/backdrop-contrast
         */
        "backdrop-contrast": [{
          "backdrop-contrast": [contrast]
        }],
        /**
         * Backdrop Grayscale
         * @see https://tailwindcss.com/docs/backdrop-grayscale
         */
        "backdrop-grayscale": [{
          "backdrop-grayscale": [grayscale]
        }],
        /**
         * Backdrop Hue Rotate
         * @see https://tailwindcss.com/docs/backdrop-hue-rotate
         */
        "backdrop-hue-rotate": [{
          "backdrop-hue-rotate": [hueRotate]
        }],
        /**
         * Backdrop Invert
         * @see https://tailwindcss.com/docs/backdrop-invert
         */
        "backdrop-invert": [{
          "backdrop-invert": [invert]
        }],
        /**
         * Backdrop Opacity
         * @see https://tailwindcss.com/docs/backdrop-opacity
         */
        "backdrop-opacity": [{
          "backdrop-opacity": [opacity]
        }],
        /**
         * Backdrop Saturate
         * @see https://tailwindcss.com/docs/backdrop-saturate
         */
        "backdrop-saturate": [{
          "backdrop-saturate": [saturate]
        }],
        /**
         * Backdrop Sepia
         * @see https://tailwindcss.com/docs/backdrop-sepia
         */
        "backdrop-sepia": [{
          "backdrop-sepia": [sepia]
        }],
        // Tables
        /**
         * Border Collapse
         * @see https://tailwindcss.com/docs/border-collapse
         */
        "border-collapse": [{
          border: ["collapse", "separate"]
        }],
        /**
         * Border Spacing
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing": [{
          "border-spacing": [borderSpacing]
        }],
        /**
         * Border Spacing X
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-x": [{
          "border-spacing-x": [borderSpacing]
        }],
        /**
         * Border Spacing Y
         * @see https://tailwindcss.com/docs/border-spacing
         */
        "border-spacing-y": [{
          "border-spacing-y": [borderSpacing]
        }],
        /**
         * Table Layout
         * @see https://tailwindcss.com/docs/table-layout
         */
        "table-layout": [{
          table: ["auto", "fixed"]
        }],
        /**
         * Caption Side
         * @see https://tailwindcss.com/docs/caption-side
         */
        caption: [{
          caption: ["top", "bottom"]
        }],
        // Transitions and Animation
        /**
         * Tranisition Property
         * @see https://tailwindcss.com/docs/transition-property
         */
        transition: [{
          transition: ["none", "all", "", "colors", "opacity", "shadow", "transform", isArbitraryValue]
        }],
        /**
         * Transition Duration
         * @see https://tailwindcss.com/docs/transition-duration
         */
        duration: [{
          duration: getNumberAndArbitrary()
        }],
        /**
         * Transition Timing Function
         * @see https://tailwindcss.com/docs/transition-timing-function
         */
        ease: [{
          ease: ["linear", "in", "out", "in-out", isArbitraryValue]
        }],
        /**
         * Transition Delay
         * @see https://tailwindcss.com/docs/transition-delay
         */
        delay: [{
          delay: getNumberAndArbitrary()
        }],
        /**
         * Animation
         * @see https://tailwindcss.com/docs/animation
         */
        animate: [{
          animate: ["none", "spin", "ping", "pulse", "bounce", isArbitraryValue]
        }],
        // Transforms
        /**
         * Transform
         * @see https://tailwindcss.com/docs/transform
         */
        transform: [{
          transform: ["", "gpu", "none"]
        }],
        /**
         * Scale
         * @see https://tailwindcss.com/docs/scale
         */
        scale: [{
          scale: [scale]
        }],
        /**
         * Scale X
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-x": [{
          "scale-x": [scale]
        }],
        /**
         * Scale Y
         * @see https://tailwindcss.com/docs/scale
         */
        "scale-y": [{
          "scale-y": [scale]
        }],
        /**
         * Rotate
         * @see https://tailwindcss.com/docs/rotate
         */
        rotate: [{
          rotate: [isInteger, isArbitraryValue]
        }],
        /**
         * Translate X
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-x": [{
          "translate-x": [translate]
        }],
        /**
         * Translate Y
         * @see https://tailwindcss.com/docs/translate
         */
        "translate-y": [{
          "translate-y": [translate]
        }],
        /**
         * Skew X
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-x": [{
          "skew-x": [skew]
        }],
        /**
         * Skew Y
         * @see https://tailwindcss.com/docs/skew
         */
        "skew-y": [{
          "skew-y": [skew]
        }],
        /**
         * Transform Origin
         * @see https://tailwindcss.com/docs/transform-origin
         */
        "transform-origin": [{
          origin: ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left", isArbitraryValue]
        }],
        // Interactivity
        /**
         * Accent Color
         * @see https://tailwindcss.com/docs/accent-color
         */
        accent: [{
          accent: ["auto", colors]
        }],
        /**
         * Appearance
         * @see https://tailwindcss.com/docs/appearance
         */
        appearance: [{
          appearance: ["none", "auto"]
        }],
        /**
         * Cursor
         * @see https://tailwindcss.com/docs/cursor
         */
        cursor: [{
          cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", isArbitraryValue]
        }],
        /**
         * Caret Color
         * @see https://tailwindcss.com/docs/just-in-time-mode#caret-color-utilities
         */
        "caret-color": [{
          caret: [colors]
        }],
        /**
         * Pointer Events
         * @see https://tailwindcss.com/docs/pointer-events
         */
        "pointer-events": [{
          "pointer-events": ["none", "auto"]
        }],
        /**
         * Resize
         * @see https://tailwindcss.com/docs/resize
         */
        resize: [{
          resize: ["none", "y", "x", ""]
        }],
        /**
         * Scroll Behavior
         * @see https://tailwindcss.com/docs/scroll-behavior
         */
        "scroll-behavior": [{
          scroll: ["auto", "smooth"]
        }],
        /**
         * Scroll Margin
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-m": [{
          "scroll-m": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin X
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mx": [{
          "scroll-mx": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Y
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-my": [{
          "scroll-my": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Start
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ms": [{
          "scroll-ms": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin End
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-me": [{
          "scroll-me": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Top
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mt": [{
          "scroll-mt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Right
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mr": [{
          "scroll-mr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Bottom
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-mb": [{
          "scroll-mb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Margin Left
         * @see https://tailwindcss.com/docs/scroll-margin
         */
        "scroll-ml": [{
          "scroll-ml": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-p": [{
          "scroll-p": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding X
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-px": [{
          "scroll-px": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Y
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-py": [{
          "scroll-py": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Start
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-ps": [{
          "scroll-ps": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding End
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pe": [{
          "scroll-pe": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Top
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pt": [{
          "scroll-pt": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Right
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pr": [{
          "scroll-pr": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Bottom
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pb": [{
          "scroll-pb": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Padding Left
         * @see https://tailwindcss.com/docs/scroll-padding
         */
        "scroll-pl": [{
          "scroll-pl": getSpacingWithArbitrary()
        }],
        /**
         * Scroll Snap Align
         * @see https://tailwindcss.com/docs/scroll-snap-align
         */
        "snap-align": [{
          snap: ["start", "end", "center", "align-none"]
        }],
        /**
         * Scroll Snap Stop
         * @see https://tailwindcss.com/docs/scroll-snap-stop
         */
        "snap-stop": [{
          snap: ["normal", "always"]
        }],
        /**
         * Scroll Snap Type
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-type": [{
          snap: ["none", "x", "y", "both"]
        }],
        /**
         * Scroll Snap Type Strictness
         * @see https://tailwindcss.com/docs/scroll-snap-type
         */
        "snap-strictness": [{
          snap: ["mandatory", "proximity"]
        }],
        /**
         * Touch Action
         * @see https://tailwindcss.com/docs/touch-action
         */
        touch: [{
          touch: ["auto", "none", "manipulation"]
        }],
        /**
         * Touch Action X
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-x": [{
          "touch-pan": ["x", "left", "right"]
        }],
        /**
         * Touch Action Y
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-y": [{
          "touch-pan": ["y", "up", "down"]
        }],
        /**
         * Touch Action Pinch Zoom
         * @see https://tailwindcss.com/docs/touch-action
         */
        "touch-pz": ["touch-pinch-zoom"],
        /**
         * User Select
         * @see https://tailwindcss.com/docs/user-select
         */
        select: [{
          select: ["none", "text", "all", "auto"]
        }],
        /**
         * Will Change
         * @see https://tailwindcss.com/docs/will-change
         */
        "will-change": [{
          "will-change": ["auto", "scroll", "contents", "transform", isArbitraryValue]
        }],
        // SVG
        /**
         * Fill
         * @see https://tailwindcss.com/docs/fill
         */
        fill: [{
          fill: [colors, "none"]
        }],
        /**
         * Stroke Width
         * @see https://tailwindcss.com/docs/stroke-width
         */
        "stroke-w": [{
          stroke: [isLength, isArbitraryLength, isArbitraryNumber]
        }],
        /**
         * Stroke
         * @see https://tailwindcss.com/docs/stroke
         */
        stroke: [{
          stroke: [colors, "none"]
        }],
        // Accessibility
        /**
         * Screen Readers
         * @see https://tailwindcss.com/docs/screen-readers
         */
        sr: ["sr-only", "not-sr-only"],
        /**
         * Forced Color Adjust
         * @see https://tailwindcss.com/docs/forced-color-adjust
         */
        "forced-color-adjust": [{
          "forced-color-adjust": ["auto", "none"]
        }]
      },
      conflictingClassGroups: {
        overflow: ["overflow-x", "overflow-y"],
        overscroll: ["overscroll-x", "overscroll-y"],
        inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
        "inset-x": ["right", "left"],
        "inset-y": ["top", "bottom"],
        flex: ["basis", "grow", "shrink"],
        gap: ["gap-x", "gap-y"],
        p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
        px: ["pr", "pl"],
        py: ["pt", "pb"],
        m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
        mx: ["mr", "ml"],
        my: ["mt", "mb"],
        size: ["w", "h"],
        "font-size": ["leading"],
        "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
        "fvn-ordinal": ["fvn-normal"],
        "fvn-slashed-zero": ["fvn-normal"],
        "fvn-figure": ["fvn-normal"],
        "fvn-spacing": ["fvn-normal"],
        "fvn-fraction": ["fvn-normal"],
        "line-clamp": ["display", "overflow"],
        rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
        "rounded-s": ["rounded-ss", "rounded-es"],
        "rounded-e": ["rounded-se", "rounded-ee"],
        "rounded-t": ["rounded-tl", "rounded-tr"],
        "rounded-r": ["rounded-tr", "rounded-br"],
        "rounded-b": ["rounded-br", "rounded-bl"],
        "rounded-l": ["rounded-tl", "rounded-bl"],
        "border-spacing": ["border-spacing-x", "border-spacing-y"],
        "border-w": ["border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
        "border-w-x": ["border-w-r", "border-w-l"],
        "border-w-y": ["border-w-t", "border-w-b"],
        "border-color": ["border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
        "border-color-x": ["border-color-r", "border-color-l"],
        "border-color-y": ["border-color-t", "border-color-b"],
        "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
        "scroll-mx": ["scroll-mr", "scroll-ml"],
        "scroll-my": ["scroll-mt", "scroll-mb"],
        "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
        "scroll-px": ["scroll-pr", "scroll-pl"],
        "scroll-py": ["scroll-pt", "scroll-pb"],
        touch: ["touch-x", "touch-y", "touch-pz"],
        "touch-x": ["touch"],
        "touch-y": ["touch"],
        "touch-pz": ["touch"]
      },
      conflictingClassGroupModifiers: {
        "font-size": ["leading"]
      }
    };
  };
  var twMerge = /* @__PURE__ */ createTailwindMerge(getDefaultConfig);

  // src/lib/utils.js
  function cn(...inputs) {
    return twMerge(clsx(inputs));
  }

  // src/components/ui/button.jsx
  var Button = React2.forwardRef(
    ({ className, variant = "default", ...props }, ref) => {
      const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 px-4 py-2";
      const variants = {
        default: "bg-black text-white hover:bg-gray-800",
        outline: "border border-gray-300 bg-white text-black hover:bg-gray-50",
        secondary: "bg-gray-100 text-black hover:bg-gray-200",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        ghost: "hover:bg-gray-100 text-black"
      };
      return /* @__PURE__ */ React2.createElement(
        "button",
        {
          className: cn(baseStyles, variants[variant], className),
          ref,
          ...props
        }
      );
    }
  );
  Button.displayName = "Button";

  // src/components/ui/input.jsx
  var import_react2 = __toESM(__require("react"), 1);
  var Input = import_react2.default.forwardRef(
    ({ className, type = "text", ...props }, ref) => /* @__PURE__ */ import_react2.default.createElement(
      "input",
      {
        type,
        className: `flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`,
        ref,
        ...props
      }
    )
  );
  Input.displayName = "Input";

  // src/components/ui/select.jsx
  var import_react3 = __toESM(__require("react"), 1);
  var Select = import_react3.default.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ import_react3.default.createElement(
    "select",
    {
      ref,
      className: `flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`,
      ...props
    },
    children
  ));
  Select.displayName = "Select";

  // src/components/ui/label.jsx
  var import_react4 = __toESM(__require("react"), 1);
  var Label = import_react4.default.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ import_react4.default.createElement(
    "label",
    {
      ref,
      className: `text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ""}`,
      ...props
    }
  ));
  Label.displayName = "Label";

  // src/lib/rowing.js
  var generateRaceCode = (category, boatClass) => {
    let boatCode = boatClass?.code || "1X";
    const catAbbr = category?.abbreviation || "";
    const catGender = category?.gender || "mixed";
    const weightClass = boatClass?.weightClass || "open";
    const hasLegacyLightweightPrefix = boatCode.match(/^L[MW]?\d/i) || boatCode.match(/^LW?\d/i);
    if (hasLegacyLightweightPrefix) {
      boatCode = boatCode.replace(/^L[MW]?/i, "");
    }
    const isLightweight = weightClass === "lightweight" || hasLegacyLightweightPrefix;
    const isSeniorCategory = ["M", "W", "SM", "SW", "S"].includes(catAbbr.toUpperCase()) || (category?.titles?.en || "").toLowerCase().includes("senior");
    const genderPrefix = catGender === "women" ? "W" : catGender === "mixed" ? "Mix" : "M";
    if (isSeniorCategory) {
      return isLightweight ? `L${genderPrefix}${boatCode}` : `${genderPrefix}${boatCode}`;
    }
    const hasGenderSuffix = /[MmWw]$|Mix$/i.test(catAbbr);
    const hasGenderPrefix = /^[MmWw]|Mix/i.test(catAbbr);
    if (isLightweight) {
      if (catAbbr.toLowerCase().endsWith("mix")) {
        return `${catAbbr.slice(0, -3)}LMix${boatCode}`;
      }
      if (hasGenderSuffix && !hasGenderPrefix) {
        const catBase = catAbbr.slice(0, -1);
        const catGenderSuffix = catAbbr.slice(-1);
        return `${catBase}L${catGenderSuffix}${boatCode}`;
      }
      if (hasGenderPrefix) {
        return `L${catAbbr}${boatCode}`;
      }
      return `${catAbbr}L${genderPrefix}${boatCode}`;
    }
    if (hasGenderSuffix || hasGenderPrefix) {
      return `${catAbbr}${boatCode}`;
    }
    return `${catAbbr}${genderPrefix}${boatCode}`;
  };

  // src/lib/entriesReportsPdf.js
  var import_jspdf = __toESM(__require("jspdf"), 1);
  var import_jspdf_autotable = __toESM(__require("jspdf-autotable"), 1);
  var PAGE = {
    width: 210,
    height: 297,
    left: 14,
    right: 196,
    center: 105
  };
  var FONT = "helvetica";
  var loadImage = (url) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("loadImage canvas error:", err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = `${url}${url.includes("?") ? "&" : "?"}_cb=${Date.now()}`;
  });
  var getImageFormat = (dataUrl) => String(dataUrl || "").startsWith("data:image/png") ? "PNG" : "JPEG";
  var loadFont = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to load font", error);
      return null;
    }
  };
  var formatAsOfLabel = (value = /* @__PURE__ */ new Date()) => `As of: ${value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
  var buildEntriesReportPdfFileName = (prefix, competition) => {
    const year = competition?.startDate && !Number.isNaN(new Date(competition.startDate)) ? new Date(competition.startDate).getFullYear() : (/* @__PURE__ */ new Date()).getFullYear();
    const code = String(competition?.code || "COMP").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `${prefix}_${code || "COMP"}-${year}.pdf`;
  };
  var resolveCompetitionTitle = (competition) => competition?.names?.en || competition?.name || competition?.code || "Competition";
  var resolveCompLocation = (competition) => String(
    competition?.location?.name || competition?.venue?.name || (typeof competition?.venue === "string" ? competition.venue : null) || (typeof competition?.location === "string" ? competition.location : null) || "Location"
  );
  var resolveEventDateStr = (competition, globalJourneyFilter) => {
    const dateStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const selectedStage = globalJourneyFilter ? competition?.stages?.find(
      (s) => String(s.order) === String(globalJourneyFilter)
    ) : null;
    const effectiveDate = selectedStage?.date || selectedStage?.startDate || competition?.startDate;
    return effectiveDate ? new Date(effectiveDate).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    }) : dateStr;
  };
  var registerArabicFont = (doc, arabicFontBase64) => {
    if (!arabicFontBase64) return null;
    try {
      doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      return "Amiri";
    } catch (error) {
      console.warn("Could not register Arabic font:", error);
      return null;
    }
  };
  var computeHeaderHeight = (doc, headerData) => {
    if (!headerData) return 32;
    const headerProps = doc.getImageProperties(headerData);
    return PAGE.width / (headerProps.width / headerProps.height) + 3 + 8;
  };
  var paintChrome = (doc, {
    headerData,
    footerData,
    sponsorData,
    asOfLabel,
    pageLabelStyle = "of",
    // "of" -> "Page i of n", "slash" -> "Page i/n"
    legendPainter = null
  }) => {
    const { width: pageWidth, height: pageHeight, left, right } = PAGE;
    const pageCount = doc.internal.getNumberOfPages();
    const pageLabel = (i) => pageLabelStyle === "slash" ? `Page ${i}/${pageCount}` : `Page ${i} of ${pageCount}`;
    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        const h = pageWidth / (imgProps.width / imgProps.height);
        doc.addImage(headerData, getImageFormat(headerData), 0, 3, pageWidth, h);
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(left, h + 5, right, h + 5);
      }
      if (footerData) {
        const imgProps = doc.getImageProperties(footerData);
        const h = pageWidth / (imgProps.width / imgProps.height);
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(left, pageHeight - h - 5, right, pageHeight - h - 5);
        if (legendPainter) legendPainter(pageHeight - h - 5);
        doc.addImage(
          footerData,
          getImageFormat(footerData),
          0,
          pageHeight - h - 3,
          pageWidth,
          h
        );
        doc.setFontSize(8);
        doc.setFont(FONT, "normal");
        doc.setTextColor(100);
        doc.text(asOfLabel, left, pageHeight - h - 8);
        doc.text(pageLabel(i), right, pageHeight - h - 8, { align: "right" });
      } else if (sponsorData) {
        const imgProps = doc.getImageProperties(sponsorData);
        const ratio = imgProps.width / imgProps.height;
        let w = 180;
        let h = w / ratio;
        if (h > 20) {
          h = 20;
          w = h * ratio;
        }
        const x = left + (180 - w) / 2;
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(left, pageHeight - h - 5, right, pageHeight - h - 5);
        if (legendPainter) legendPainter(pageHeight - h - 5);
        doc.addImage(
          sponsorData,
          getImageFormat(sponsorData),
          x,
          pageHeight - h - 3,
          w,
          h
        );
        doc.setFontSize(8);
        doc.setFont(FONT, "normal");
        doc.setTextColor(100);
        doc.text(asOfLabel, left, pageHeight - h - 8);
        doc.text(pageLabel(i), right, pageHeight - h - 8, { align: "right" });
      } else {
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(left, pageHeight - 15, right, pageHeight - 15);
        doc.setFontSize(8);
        doc.setFont(FONT, "normal");
        doc.setTextColor(100);
        doc.text(asOfLabel, left, pageHeight - 8);
        doc.text(pageLabel(i), right, pageHeight - 8, { align: "right" });
      }
    }
  };
  async function exportEntryListByEventPdf({
    competition,
    rows: inputRows,
    isInternational = false,
    globalJourneyFilter = null
  }) {
    const rows = [...inputRows].sort((a, b) => {
      const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
      const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
      if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
      const eventCompare = `${a.eventCode} ${a.eventName}`.localeCompare(
        `${b.eventCode} ${b.eventName}`
      );
      if (eventCompare !== 0) return eventCompare;
      const clubCompare = `${a.clubCode} ${a.clubName}`.localeCompare(
        `${b.clubCode} ${b.clubName}`
      );
      if (clubCompare !== 0) return clubCompare;
      return a.athleteName.localeCompare(b.athleteName);
    });
    if (!rows.length) return false;
    const asOfLabel = formatAsOfLabel();
    const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);
    const [headerData, footerData, sponsorData, arabicFontBase64] = await Promise.all([
      loadImage("/header.png"),
      loadImage("/footer.png"),
      loadImage("/sponsors.png"),
      loadFont("/fonts/Amiri-Regular.ttf")
    ]);
    const doc = new import_jspdf.default({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });
    const arabicFontName = registerArabicFont(doc, arabicFontBase64);
    const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
    const headerHeight = computeHeaderHeight(doc, headerData);
    const compLocation = resolveCompLocation(competition);
    const competitionTitle = resolveCompetitionTitle(competition);
    const drawReportHeader = () => {
      let y = headerHeight;
      doc.setFontSize(14);
      doc.setFont(FONT, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(competitionTitle, center, y, { align: "center" });
      doc.setFontSize(9);
      doc.setFont(FONT, "normal");
      doc.text(compLocation, left, y);
      doc.text(eventDateStr, right, y, { align: "right" });
      y += 2;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0);
      doc.line(left, y, right, y);
      y += 6;
      doc.setFontSize(12);
      doc.setFont(FONT, "bold");
      doc.text("Entry List by Event", center, y, { align: "center" });
      y += 5;
      doc.setFontSize(8);
      doc.setFont(FONT, "normal");
      doc.setTextColor(90);
      doc.text(asOfLabel, left, y);
      y += 2;
      return y;
    };
    const byEvent = Array.from(
      rows.reduce((map, row) => {
        const key = `${row.eventCode}||${row.eventName}`;
        if (!map.has(key)) {
          map.set(key, {
            eventCode: row.eventCode,
            eventName: row.eventName,
            eventNumber: Number.isFinite(Number(row.eventNumber)) && Number(row.eventNumber) > 0 ? Number(row.eventNumber) : null,
            entries: []
          });
        }
        const group = map.get(key);
        const rowEventNumber = Number(row.eventNumber);
        if (Number.isFinite(rowEventNumber) && rowEventNumber > 0) {
          group.eventNumber = group.eventNumber == null ? rowEventNumber : Math.min(group.eventNumber, rowEventNumber);
        }
        group.entries.push(row);
        return map;
      }, /* @__PURE__ */ new Map()).values()
    ).sort((a, b) => {
      const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
      const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
      if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
      return `${a.eventCode} ${a.eventName}`.localeCompare(
        `${b.eventCode} ${b.eventName}`
      );
    });
    const drawTextSmart = (text, x, y, options = {}) => {
      const value = String(text || "");
      const hasArabic = /[\u0600-\u06FF]/.test(value);
      if (hasArabic && arabicFontName) {
        doc.setFont(arabicFontName, "normal");
        doc.text(value, x, y, options);
        doc.setFont(FONT, "normal");
        return;
      }
      doc.text(value, x, y, options);
    };
    let yPos = drawReportHeader();
    const drawEventHeader = (group, index, continued = false) => {
      const fallbackNumber = index + 1;
      const eventNo = String(
        Number.isFinite(Number(group?.eventNumber)) && Number(group.eventNumber) > 0 ? Number(group.eventNumber) : fallbackNumber
      );
      const eventCode = String(group.eventCode || "-");
      const eventName = String(group.eventName || "Event");
      doc.setTextColor(0, 0, 0);
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      doc.text(eventNo, left, yPos + 4);
      doc.text(eventCode, right, yPos + 4, { align: "right" });
      doc.setFontSize(8);
      doc.setFont(FONT, "normal");
      doc.text("(Event)", left, yPos + 8);
      doc.setFont(FONT, "bold");
      doc.setFontSize(12);
      doc.text(continued ? `${eventName} (cont.)` : eventName, center, yPos + 8, {
        align: "center"
      });
      doc.setFont(FONT, "bold");
      doc.setFontSize(9);
      doc.text(asOfLabel.replace("As of: ", "As of "), center, yPos + 13, {
        align: "center"
      });
      doc.setLineWidth(0.35);
      doc.setDrawColor(0);
      doc.line(left, yPos + 15, right, yPos + 15);
      yPos += 18;
    };
    byEvent.forEach((group, eventIndex) => {
      if (yPos + 26 > pageHeight - 40) {
        doc.addPage();
        yPos = drawReportHeader();
      }
      drawEventHeader(group, eventIndex, false);
      const groupedEntries = Array.from(
        group.entries.reduce((map, entry) => {
          const key = isInternational ? entry.country || "UNK" : entry.clubCode || "UNK";
          if (!map.has(key)) map.set(key, { key, athletes: [] });
          const target = map.get(key);
          const rawName = String(entry.athleteName || "-");
          const splitNames = rawName.split("/").map((part) => part.trim()).filter(Boolean);
          if (splitNames.length > 1) {
            splitNames.forEach((name) => target.athletes.push(name));
          } else {
            target.athletes.push(rawName.trim());
          }
          return map;
        }, /* @__PURE__ */ new Map()).values()
      ).sort((a, b) => a.key.localeCompare(b.key));
      const cols = isInternational ? 5 : 4;
      const gap = 4;
      const colWidth = (right - left - gap * (cols - 1)) / cols;
      const lineHeight = 4;
      const blocks = groupedEntries.map((item) => {
        const lines = item.athletes.slice(0, 18);
        const h = 4 + lineHeight + lines.length * 3.6;
        return { ...item, lines, blockHeight: Math.max(h, 12) };
      });
      let cursor = 0;
      while (cursor < blocks.length) {
        const rowBlocks = blocks.slice(cursor, cursor + cols);
        const maxH = Math.max(...rowBlocks.map((b) => b.blockHeight));
        if (yPos + maxH > pageHeight - 40) {
          doc.addPage();
          yPos = drawReportHeader();
          drawEventHeader(group, eventIndex, true);
        }
        rowBlocks.forEach((block, idx) => {
          const x = left + idx * (colWidth + gap);
          let lineY = yPos + 4;
          doc.setFont(FONT, "bold");
          doc.setFontSize(10);
          doc.text(block.key, x + 1, lineY);
          doc.setFont(FONT, "normal");
          doc.setFontSize(8);
          lineY += lineHeight;
          block.lines.forEach((line) => {
            const wrapped = doc.splitTextToSize(
              String(line || "-"),
              colWidth - 1.5
            );
            wrapped.forEach((part) => {
              drawTextSmart(part, x + 1, lineY);
              lineY += 3.4;
            });
          });
        });
        yPos += maxH + 2;
        cursor += cols;
      }
      yPos += 4;
    });
    paintChrome(doc, {
      headerData,
      footerData,
      sponsorData,
      asOfLabel,
      pageLabelStyle: "of"
    });
    doc.save(buildEntriesReportPdfFileName("EntryListByEvent", competition));
    return true;
  }
  async function exportEntriesByEventPdf({
    competition,
    rows,
    isInternational = false,
    globalJourneyFilter = null
  }) {
    if (!rows.length) return false;
    const asOfLabel = formatAsOfLabel();
    const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);
    const [headerData, footerData, sponsorData, arabicFontBase64] = await Promise.all([
      loadImage("/header.png"),
      loadImage("/footer.png"),
      loadImage("/sponsors.png"),
      loadFont("/fonts/Amiri-Regular.ttf")
    ]);
    const doc = new import_jspdf.default({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });
    const arabicFontName = registerArabicFont(doc, arabicFontBase64);
    const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
    const headerHeight = computeHeaderHeight(doc, headerData);
    const compLocation = resolveCompLocation(competition);
    const competitionTitle = resolveCompetitionTitle(competition);
    const byEvent = /* @__PURE__ */ new Map();
    rows.forEach((row) => {
      const key = `${row.eventCode}||${row.eventName}`;
      const rowEventNumber = Number(row.eventNumber);
      const normalizedEventNumber = Number.isFinite(rowEventNumber) && rowEventNumber > 0 ? rowEventNumber : null;
      if (!byEvent.has(key)) {
        byEvent.set(key, {
          key,
          eventCode: row.eventCode || "-",
          eventName: row.eventName || "-",
          eventNameAr: row.eventNameAr || "",
          eventNumber: normalizedEventNumber,
          dimensions: /* @__PURE__ */ new Set()
        });
      }
      const item = byEvent.get(key);
      if (normalizedEventNumber != null) {
        item.eventNumber = item.eventNumber == null ? normalizedEventNumber : Math.min(item.eventNumber, normalizedEventNumber);
      }
      const dimensionCode = isInternational ? row.country || "UNK" : (row.clubCode || row.clubName || "UNK").trim();
      item.dimensions.add(String(dimensionCode || "UNK").toUpperCase());
    });
    const events = Array.from(byEvent.values()).sort((a, b) => {
      const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
      const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
      if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
      return `${a.eventCode} ${a.eventName}`.localeCompare(
        `${b.eventCode} ${b.eventName}`
      );
    }).map((event, index) => {
      const list = Array.from(event.dimensions).sort(
        (a, b) => a.localeCompare(b)
      );
      return {
        ...event,
        displayEventNumber: Number.isFinite(Number(event.eventNumber)) && Number(event.eventNumber) > 0 ? Number(event.eventNumber) : index + 1,
        list,
        count: list.length
      };
    });
    const drawPageFrame = (titleSuffix = "") => {
      let y = headerHeight;
      doc.setFontSize(14);
      doc.setFont(FONT, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(competitionTitle, center, y, { align: "center" });
      doc.setFontSize(9);
      doc.setFont(FONT, "normal");
      doc.text(compLocation, left, y);
      doc.text(eventDateStr, right, y, { align: "right" });
      y += 2;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0);
      doc.line(left, y, right, y);
      y += 6;
      doc.setFontSize(12);
      doc.setFont(FONT, "bold");
      doc.text(`Entries by Event${titleSuffix}`, center, y, { align: "center" });
      y += 7;
      doc.setFontSize(9);
      doc.setFont(FONT, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(asOfLabel.replace(":", "").toUpperCase(), center, y, {
        align: "center"
      });
      y += 3;
      doc.setLineWidth(0.28);
      doc.setDrawColor(0);
      doc.line(left, y, right, y);
      y += 4;
      return y;
    };
    const availableWidth = right - left;
    const colGap = 1;
    const colsPerChunk = 10;
    const colWidth = (availableWidth - colGap * (colsPerChunk - 1)) / colsPerChunk;
    const chunks = [];
    for (let i = 0; i < events.length; i += colsPerChunk) {
      chunks.push(events.slice(i, i + colsPerChunk));
    }
    if (!chunks.length) chunks.push([]);
    let yPos = drawPageFrame();
    chunks.forEach((chunk, chunkIndex) => {
      if (chunkIndex > 0) {
        doc.addPage();
        yPos = drawPageFrame(
          chunks.length > 1 ? ` (${chunkIndex + 1}/${chunks.length})` : ""
        );
      }
      const headerRowH = 5.6;
      const listLineH = 3.7;
      const footerReserved = 37;
      const maxListLen = chunk.reduce(
        (max, item) => Math.max(max, item?.list?.length || 0),
        0
      );
      let lineOffset = 0;
      while (lineOffset < Math.max(1, maxListLen)) {
        if (lineOffset > 0) {
          doc.addPage();
          yPos = drawPageFrame(
            chunks.length > 1 ? ` (${chunkIndex + 1}/${chunks.length})` : ""
          );
        }
        const segmentCodesY = yPos;
        const segmentNumbersY = segmentCodesY + headerRowH;
        const segmentCountsY = segmentNumbersY + headerRowH;
        const segmentListsY = segmentCountsY + headerRowH + 2;
        const maxListHeight = pageHeight - footerReserved - segmentListsY;
        const maxLinesPerSegment = Math.max(
          1,
          Math.floor((maxListHeight - 2) / listLineH)
        );
        chunk.forEach((item, colIndex) => {
          const x = left + colIndex * (colWidth + colGap);
          doc.setLineWidth(0.2);
          doc.setDrawColor(40);
          doc.rect(x, segmentCodesY, colWidth, headerRowH);
          doc.rect(x, segmentNumbersY, colWidth, headerRowH);
          doc.rect(x, segmentCountsY, colWidth, headerRowH);
          doc.setFont(FONT, "bold");
          doc.setFontSize(8);
          doc.text(
            String(item.eventCode || "-"),
            x + colWidth / 2,
            segmentCodesY + 3.9,
            {
              align: "center"
            }
          );
          doc.setFont(FONT, "normal");
          doc.setFontSize(7.3);
          doc.text(
            `(${item.displayEventNumber})`,
            x + colWidth / 2,
            segmentNumbersY + 3.8,
            { align: "center" }
          );
          doc.setFont(FONT, "bold");
          doc.setFontSize(8.4);
          doc.text(
            String(item.count || 0),
            x + colWidth / 2,
            segmentCountsY + 3.9,
            {
              align: "center"
            }
          );
          const lines = item.list.slice(
            lineOffset,
            lineOffset + maxLinesPerSegment
          );
          const listHeight = Math.max(8, lines.length * listLineH + 2);
          doc.rect(x, segmentListsY, colWidth, listHeight);
          doc.setFont(FONT, "normal");
          doc.setFontSize(8);
          lines.forEach((code, lineIndex) => {
            doc.text(
              String(code || "-").toUpperCase(),
              x + colWidth / 2,
              segmentListsY + 3.5 + lineIndex * listLineH,
              { align: "center" }
            );
          });
        });
        lineOffset += maxLinesPerSegment;
      }
    });
    doc.addPage();
    let summaryY = drawPageFrame(" (Summary)");
    const dimensionLabelPlural = isInternational ? "Countries" : "Clubs";
    const totalDimensions = new Set(
      rows.map(
        (row) => isInternational ? row.country || "UNK" : (row.clubCode || row.clubName || "UNK").trim()
      )
    ).size;
    const totalBoats = rows.length;
    const totalCompetitors = rows.reduce(
      (sum, row) => sum + Number(row.athleteUnitCount || 1),
      0
    );
    (0, import_jspdf_autotable.default)(doc, {
      startY: summaryY,
      head: [[dimensionLabelPlural, "Events", "Boats", "Competitors"]],
      body: [
        [
          String(totalDimensions),
          String(events.length),
          String(totalBoats),
          String(totalCompetitors)
        ]
      ],
      theme: "grid",
      styles: {
        font: FONT,
        fontSize: 8,
        cellPadding: 1.1,
        lineColor: [60, 60, 60],
        lineWidth: 0.18,
        halign: "center"
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        halign: "center"
      },
      margin: { left: 60, right: 60, bottom: 38 }
    });
    const inferGroupLabel = (eventName, eventCode) => {
      const text = String(eventName || "").toLowerCase();
      const code = String(eventCode || "").trim().toUpperCase();
      const hasPara = /para/.test(text) || /^PR\d*/.test(code);
      const hasMasters = /masters?|veteran/.test(text);
      const hasLw = /(light|lw|lightweight)/.test(text);
      const hasWomen = /(women|female|w\b)/.test(text);
      const hasMen = /(men|male|m\b)/.test(text);
      const hasMixed = /mixed|mix/.test(text);
      if (hasPara && hasMixed) return "Para-Rowing Mixed";
      if (hasPara && hasWomen) return "Para-Rowing Women";
      if (hasPara && hasMen) return "Para-Rowing Men";
      if (hasMasters && hasMixed) return "Masters Mixed";
      if (hasMasters && hasWomen) return "Masters Women";
      if (hasMasters && hasMen) return "Masters Men";
      if (hasMasters) return "Masters";
      if (hasLw && hasWomen) return "Lightweight Women";
      if (hasLw && hasMen) return "Lightweight Men";
      if (hasMixed) return "Mixed";
      if (hasWomen) return "Women";
      if (hasMen) return "Men";
      return "Open";
    };
    const byGroup = /* @__PURE__ */ new Map();
    rows.forEach((row) => {
      const group = inferGroupLabel(row.eventName, row.eventCode);
      if (!byGroup.has(group)) {
        byGroup.set(group, {
          label: group,
          dimensions: /* @__PURE__ */ new Set(),
          boats: 0,
          competitors: 0
        });
      }
      const item = byGroup.get(group);
      item.dimensions.add(
        isInternational ? row.country || "UNK" : (row.clubCode || row.clubName || "UNK").trim()
      );
      item.boats += 1;
      item.competitors += Number(row.athleteUnitCount || 1);
    });
    const aggregateByPrefix = (prefix) => Array.from(byGroup.values()).reduce(
      (acc, item) => {
        if (String(item.label || "").toLowerCase().startsWith(prefix)) {
          acc.boats += Number(item.boats || 0);
          acc.competitors += Number(item.competitors || 0);
          item.dimensions.forEach((value) => acc.dimensions.add(value));
        }
        return acc;
      },
      { dimensions: /* @__PURE__ */ new Set(), boats: 0, competitors: 0 }
    );
    const mastersTotals = aggregateByPrefix("masters");
    const baseGroupSortOrder = /* @__PURE__ */ new Map([
      ["Lightweight Men", 1],
      ["Lightweight Women", 2],
      ["Men", 3],
      ["Women", 4],
      ["Mixed", 5],
      ["Para-Rowing Men", 6],
      ["Para-Rowing Women", 7],
      ["Para-Rowing Mixed", 8],
      ["Open", 9]
    ]);
    const groupRows = Array.from(byGroup.values()).filter(
      (item) => !String(item.label || "").toLowerCase().startsWith("masters")
    ).sort((a, b) => {
      const orderA = baseGroupSortOrder.get(a.label) || 99;
      const orderB = baseGroupSortOrder.get(b.label) || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.label.localeCompare(b.label);
    }).map((item) => [
      item.label,
      String(item.dimensions.size),
      String(item.boats),
      String(item.competitors)
    ]);
    if (mastersTotals.boats > 0 || mastersTotals.competitors > 0) {
      groupRows.push([
        "Masters",
        String(mastersTotals.dimensions.size),
        String(mastersTotals.boats),
        String(mastersTotals.competitors)
      ]);
    }
    if (groupRows.length) {
      summaryY = (doc.lastAutoTable?.finalY || summaryY) + 5;
      (0, import_jspdf_autotable.default)(doc, {
        startY: summaryY,
        head: [["Group", dimensionLabelPlural, "Boats", "Competitors"]],
        body: groupRows,
        theme: "grid",
        styles: {
          font: FONT,
          fontSize: 7.5,
          cellPadding: 1,
          lineColor: [60, 60, 60],
          lineWidth: 0.15
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineColor: [0, 0, 0],
          lineWidth: 0.18
        },
        columnStyles: {
          0: { cellWidth: 52, fontStyle: "bold" },
          1: { cellWidth: 24, halign: "center" },
          2: { cellWidth: 24, halign: "center" },
          3: { cellWidth: 28, halign: "center" }
        },
        margin: { left: 56, right: 56, bottom: 38 }
      });
    }
    const legendRows = events.map((event) => [
      String(event.eventCode || "-"),
      `(${event.displayEventNumber}) ${String(event.eventName || "-")}`,
      String(event.eventNameAr || "-")
    ]);
    let legendStartY = (doc.lastAutoTable?.finalY || summaryY) + 8;
    if (legendStartY > pageHeight - 75) {
      doc.addPage();
      legendStartY = drawPageFrame(" (Legend)");
    }
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Legend", left, legendStartY);
    (0, import_jspdf_autotable.default)(doc, {
      startY: legendStartY + 1,
      head: [["Code", "Event", "Event (AR)"]],
      body: legendRows,
      theme: "grid",
      styles: {
        font: FONT,
        fontSize: 7,
        cellPadding: 0.9,
        lineColor: [60, 60, 60],
        lineWidth: 0.12,
        overflow: "linebreak"
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        lineColor: [0, 0, 0],
        lineWidth: 0.16
      },
      columnStyles: {
        0: { cellWidth: 24, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 78 },
        2: { cellWidth: 80, halign: "right" }
      },
      didParseCell: (data) => {
        if (arabicFontName && data.section === "body" && data.column.index === 2) {
          data.cell.styles.font = arabicFontName;
          data.cell.styles.fontStyle = "normal";
          data.cell.styles.halign = "right";
        }
      },
      margin: { left, right: 14, bottom: 38 }
    });
    paintChrome(doc, {
      headerData,
      footerData,
      sponsorData,
      asOfLabel,
      pageLabelStyle: "of"
    });
    doc.save(buildEntriesReportPdfFileName("EntriesByEvent", competition));
    return true;
  }
  async function exportNumberOfEntriesByClubPdf({
    competition,
    rows,
    isInternational = false,
    globalJourneyFilter = null
  }) {
    const scopeDimensionLabel = isInternational ? "Country" : "Club";
    const byDimension = /* @__PURE__ */ new Map();
    rows.forEach((row) => {
      const key = isInternational ? row.country || "UNK" : (row.clubCode || "UNK").trim();
      const current = byDimension.get(key) || {
        label: key,
        entries: 0,
        athletes: 0,
        athleteKeys: /* @__PURE__ */ new Set(),
        clubs: /* @__PURE__ */ new Set(),
        events: /* @__PURE__ */ new Set(),
        clubNameFr: "",
        clubNameAr: ""
      };
      current.entries += 1;
      if (Array.isArray(row.athleteKeys) && row.athleteKeys.length) {
        row.athleteKeys.forEach(
          (athleteKey) => current.athleteKeys.add(String(athleteKey))
        );
      } else {
        current.athletes += Number(row.athleteUnitCount || 1);
      }
      current.clubs.add(row.clubCode || row.clubName || "-");
      current.events.add(`${row.eventCode} - ${row.eventName}`);
      if (!current.clubNameFr && row.clubNameFr)
        current.clubNameFr = row.clubNameFr;
      if (!current.clubNameAr && row.clubNameAr)
        current.clubNameAr = row.clubNameAr;
      byDimension.set(key, current);
    });
    byDimension.forEach((row) => {
      row.athletes = row.athleteKeys.size + Number(row.athletes || 0);
    });
    const summaryRows = Array.from(byDimension.values()).sort(
      (a, b) => b.entries - a.entries || a.label.localeCompare(b.label)
    );
    if (!summaryRows.length) return false;
    const asOfLabel = formatAsOfLabel();
    const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);
    const [headerData, footerData, sponsorData, arabicFontBase64] = await Promise.all([
      loadImage("/header.png"),
      loadImage("/footer.png"),
      loadImage("/sponsors.png"),
      loadFont("/fonts/Amiri-Regular.ttf")
    ]);
    const doc = new import_jspdf.default({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });
    const arabicFontName = registerArabicFont(doc, arabicFontBase64);
    const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
    const headerHeight = computeHeaderHeight(doc, headerData);
    const compLocation = resolveCompLocation(competition);
    const competitionTitle = resolveCompetitionTitle(competition);
    let yPos = headerHeight;
    doc.setFontSize(14);
    doc.setFont(FONT, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(competitionTitle, center, yPos, { align: "center" });
    doc.setFontSize(9);
    doc.setFont(FONT, "normal");
    doc.text(compLocation, left, yPos);
    doc.text(eventDateStr, right, yPos, { align: "right" });
    yPos += 2;
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(left, yPos, right, yPos);
    yPos += 6;
    const reportTitle = `Number of Entries by ${scopeDimensionLabel}`;
    doc.setFontSize(12);
    doc.setFont(FONT, "bold");
    doc.text(reportTitle, center, yPos, { align: "center" });
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont(FONT, "normal");
    doc.setTextColor(90);
    doc.text(asOfLabel, left, yPos);
    yPos += 2;
    const globalHead = isInternational ? ["Nbr", scopeDimensionLabel, "Athletes", "Entries", "Clubs"] : [
      "Nbr",
      "Club",
      "Club (FR)",
      "Club (AR)",
      "Athletes",
      "Entries",
      "Events"
    ];
    const globalBody = summaryRows.map(
      (row, index) => isInternational ? [
        String(index + 1),
        row.label,
        String(row.athletes || 0),
        String(row.entries),
        String(row.clubs.size)
      ] : [
        String(index + 1),
        row.label,
        row.clubNameFr || "-",
        row.clubNameAr || "-",
        String(row.athletes || 0),
        String(row.entries),
        String(row.events.size)
      ]
    );
    const totalAthletesGlobal = summaryRows.reduce(
      (sum, row) => sum + Number(row.athletes || 0),
      0
    );
    const totalEntriesGlobal = summaryRows.reduce(
      (sum, row) => sum + Number(row.entries || 0),
      0
    );
    const totalEventGroups = new Set(
      rows.map((row) => `${row.eventCode || "-"}||${row.eventName || "-"}`)
    ).size;
    const totalLastColumnGlobal = summaryRows.reduce(
      (sum, row) => sum + Number(isInternational ? row.clubs?.size || 0 : 0),
      0
    );
    globalBody.push(
      isInternational ? [
        "",
        "Total",
        String(totalAthletesGlobal),
        String(totalEntriesGlobal),
        String(totalLastColumnGlobal)
      ] : [
        "",
        "Total",
        "",
        "",
        String(totalAthletesGlobal),
        String(totalEntriesGlobal),
        String(totalEventGroups)
      ]
    );
    const globalColumnStyles = isInternational ? {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 96 },
      2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 20, halign: "center", fontStyle: "bold" }
    } : {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 50 },
      3: { cellWidth: 52 },
      4: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 16, halign: "center", fontStyle: "bold" }
    };
    (0, import_jspdf_autotable.default)(doc, {
      startY: yPos,
      head: [globalHead],
      body: globalBody,
      theme: "grid",
      styles: {
        font: FONT,
        fontSize: 8,
        cellPadding: 1.2,
        lineColor: [105, 105, 105],
        lineWidth: 0.18,
        overflow: "linebreak"
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        lineColor: [0, 0, 0],
        lineWidth: 0.22
      },
      columnStyles: globalColumnStyles,
      margin: { left, right: 14, bottom: 35, top: headerHeight },
      didParseCell: (data) => {
        const totalRowIndex = globalBody.length - 1;
        if (data.section === "body" && data.row.index === totalRowIndex) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 247, 250];
        }
        if (!isInternational && arabicFontName && data.section === "body" && data.column.index === 3) {
          data.cell.styles.font = arabicFontName;
          data.cell.styles.fontStyle = "normal";
          data.cell.styles.halign = "right";
        }
      }
    });
    const dimensionLabelForRow = (row) => isInternational ? row.country || "UNK" : (row.clubCode || "UNK").trim();
    const eventMetaMap = /* @__PURE__ */ new Map();
    rows.forEach((row) => {
      const key = `${row.eventCode}||${row.eventName}`;
      const rowEventNumber = Number(row.eventNumber);
      const normalizedEventNumber = Number.isFinite(rowEventNumber) && rowEventNumber > 0 ? rowEventNumber : null;
      if (!eventMetaMap.has(key)) {
        eventMetaMap.set(key, {
          key,
          code: row.eventCode || "-",
          name: row.eventName || "-",
          eventNumber: normalizedEventNumber
        });
        return;
      }
      const existing = eventMetaMap.get(key);
      if (normalizedEventNumber != null) {
        existing.eventNumber = existing.eventNumber == null ? normalizedEventNumber : Math.min(existing.eventNumber, normalizedEventNumber);
      }
    });
    const eventMeta = Array.from(eventMetaMap.values()).sort((a, b) => {
      const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
      const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
      if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
      return `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`);
    }).map((event, index) => ({
      ...event,
      displayEventNumber: Number.isFinite(Number(event.eventNumber)) && Number(event.eventNumber) > 0 ? Number(event.eventNumber) : index + 1
    }));
    const matrixCounts = /* @__PURE__ */ new Map();
    const dimensionAthleteTotals = /* @__PURE__ */ new Map();
    rows.forEach((row) => {
      const dimension = dimensionLabelForRow(row);
      const eventKey = `${row.eventCode}||${row.eventName}`;
      const athleteUnits = Number(row.athleteUnitCount || 1);
      if (!matrixCounts.has(dimension)) matrixCounts.set(dimension, /* @__PURE__ */ new Map());
      const bucket = matrixCounts.get(dimension);
      bucket.set(eventKey, (bucket.get(eventKey) || 0) + athleteUnits);
      dimensionAthleteTotals.set(
        dimension,
        (dimensionAthleteTotals.get(dimension) || 0) + athleteUnits
      );
    });
    const orderedDimensions = summaryRows.map((item) => item.label);
    const grandTotal = Array.from(dimensionAthleteTotals.values()).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );
    const codeForDimension = (value) => {
      const text = String(value || "").trim();
      if (!text) return "UNK";
      const match = text.match(/[A-Za-z0-9]{2,4}/);
      return (match ? match[0] : text.slice(0, 4)).toUpperCase();
    };
    const usableWidthForMatrix = right - left;
    const firstColWidthForMatrix = isInternational ? 26 : 22;
    const codeColWidthForMatrix = 14;
    const totalColWidthForMatrix = 10;
    const availableEventWidth = usableWidthForMatrix - firstColWidthForMatrix - codeColWidthForMatrix - totalColWidthForMatrix;
    doc.setFont(FONT, "bold");
    doc.setFontSize(6);
    const eventMetaWithWidth = eventMeta.map((event) => {
      const codeWidth = doc.getTextWidth(String(event.code || "-"));
      const eventNumberWidth = doc.getTextWidth(`(${event.displayEventNumber})`);
      const desiredWidth = Math.max(codeWidth, eventNumberWidth) + 2.2;
      return { ...event, colWidth: Math.max(5.4, Math.min(11, desiredWidth)) };
    });
    const eventChunks = [];
    let currentChunk = [];
    let currentChunkWidth = 0;
    eventMetaWithWidth.forEach((event) => {
      if (currentChunk.length > 0 && currentChunkWidth + event.colWidth > availableEventWidth) {
        eventChunks.push(currentChunk);
        currentChunk = [];
        currentChunkWidth = 0;
      }
      currentChunk.push(event);
      currentChunkWidth += event.colWidth;
    });
    if (currentChunk.length > 0) eventChunks.push(currentChunk);
    if (!eventChunks.length) eventChunks.push([]);
    const drawMatrixPageHeader = () => {
      let y = headerHeight;
      doc.setFontSize(14);
      doc.setFont(FONT, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(competitionTitle, center, y, { align: "center" });
      doc.setFontSize(9);
      doc.setFont(FONT, "normal");
      doc.text(compLocation, left, y);
      doc.text(eventDateStr, right, y, { align: "right" });
      y += 2;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0);
      doc.line(left, y, right, y);
      y += 6;
      return y;
    };
    doc.addPage();
    let nextMatrixStartY = drawMatrixPageHeader();
    eventChunks.forEach((chunk, chunkIndex) => {
      const matrixTitle = reportTitle;
      const estimatedRows = orderedDimensions.length + 2;
      const estimatedChunkHeight = 8 + estimatedRows * 4;
      if (nextMatrixStartY + estimatedChunkHeight > pageHeight - 38) {
        doc.addPage();
        nextMatrixStartY = drawMatrixPageHeader();
      }
      let matrixY = nextMatrixStartY;
      doc.setFontSize(12);
      doc.setFont(FONT, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        eventChunks.length > 1 ? `${matrixTitle} (${chunkIndex + 1}/${eventChunks.length})` : matrixTitle,
        center,
        matrixY,
        { align: "center" }
      );
      matrixY += 4;
      doc.setFontSize(8);
      doc.setFont(FONT, "normal");
      doc.setTextColor(90);
      doc.text(asOfLabel, left, matrixY);
      matrixY += 2;
      const matrixColumnStyles = {
        0: { cellWidth: firstColWidthForMatrix, fontStyle: "bold" },
        [chunk.length + 1]: {
          cellWidth: codeColWidthForMatrix,
          halign: "center",
          fontStyle: "bold"
        },
        [chunk.length + 2]: {
          cellWidth: totalColWidthForMatrix,
          halign: "center",
          fontStyle: "bold"
        }
      };
      chunk.forEach((event, idx) => {
        matrixColumnStyles[idx + 1] = {
          cellWidth: event.colWidth,
          halign: "center"
        };
      });
      const matrixBody = orderedDimensions.map((dimension) => {
        const bucket = matrixCounts.get(dimension) || /* @__PURE__ */ new Map();
        const chunkValues = chunk.map((event) => bucket.get(event.key) || 0);
        const rowTotal = Number(dimensionAthleteTotals.get(dimension) || 0);
        return [
          dimension,
          ...chunkValues.map((value) => value > 0 ? String(value) : ""),
          codeForDimension(dimension),
          String(rowTotal)
        ];
      });
      const chunkTotals = chunk.map(
        (event) => orderedDimensions.reduce((sum, dimension) => {
          const bucket = matrixCounts.get(dimension) || /* @__PURE__ */ new Map();
          return sum + (bucket.get(event.key) || 0);
        }, 0)
      );
      matrixBody.push([
        "Total",
        ...chunkTotals.map((value) => value > 0 ? String(value) : "0"),
        "",
        String(grandTotal)
      ]);
      (0, import_jspdf_autotable.default)(doc, {
        startY: matrixY,
        head: [
          [
            isInternational ? "Country" : "Club",
            ...chunk.map(
              (event) => `${event.code}
(${event.displayEventNumber})`
            ),
            isInternational ? "Ctry\nCode" : "Club\nCode",
            "Total"
          ]
        ],
        body: matrixBody,
        theme: "grid",
        styles: {
          font: FONT,
          fontSize: 6,
          cellPadding: 0.8,
          lineColor: [50, 50, 50],
          lineWidth: 0.1,
          overflow: "linebreak"
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          halign: "center"
        },
        columnStyles: matrixColumnStyles,
        margin: { left, right: 14, bottom: 35, top: headerHeight },
        didParseCell: (data) => {
          const totalRowIndex = matrixBody.length - 1;
          if (data.section === "body" && data.row.index === totalRowIndex) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [245, 247, 250];
          }
        }
      });
      nextMatrixStartY = (doc.lastAutoTable?.finalY || matrixY) + 6;
    });
    paintChrome(doc, {
      headerData,
      footerData,
      sponsorData,
      asOfLabel,
      pageLabelStyle: "of"
    });
    doc.save(
      buildEntriesReportPdfFileName(
        isInternational ? "NumberOfEntriesByCountry" : "NumberOfEntriesByClub",
        competition
      )
    );
    return true;
  }
  async function exportEntryListByClubPdf({
    competition,
    raceRows,
    isInternational = false,
    globalJourneyFilter = null
  }) {
    const scopeDimensionLabel = isInternational ? "Country" : "Club";
    if (!raceRows.length) return false;
    const asOfLabel = formatAsOfLabel();
    const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);
    const [headerData, footerData, sponsorData] = await Promise.all([
      loadImage("/header.png"),
      loadImage("/footer.png"),
      loadImage("/sponsors.png")
    ]);
    const doc = new import_jspdf.default({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });
    const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
    const headerHeight = computeHeaderHeight(doc, headerData);
    const compLocation = resolveCompLocation(competition);
    const competitionTitle = resolveCompetitionTitle(competition);
    const grouped = /* @__PURE__ */ new Map();
    raceRows.forEach((row) => {
      if (!grouped.has(row.dimensionKey)) {
        grouped.set(row.dimensionKey, {
          key: row.dimensionKey,
          title: row.dimensionTitle,
          rows: [],
          crews: 0,
          athletes: 0
        });
      }
      const bucket = grouped.get(row.dimensionKey);
      bucket.rows.push(row);
      bucket.crews += Number(row.crewCount || 0);
      bucket.athletes += Number(row.athleteCount || 0);
    });
    const sections = Array.from(grouped.values()).map((section) => ({
      ...section,
      rows: section.rows.sort((a, b) => {
        const numA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
        const numB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
        if (numA !== numB) return numA - numB;
        const codeCompare = `${a.eventCode}`.localeCompare(`${b.eventCode}`);
        if (codeCompare !== 0) return codeCompare;
        return Number(a.rowSequence || 0) - Number(b.rowSequence || 0);
      })
    })).sort((a, b) => a.key.localeCompare(b.key));
    const legendEventMap = /* @__PURE__ */ new Map();
    raceRows.forEach((row) => {
      const key = `${row.eventCode}||${row.eventName}`;
      if (!legendEventMap.has(key)) {
        legendEventMap.set(key, {
          code: String(row.eventCode || "-").toUpperCase(),
          name: String(row.eventName || "-"),
          eventNumber: Number(row.eventNumber || Number.MAX_SAFE_INTEGER)
        });
        return;
      }
      const existing = legendEventMap.get(key);
      const candidateNum = Number(row.eventNumber || Number.MAX_SAFE_INTEGER);
      if (candidateNum < existing.eventNumber)
        existing.eventNumber = candidateNum;
    });
    const legendEvents = Array.from(legendEventMap.values()).sort((a, b) => {
      if (a.eventNumber !== b.eventNumber) return a.eventNumber - b.eventNumber;
      return a.code.localeCompare(b.code);
    });
    const femaleLegend = [];
    const maleLegend = [];
    legendEvents.forEach((item) => {
      const code = String(item.code || "").toUpperCase();
      const name = String(item.name || "").toLowerCase();
      const isFemale = /women|female/.test(name) || /^(W|LW(?!M)|PR\d?W)/.test(code);
      const isMale = /men|male/.test(name) || /^(M|LM|PR\d?M)/.test(code);
      const row = { code: item.code, label: item.name };
      if (isFemale && !isMale) femaleLegend.push(row);
      else if (isMale && !isFemale) maleLegend.push(row);
      else if (femaleLegend.length <= maleLegend.length) femaleLegend.push(row);
      else maleLegend.push(row);
    });
    const splitInTwo = (items) => {
      const mid = Math.ceil(items.length / 2);
      return [items.slice(0, mid), items.slice(mid)];
    };
    const [femaleCol1, femaleCol2] = splitInTwo(femaleLegend);
    const [maleCol1, maleCol2] = splitInTwo(maleLegend);
    const hasBowSeat = raceRows.some(
      (row) => /\(b\)/i.test(String(row.seat || ""))
    );
    const hasStrokeSeat = raceRows.some(
      (row) => /\(s\)/i.test(String(row.seat || ""))
    );
    const hasCoxSeat = raceRows.some(
      (row) => /\(c\)/i.test(String(row.seat || "")) || /\bcox\b/i.test(String(row.athleteName || ""))
    );
    const seatLegendItems = [];
    if (hasBowSeat) seatLegendItems.push("b bow");
    if (hasStrokeSeat) seatLegendItems.push("s stroke");
    if (hasCoxSeat) seatLegendItems.push("c cox");
    const drawWrLegendBlock = (footerTopY) => {
      const legendX = left;
      const legendW = right - left;
      const headerH = 5.4;
      const rowH = 2.45;
      const maxRows = Math.max(
        femaleCol1.length,
        femaleCol2.length,
        maleCol1.length,
        maleCol2.length,
        1
      );
      const seatRowH = seatLegendItems.length > 0 ? 3 : 0;
      const legendH = headerH + maxRows * rowH + 1.4 + seatRowH;
      const legendY = footerTopY - legendH - 7;
      const centerGapCompression = 8;
      const sideGap = 0;
      const colW = (legendW + centerGapCompression - sideGap * 2) / 4;
      const codeColOffset = 0.6;
      const labelColOffset = 9.6;
      const x0 = legendX;
      const x1 = x0 + colW + sideGap;
      const x2 = x1 + colW - centerGapCompression;
      const x3 = x2 + colW + sideGap;
      const cols = [
        { x: x0, data: femaleCol1 },
        { x: x1, data: maleCol1 },
        { x: x2, data: femaleCol2 },
        { x: x3, data: maleCol2 }
      ];
      doc.setDrawColor(70);
      doc.setLineWidth(0.16);
      doc.rect(legendX, legendY, legendW, legendH);
      doc.setFont(FONT, "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(0);
      doc.text("Legend:", legendX + 1.4, legendY + 2.8);
      doc.setFont(FONT, "normal");
      doc.setFontSize(6);
      doc.text("F", x0 + 1.4, legendY + 5);
      doc.text("Female", x0 + 5.6, legendY + 5);
      doc.text("M", x1 + 1.4, legendY + 5);
      doc.text("Male", x1 + 5.6, legendY + 5);
      doc.text("F", x2 + 1.4, legendY + 5);
      doc.text("Female", x2 + 5.6, legendY + 5);
      doc.text("M", x3 + 1.4, legendY + 5);
      doc.text("Male", x3 + 5.6, legendY + 5);
      const toSingleLine = (text, maxWidth) => {
        const value = String(text || "");
        if (!value) return "";
        if (doc.getTextWidth(value) <= maxWidth) return value;
        const ellipsis = "...";
        let trimmed = value;
        while (trimmed.length > 0) {
          const candidate = `${trimmed}${ellipsis}`;
          if (doc.getTextWidth(candidate) <= maxWidth) return candidate;
          trimmed = trimmed.slice(0, -1);
        }
        return ellipsis;
      };
      doc.setFontSize(5.8);
      cols.forEach((col) => {
        col.data.forEach((item, idx) => {
          const y = legendY + headerH + 1.45 + idx * rowH;
          if (!item?.code && !item?.label) return;
          doc.setFont(FONT, "normal");
          doc.text(`${item.code || ""}`, col.x + codeColOffset, y);
          const labelMaxWidth = colW - labelColOffset - 0.4;
          doc.text(
            toSingleLine(item.label, labelMaxWidth),
            col.x + labelColOffset,
            y
          );
        });
      });
      if (seatLegendItems.length > 0) {
        const seatY = legendY + headerH + maxRows * rowH + 2.2;
        const seatText = seatLegendItems.join("   ");
        doc.setFontSize(6.2);
        doc.setFont(FONT, "normal");
        doc.text(seatText, legendX + 1.6, seatY);
      }
    };
    const drawPageHeader = () => {
      let y = headerHeight;
      doc.setFontSize(14);
      doc.setFont(FONT, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(competitionTitle, center, y, { align: "center" });
      doc.setFontSize(9);
      doc.setFont(FONT, "normal");
      doc.text(compLocation, left, y);
      doc.text(eventDateStr, right, y, { align: "right" });
      y += 2;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0);
      doc.line(left, y, right, y);
      y += 4;
      doc.setFontSize(12);
      doc.setFont(FONT, "bold");
      doc.text(`Entry List by ${scopeDimensionLabel}`, center, y, {
        align: "center"
      });
      y += 4.5;
      doc.setFontSize(9);
      doc.setFont(FONT, "bold");
      doc.text(asOfLabel.replace(":", ""), center, y, { align: "center" });
      y += 3.5;
      doc.setLineWidth(0.28);
      doc.setDrawColor(0);
      doc.line(left, y, right, y);
      return y + 4.5;
    };
    sections.forEach((section, sectionIdx) => {
      if (sectionIdx > 0) doc.addPage();
      let yPos = drawPageHeader();
      doc.setFontSize(11);
      doc.setFont(FONT, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(section.title, center, yPos, { align: "center" });
      yPos += 5;
      let previousEventKey = null;
      const tableBody = section.rows.map((row) => {
        const eventKey = `${row.eventCode}||${row.eventNumber || ""}`;
        const isEventStart = eventKey !== previousEventKey;
        previousEventKey = eventKey;
        return {
          eventCode: isEventStart ? String(row.eventCode || "-") : "",
          eventNumber: isEventStart && row.eventNumber ? String(row.eventNumber) : "",
          seat: String(row.seat || ""),
          athleteName: String(row.athleteName || "-"),
          birthDate: String(row.birthDate || ""),
          isEventStart
        };
      });
      (0, import_jspdf_autotable.default)(doc, {
        startY: yPos,
        columns: [
          { header: "Event Code", dataKey: "eventCode" },
          { header: "Event Number", dataKey: "eventNumber" },
          { header: "Seat", dataKey: "seat" },
          { header: "Name", dataKey: "athleteName" },
          { header: "Date of Birth", dataKey: "birthDate" }
        ],
        body: tableBody,
        theme: "plain",
        styles: {
          font: FONT,
          fontSize: 8,
          cellPadding: 0.55,
          lineWidth: 0,
          textColor: [20, 20, 20]
        },
        headStyles: {
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fillColor: [255, 255, 255],
          cellPadding: 0.5
        },
        columnStyles: {
          0: { cellWidth: 24, halign: "left", fontStyle: "bold" },
          1: { cellWidth: 24, halign: "center" },
          2: { cellWidth: 15, halign: "center" },
          3: { cellWidth: 76 },
          4: { cellWidth: 41 }
        },
        margin: { left, right: 14, bottom: 66 },
        didDrawCell: (data) => {
          if (data.section === "head" && data.column.index === 0) {
            const yLine = data.cell.y + data.cell.height;
            doc.setDrawColor(0);
            doc.setLineWidth(0.25);
            doc.line(left, yLine, right, yLine);
          }
          if (data.section === "body" && data.column.index === 0 && data.row.index > 0 && data.row.raw?.isEventStart) {
            doc.setDrawColor(0);
            doc.setLineWidth(0.18);
            doc.line(left, data.cell.y, right, data.cell.y);
          }
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.row?.raw && !data.row.raw.isEventStart) {
            data.cell.styles.cellPadding = {
              top: 0.2,
              right: 0.55,
              bottom: 0.2,
              left: 0.55
            };
          }
        }
      });
      const afterTableY = (doc.lastAutoTable?.finalY || yPos) + 4;
      doc.setFontSize(9);
      doc.setFont(FONT, "bold");
      doc.text("Crews:", left, afterTableY);
      doc.text(String(section.crews), left + 18, afterTableY);
      doc.text("Athletes:", left + 48, afterTableY);
      doc.text(String(section.athletes), left + 72, afterTableY);
    });
    paintChrome(doc, {
      headerData,
      footerData,
      sponsorData,
      asOfLabel,
      pageLabelStyle: "slash",
      legendPainter: drawWrLegendBlock
    });
    doc.save(
      buildEntriesReportPdfFileName(
        isInternational ? "EntryListByCountry" : "EntryListByClub",
        competition
      )
    );
    return true;
  }

  // src/pages/BeachSprintCompetition.jsx
  var API_BASE_URL = "";
  var PHASE_NAMES = {
    time_trial: "Time Trial",
    repechage: "Repechage",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    final_b: "Final B",
    final_a: "Final A"
  };
  var PHASE_ORDER = [
    "time_trial",
    "repechage",
    "quarterfinal",
    "semifinal",
    "final_b",
    "final_a"
  ];
  var STATUS_STYLES = {
    pending: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700"
  };
  var MEDAL_EMOJI = {
    gold: "\u{1F947}",
    silver: "\u{1F948}",
    bronze: "\u{1F949}"
  };
  var formatAthleteName = (athlete) => {
    if (!athlete) return "";
    return [athlete.firstName, athlete.lastName].filter(Boolean).join(" ");
  };
  var EventCard = ({ event, onSelect, onDelete }) => {
    const statusLabel = {
      pending: "Not Started",
      in_progress: "In Progress",
      completed: "Completed"
    };
    return /* @__PURE__ */ import_react5.default.createElement(
      "div",
      {
        className: "bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer",
        onClick: () => onSelect(event)
      },
      /* @__PURE__ */ import_react5.default.createElement("div", { className: "p-4" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex justify-between items-start mb-2" }, /* @__PURE__ */ import_react5.default.createElement("h3", { className: "font-semibold text-slate-900" }, event.name), /* @__PURE__ */ import_react5.default.createElement(
        "span",
        {
          className: `px-2 py-0.5 text-xs font-medium rounded ${STATUS_STYLES[event.status]}`
        },
        statusLabel[event.status]
      )), /* @__PURE__ */ import_react5.default.createElement("div", { className: "text-sm text-slate-600 space-y-1" }, /* @__PURE__ */ import_react5.default.createElement("p", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-medium" }, "Category:"), " ", event.category?.titles?.en || event.category?.abbreviation || "-"), /* @__PURE__ */ import_react5.default.createElement("p", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-medium" }, "Boat:"), " ", event.boatClass?.names?.en || event.boatClass?.code || "-"), /* @__PURE__ */ import_react5.default.createElement("p", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-medium" }, "Phase:"), " ", PHASE_NAMES[event.currentPhase] || event.currentPhase)), event.status === "completed" && event.medals && /* @__PURE__ */ import_react5.default.createElement("div", { className: "mt-3 pt-3 border-t border-slate-100" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex gap-4 text-sm" }, event.medals.gold?.club && /* @__PURE__ */ import_react5.default.createElement("span", null, MEDAL_EMOJI.gold, " ", event.medals.gold.club.name), event.medals.silver?.club && /* @__PURE__ */ import_react5.default.createElement("span", null, MEDAL_EMOJI.silver, " ", event.medals.silver.club.name), event.medals.bronze?.club && /* @__PURE__ */ import_react5.default.createElement("span", null, MEDAL_EMOJI.bronze, " ", event.medals.bronze.club.name)))),
      /* @__PURE__ */ import_react5.default.createElement("div", { className: "px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-end" }, /* @__PURE__ */ import_react5.default.createElement(
        Button,
        {
          variant: "outline",
          size: "sm",
          className: "text-red-600",
          onClick: (e) => {
            e.stopPropagation();
            onDelete(event);
          }
        },
        "Delete"
      ))
    );
  };
  var RaceCard = ({ race, onRecordResults, onEdit }) => {
    const isCompleted = race.status === "completed";
    return /* @__PURE__ */ import_react5.default.createElement(
      "div",
      {
        className: `bg-white rounded-lg border ${isCompleted ? "border-green-200" : "border-slate-200"} p-4`
      },
      /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex justify-between items-center mb-3" }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-semibold text-slate-900" }, race.raceCode), /* @__PURE__ */ import_react5.default.createElement("span", { className: "ml-2 text-sm text-slate-500" }, PHASE_NAMES[race.phase], " ", race.heatNumber > 1 ? `#${race.heatNumber}` : "")), /* @__PURE__ */ import_react5.default.createElement(
        "span",
        {
          className: `px-2 py-0.5 text-xs font-medium rounded ${isCompleted ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`
        },
        isCompleted ? "Completed" : "Scheduled"
      )),
      /* @__PURE__ */ import_react5.default.createElement("div", { className: "space-y-2" }, race.lanes.map((lane, idx) => /* @__PURE__ */ import_react5.default.createElement(
        "div",
        {
          key: idx,
          className: `flex items-center justify-between p-2 rounded ${isCompleted && lane.position === 1 ? "bg-yellow-50" : "bg-slate-50"}`
        },
        /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "w-6 h-6 flex items-center justify-center bg-white rounded text-sm font-medium" }, lane.lane), /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-medium" }, lane.athlete?.firstName, " ", lane.athlete?.lastName, lane.crew?.length > 0 && lane.crew.map((a) => ` ${a.firstName}`).join(",")), lane.club && /* @__PURE__ */ import_react5.default.createElement("span", { className: "ml-2 text-sm text-slate-500" }, "(", lane.club.shortName || lane.club.name, ")"))),
        /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center gap-3" }, isCompleted && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, lane.position && /* @__PURE__ */ import_react5.default.createElement(
          "span",
          {
            className: `font-bold ${lane.position === 1 ? "text-yellow-600" : "text-slate-700"}`
          },
          "P",
          lane.position
        ), /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-mono text-sm" }, lane.time || "-"), lane.status !== "ok" && /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-xs font-medium text-red-600 uppercase" }, lane.status)))
      ))),
      !isCompleted && /* @__PURE__ */ import_react5.default.createElement("div", { className: "mt-3 pt-3 border-t border-slate-100" }, /* @__PURE__ */ import_react5.default.createElement(Button, { size: "sm", onClick: () => onRecordResults(race) }, "Record Results"))
    );
  };
  var ResultsDialog = ({ race, onSave, onCancel }) => {
    const [results, setResults] = (0, import_react5.useState)(
      race.lanes.map((lane) => ({
        lane: lane.lane,
        time: lane.time || "",
        status: lane.status || "ok"
      }))
    );
    const [saving, setSaving] = (0, import_react5.useState)(false);
    const handleTimeChange = (laneNum, time) => {
      setResults(
        (prev) => prev.map((r2) => r2.lane === laneNum ? { ...r2, time } : r2)
      );
    };
    const handleStatusChange = (laneNum, status) => {
      setResults(
        (prev) => prev.map((r2) => r2.lane === laneNum ? { ...r2, status } : r2)
      );
    };
    const handleSubmit = async () => {
      setSaving(true);
      try {
        await onSave(results);
      } finally {
        setSaving(false);
      }
    };
    return /* @__PURE__ */ import_react5.default.createElement("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "bg-white rounded-lg shadow-xl max-w-md w-full" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "px-6 py-4 border-b border-slate-200" }, /* @__PURE__ */ import_react5.default.createElement("h2", { className: "text-xl font-semibold text-slate-900" }, "Record Results - ", race.raceCode)), /* @__PURE__ */ import_react5.default.createElement("div", { className: "p-6 space-y-4" }, race.lanes.map((lane, idx) => /* @__PURE__ */ import_react5.default.createElement("div", { key: idx, className: "flex items-center gap-4" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "w-8 h-8 flex items-center justify-center bg-slate-100 rounded font-medium" }, lane.lane), /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex-1" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-sm font-medium" }, lane.athlete?.firstName, " ", lane.athlete?.lastName), /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs text-slate-500" }, lane.club?.name)), /* @__PURE__ */ import_react5.default.createElement(
      Input,
      {
        type: "text",
        placeholder: "MM:SS.cc",
        className: "w-24 font-mono text-center",
        value: results.find((r2) => r2.lane === lane.lane)?.time || "",
        onChange: (e) => handleTimeChange(lane.lane, e.target.value)
      }
    ), /* @__PURE__ */ import_react5.default.createElement(
      Select,
      {
        className: "w-20",
        value: results.find((r2) => r2.lane === lane.lane)?.status || "ok",
        onChange: (e) => handleStatusChange(lane.lane, e.target.value)
      },
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "ok" }, "OK"),
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "dns" }, "DNS"),
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "dnf" }, "DNF"),
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "dsq" }, "DSQ")
    )))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "px-6 py-4 border-t border-slate-200 flex justify-end gap-3" }, /* @__PURE__ */ import_react5.default.createElement(Button, { variant: "outline", onClick: onCancel }, "Cancel"), /* @__PURE__ */ import_react5.default.createElement(Button, { onClick: handleSubmit, disabled: saving }, saving ? "Saving..." : "Save Results"))));
  };
  var CreateEventDialog = ({ competition, onSave, onCancel }) => {
    const { token } = useAuth();
    const [form, setForm] = (0, import_react5.useState)({
      name: "",
      boatClassId: "",
      categoryId: "",
      gender: "M",
      progressionConfig: {
        hasRepechage: true,
        timeTrialDirectAdvance: 4,
        timeTrialToRepechage: 4,
        repechageAdvance: 2
      }
    });
    const [boatClasses, setBoatClasses] = (0, import_react5.useState)([]);
    const [categories, setCategories] = (0, import_react5.useState)([]);
    const [saving, setSaving] = (0, import_react5.useState)(false);
    const allowedBoatClassIds = competition?.allowedBoatClasses?.map(
      (bc) => typeof bc === "string" ? bc : bc._id
    ) || [];
    const allowedCategoryIds = competition?.allowedCategories?.map(
      (cat) => typeof cat === "string" ? cat : cat._id
    ) || [];
    (0, import_react5.useEffect)(() => {
      const fetchData = async () => {
        try {
          const [bcRes, catRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/boat-classes`, {
              headers: { Authorization: `Bearer ${token}` }
            }),
            fetch(`${API_BASE_URL}/api/categories`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ]);
          if (bcRes.ok) {
            const bcData = await bcRes.json();
            const allBoatClasses = Array.isArray(bcData) ? bcData : bcData.data || [];
            const filtered = allowedBoatClassIds.length > 0 ? allBoatClasses.filter(
              (bc) => allowedBoatClassIds.includes(bc._id)
            ) : allBoatClasses;
            setBoatClasses(filtered);
          }
          if (catRes.ok) {
            const catData = await catRes.json();
            const allCategories = Array.isArray(catData) ? catData : catData.data || [];
            const filtered = allowedCategoryIds.length > 0 ? allCategories.filter(
              (cat) => allowedCategoryIds.includes(cat._id)
            ) : allCategories;
            setCategories(filtered);
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      };
      if (token) fetchData();
    }, [token, allowedBoatClassIds.length, allowedCategoryIds.length]);
    const filteredCategories = categories.filter((cat) => {
      if (cat.gender === "mixed") return true;
      if (form.gender === "M" && cat.gender === "men") return true;
      if (form.gender === "F" && cat.gender === "women") return true;
      if (form.gender === "Mixed" && cat.gender === "mixed") return true;
      return false;
    });
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name || !form.boatClassId || !form.categoryId) {
        import_react_toastify.toast.error("Please fill all required fields");
        return;
      }
      setSaving(true);
      try {
        await onSave({
          ...form,
          competitionId: competition._id
        });
      } finally {
        setSaving(false);
      }
    };
    return /* @__PURE__ */ import_react5.default.createElement("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "px-6 py-4 border-b border-slate-200" }, /* @__PURE__ */ import_react5.default.createElement("h2", { className: "text-xl font-semibold text-slate-900" }, "Create Beach Sprint Event")), /* @__PURE__ */ import_react5.default.createElement("form", { onSubmit: handleSubmit, className: "p-6 space-y-4" }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(Label, null, "Event Name *"), /* @__PURE__ */ import_react5.default.createElement(
      Input,
      {
        value: form.name,
        onChange: (e) => setForm({ ...form, name: e.target.value }),
        placeholder: "e.g., Senior Men 1x"
      }
    )), /* @__PURE__ */ import_react5.default.createElement("div", { className: "grid grid-cols-2 gap-4" }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(Label, null, "Boat Class *"), /* @__PURE__ */ import_react5.default.createElement(
      Select,
      {
        value: form.boatClassId,
        onChange: (e) => setForm({ ...form, boatClassId: e.target.value })
      },
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "" }, "Select boat class"),
      boatClasses.map((bc) => /* @__PURE__ */ import_react5.default.createElement("option", { key: bc._id, value: bc._id }, bc.names?.en || bc.code))
    )), /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(Label, null, "Category *"), /* @__PURE__ */ import_react5.default.createElement(
      Select,
      {
        value: form.categoryId,
        onChange: (e) => setForm({ ...form, categoryId: e.target.value })
      },
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "" }, "Select category"),
      filteredCategories.map((cat) => /* @__PURE__ */ import_react5.default.createElement("option", { key: cat._id, value: cat._id }, cat.titles?.en || cat.abbreviation))
    ), form.gender === "Mixed" && filteredCategories.length === 0 && /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs text-amber-600 mt-1" }, "No gender-neutral categories available. Create them in Category Management."))), /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(Label, null, "Gender *"), /* @__PURE__ */ import_react5.default.createElement(
      Select,
      {
        value: form.gender,
        onChange: (e) => setForm({ ...form, gender: e.target.value, categoryId: "" })
      },
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "M" }, "Men"),
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "F" }, "Women"),
      /* @__PURE__ */ import_react5.default.createElement("option", { value: "Mixed" }, "Mixed")
    )), /* @__PURE__ */ import_react5.default.createElement("div", { className: "bg-slate-50 rounded-lg p-4" }, /* @__PURE__ */ import_react5.default.createElement("h4", { className: "font-medium text-slate-700 mb-3" }, "Progression Settings"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center gap-2 mb-3" }, /* @__PURE__ */ import_react5.default.createElement(
      "input",
      {
        type: "checkbox",
        checked: form.progressionConfig.hasRepechage,
        onChange: (e) => setForm({
          ...form,
          progressionConfig: {
            ...form.progressionConfig,
            hasRepechage: e.target.checked
          }
        }),
        className: "w-4 h-4"
      }
    ), /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-sm text-slate-700" }, "Include Repechage round")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "grid grid-cols-2 gap-4" }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(Label, { className: "text-xs" }, "Direct to Knockout"), /* @__PURE__ */ import_react5.default.createElement(
      Input,
      {
        type: "number",
        min: 1,
        value: form.progressionConfig.timeTrialDirectAdvance,
        onChange: (e) => setForm({
          ...form,
          progressionConfig: {
            ...form.progressionConfig,
            timeTrialDirectAdvance: parseInt(e.target.value) || 4
          }
        })
      }
    )), form.progressionConfig.hasRepechage && /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(Label, { className: "text-xs" }, "To Repechage"), /* @__PURE__ */ import_react5.default.createElement(
      Input,
      {
        type: "number",
        min: 0,
        value: form.progressionConfig.timeTrialToRepechage,
        onChange: (e) => setForm({
          ...form,
          progressionConfig: {
            ...form.progressionConfig,
            timeTrialToRepechage: parseInt(e.target.value) || 4
          }
        })
      }
    )))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex justify-end gap-3 pt-4 border-t" }, /* @__PURE__ */ import_react5.default.createElement(Button, { type: "button", variant: "outline", onClick: onCancel }, "Cancel"), /* @__PURE__ */ import_react5.default.createElement(Button, { type: "submit", disabled: saving }, saving ? "Creating..." : "Create Event")))));
  };
  var BracketView = ({ bracket }) => {
    if (!bracket || !bracket.phases) return null;
    return /* @__PURE__ */ import_react5.default.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex gap-6 min-w-max p-4" }, PHASE_ORDER.map((phase) => {
      const races = bracket.phases[phase];
      if (!races || races.length === 0) return null;
      return /* @__PURE__ */ import_react5.default.createElement("div", { key: phase, className: "w-64" }, /* @__PURE__ */ import_react5.default.createElement("h4", { className: "font-semibold text-slate-700 mb-3 text-center" }, PHASE_NAMES[phase]), /* @__PURE__ */ import_react5.default.createElement("div", { className: "space-y-4" }, races.map((race) => /* @__PURE__ */ import_react5.default.createElement(
        "div",
        {
          key: race._id,
          className: `border rounded-lg p-2 ${race.status === "completed" ? "bg-green-50 border-green-200" : "bg-white"}`
        },
        /* @__PURE__ */ import_react5.default.createElement("div", { className: "text-xs text-slate-500 mb-1" }, race.raceCode),
        race.lanes.map((lane, idx) => /* @__PURE__ */ import_react5.default.createElement(
          "div",
          {
            key: idx,
            className: `flex justify-between items-center py-1 px-2 rounded text-sm ${lane.position === 1 ? "bg-yellow-100" : ""}`
          },
          /* @__PURE__ */ import_react5.default.createElement("span", { className: "truncate" }, lane.athlete?.lastName || lane.club?.shortName || `Lane ${lane.lane}`),
          /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-mono text-xs" }, lane.time || "-")
        ))
      ))));
    })));
  };
  var EntriesPanel = ({
    entries,
    loading,
    onGenerate,
    generating,
    canGenerate
  }) => {
    const groups = import_react5.default.useMemo(() => {
      const byClub = /* @__PURE__ */ new Map();
      for (const entry of entries) {
        const key = entry.club || entry.clubName || "unaffiliated";
        const label = entry.clubName || (entry.representingType === "nation" ? entry.representingNation || "Nation" : "Unaffiliated");
        if (!byClub.has(key)) {
          byClub.set(key, { label, code: entry.clubCode, items: [] });
        }
        byClub.get(key).items.push(entry);
      }
      return Array.from(byClub.values()).sort(
        (a, b) => a.label.localeCompare(b.label)
      );
    }, [entries]);
    const clubCount = groups.length;
    return /* @__PURE__ */ import_react5.default.createElement("div", { className: "mb-6 bg-white rounded-lg border" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "px-4 py-3 border-b border-slate-200 flex items-center justify-between" }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("h3", { className: "font-semibold text-slate-800" }, "Registered Entries"), /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs text-slate-500" }, entries.length, " entr", entries.length === 1 ? "y" : "ies", " \u2022", " ", clubCount, " club", clubCount === 1 ? "" : "s")), canGenerate && /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        size: "sm",
        onClick: onGenerate,
        disabled: generating || entries.length === 0
      },
      generating ? "Generating..." : "Generate Time Trials"
    )), /* @__PURE__ */ import_react5.default.createElement("div", { className: "p-4" }, loading ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "text-center py-6 text-slate-400 text-sm" }, "Loading entries...") : entries.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "text-center py-6 text-slate-500 text-sm" }, "No registered entries match this event (category, boat class & gender). Register clubs/athletes for this competition first.") : /* @__PURE__ */ import_react5.default.createElement("div", { className: "space-y-4" }, groups.map((group, gi) => /* @__PURE__ */ import_react5.default.createElement("div", { key: gi }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center gap-2 mb-2" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-medium text-slate-700 text-sm" }, group.label), group.code && /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-xs text-slate-400" }, "(", group.code, ")"), /* @__PURE__ */ import_react5.default.createElement("span", { className: "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600" }, group.items.length)), /* @__PURE__ */ import_react5.default.createElement("div", { className: "space-y-1" }, group.items.map((entry) => /* @__PURE__ */ import_react5.default.createElement(
      "div",
      {
        key: entry.entryId,
        className: "flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"
      },
      /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "w-6 h-6 flex items-center justify-center rounded bg-white text-xs font-bold text-slate-500 shrink-0" }, entry.classification ?? "-"), /* @__PURE__ */ import_react5.default.createElement("span", { className: "truncate text-slate-700" }, entry.displayName)),
      /* @__PURE__ */ import_react5.default.createElement(
        "span",
        {
          className: `text-xs px-2 py-0.5 rounded ${entry.status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`
        },
        entry.status
      )
    ))))))));
  };
  function BeachSprintCompetition() {
    const { competitionId } = (0, import_react_router_dom.useParams)();
    const navigate = (0, import_react_router_dom.useNavigate)();
    const { token } = useAuth();
    const [competition, setCompetition] = (0, import_react5.useState)(null);
    const [events, setEvents] = (0, import_react5.useState)([]);
    const [selectedEvent, setSelectedEvent] = (0, import_react5.useState)(null);
    const [eventDetail, setEventDetail] = (0, import_react5.useState)(null);
    const [bracket, setBracket] = (0, import_react5.useState)(null);
    const [loading, setLoading] = (0, import_react5.useState)(true);
    const [registrationEntries, setRegistrationEntries] = (0, import_react5.useState)([]);
    const [loadingRegistration, setLoadingRegistration] = (0, import_react5.useState)(false);
    const [globalJourneyFilter, setGlobalJourneyFilter] = (0, import_react5.useState)("");
    const [selectedCategoryId, setSelectedCategoryId] = (0, import_react5.useState)("");
    const [entries, setEntries] = (0, import_react5.useState)([]);
    const [entriesLoading, setEntriesLoading] = (0, import_react5.useState)(false);
    const [generatingTT, setGeneratingTT] = (0, import_react5.useState)(false);
    const [showCreateEvent, setShowCreateEvent] = (0, import_react5.useState)(false);
    const [showResultsDialog, setShowResultsDialog] = (0, import_react5.useState)(false);
    const [selectedRace, setSelectedRace] = (0, import_react5.useState)(null);
    const [viewMode, setViewMode] = (0, import_react5.useState)("list");
    (0, import_react5.useEffect)(() => {
      const fetchCompetition = async () => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/competitions/${competitionId}`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          if (response.ok) {
            setCompetition(await response.json());
          }
        } catch (error) {
          console.error("Error fetching competition:", error);
        }
      };
      if (token && competitionId) fetchCompetition();
    }, [token, competitionId]);
    const fetchEvents = (0, import_react5.useCallback)(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/beach-sprint/competitions/${competitionId}/events`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          setEvents(await response.json());
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    }, [token, competitionId]);
    (0, import_react5.useEffect)(() => {
      if (token && competitionId) fetchEvents();
    }, [token, competitionId, fetchEvents]);
    const loadRegistrationSummary = (0, import_react5.useCallback)(async () => {
      if (!token || !competitionId) return;
      setLoadingRegistration(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration${globalJourneyFilter ? `?journeyIndex=${globalJourneyFilter}` : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          setRegistrationEntries(Array.isArray(data.entries) ? data.entries : []);
        } else {
          setRegistrationEntries([]);
        }
      } catch (error) {
        console.error("Failed to load registration summary", error);
        setRegistrationEntries([]);
      } finally {
        setLoadingRegistration(false);
      }
    }, [token, competitionId, globalJourneyFilter]);
    (0, import_react5.useEffect)(() => {
      loadRegistrationSummary();
    }, [loadRegistrationSummary]);
    const registrationStats = (0, import_react5.useMemo)(() => {
      const clubs = /* @__PURE__ */ new Set();
      const categoryCounts = {};
      const uniqueAthletes = /* @__PURE__ */ new Set();
      const addAthlete = (athlete) => {
        if (!athlete) return;
        const key = athlete.licenseNumber || athlete._id || athlete.id;
        if (key) uniqueAthletes.add(String(key));
      };
      registrationEntries.forEach((entry) => {
        const clubId = entry.club?.id || entry.club?._id;
        if (clubId) clubs.add(clubId);
        const catId = entry.category?.id || entry.category?._id || "unknown";
        const catName = entry.category?.abbreviation || entry.category?.titles?.en || "Unknown";
        if (!categoryCounts[catId]) {
          categoryCounts[catId] = { id: catId, name: catName, count: 0 };
        }
        categoryCounts[catId].count++;
        if (Array.isArray(entry.crew) && entry.crew.length > 0) {
          entry.crew.forEach(addAthlete);
        } else {
          addAthlete(entry.athlete);
        }
      });
      return {
        totalEntries: registrationEntries.length,
        totalAthletes: uniqueAthletes.size,
        totalClubs: clubs.size,
        byCategory: Object.values(categoryCounts).sort(
          (a, b) => a.name.localeCompare(b.name)
        )
      };
    }, [registrationEntries]);
    const totalRacesGenerated = (0, import_react5.useMemo)(
      () => events.reduce((sum, event) => sum + (event.raceCount || 0), 0),
      [events]
    );
    const handleCategorySelect = (categoryId) => {
      setSelectedCategoryId((prev) => prev === categoryId ? "" : categoryId);
      const matchingEvent = events.find(
        (event) => (event.category?.id || event.category?._id) === categoryId || String(event.category) === categoryId
      );
      if (matchingEvent) {
        setSelectedEvent(matchingEvent);
      } else {
        import_react_toastify.toast.info("No beach sprint event exists yet for this category");
      }
    };
    const fetchEntries = (0, import_react5.useCallback)(
      async (eventId) => {
        if (!eventId) {
          setEntries([]);
          return;
        }
        setEntriesLoading(true);
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/beach-sprint/events/${eventId}/entries`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (response.ok) {
            const data = await response.json();
            setEntries(Array.isArray(data.entries) ? data.entries : []);
          } else {
            setEntries([]);
          }
        } catch (error) {
          console.error("Error fetching entries:", error);
          setEntries([]);
        } finally {
          setEntriesLoading(false);
        }
      },
      [token]
    );
    (0, import_react5.useEffect)(() => {
      const fetchEventDetail = async () => {
        if (!selectedEvent) {
          setEventDetail(null);
          setBracket(null);
          setEntries([]);
          return;
        }
        try {
          const [detailRes, bracketRes] = await Promise.all([
            fetch(
              `${API_BASE_URL}/api/beach-sprint/events/${selectedEvent._id}`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            ),
            fetch(
              `${API_BASE_URL}/api/beach-sprint/events/${selectedEvent._id}/bracket`,
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            )
          ]);
          if (detailRes.ok) setEventDetail(await detailRes.json());
          if (bracketRes.ok) setBracket(await bracketRes.json());
        } catch (error) {
          console.error("Error fetching event detail:", error);
        }
      };
      fetchEventDetail();
      fetchEntries(selectedEvent?._id);
    }, [token, selectedEvent, fetchEntries]);
    const isInternational = (0, import_react5.useMemo)(
      () => /inter/i.test(String(competition?.scope?.type || "")),
      [competition]
    );
    const seatLabelForIndex = (idx, total) => {
      if (total <= 1) return "";
      if (total === 2) return idx === 0 ? "(b)" : "(s)";
      if (idx === 0) return "(b)";
      if (idx === total - 1) return "(s)";
      return `(${idx + 1})`;
    };
    const formatBirthDate = (value) => {
      if (!value) return "";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).toUpperCase();
    };
    const buildEventName = (entry, lang) => [
      lang === "ar" ? entry.category?.titles?.ar || "" : entry.category?.titles?.en || entry.category?.abbreviation || "",
      lang === "ar" ? entry.boatClass?.names?.ar || "" : entry.boatClass?.names?.en || entry.boatClass?.code || ""
    ].filter(Boolean).join(" - ");
    const collectRegistrationRows = (0, import_react5.useCallback)(() => {
      return registrationEntries.map((entry) => {
        const eventCode = generateRaceCode(entry.category, entry.boatClass) || "-";
        const eventName = buildEventName(entry, "en") || eventCode;
        const eventNameAr = buildEventName(entry, "ar");
        const crew = Array.isArray(entry.crew) ? entry.crew : [];
        const athleteName = entry.athlete ? formatAthleteName(entry.athlete) : crew.length ? crew.map((member) => formatAthleteName(member)).join(" / ") : "Unassigned";
        const clubCode = entry.club?.code || "-";
        const clubName = entry.club?.name || "-";
        const athleteKeyOf = (athlete) => athlete ? String(athlete.licenseNumber || athlete._id || athlete.id || "") : "";
        const athleteKeys = (entry.athlete ? [entry.athlete] : crew).map(athleteKeyOf).filter(Boolean);
        return {
          eventCode,
          eventName,
          eventNameAr,
          eventNumber: null,
          clubCode,
          clubName,
          clubNameFr: entry.club?.name || "",
          clubNameAr: entry.club?.nameAr || "",
          country: clubName,
          athleteName,
          athleteKeys,
          athleteUnitCount: entry.athlete ? 1 : crew.length || 1,
          status: entry.status
        };
      });
    }, [registrationEntries]);
    const collectRaceRows = (0, import_react5.useCallback)(() => {
      const raceRows = [];
      let rowSequence = 0;
      registrationEntries.forEach((entry) => {
        const eventCode = generateRaceCode(entry.category, entry.boatClass) || "-";
        const eventName = buildEventName(entry, "en") || eventCode;
        const clubCode = entry.club?.code || "-";
        const clubName = entry.club?.name || clubCode;
        const dimensionKey = String(clubCode || "UNK").toUpperCase();
        const dimensionTitle = `${dimensionKey} - ${clubName}`;
        const crew = Array.isArray(entry.crew) ? entry.crew : [];
        if (entry.athlete) {
          raceRows.push({
            rowSequence: rowSequence++,
            dimensionKey,
            dimensionTitle,
            eventCode,
            eventName,
            eventNumber: null,
            seat: "",
            athleteName: formatAthleteName(entry.athlete),
            birthDate: formatBirthDate(entry.athlete.birthDate),
            crewCount: 1,
            athleteCount: 1
          });
          return;
        }
        if (crew.length) {
          crew.forEach((member, index) => {
            raceRows.push({
              rowSequence: rowSequence++,
              dimensionKey,
              dimensionTitle,
              eventCode,
              eventName,
              eventNumber: null,
              seat: seatLabelForIndex(index, crew.length),
              athleteName: formatAthleteName(member),
              birthDate: formatBirthDate(member.birthDate),
              crewCount: index === 0 ? 1 : 0,
              athleteCount: 1
            });
          });
          return;
        }
        raceRows.push({
          rowSequence: rowSequence++,
          dimensionKey,
          dimensionTitle,
          eventCode,
          eventName,
          eventNumber: null,
          seat: "",
          athleteName: "Unassigned",
          birthDate: "",
          crewCount: 1,
          athleteCount: 1
        });
      });
      return raceRows;
    }, [registrationEntries]);
    const runReport = (0, import_react5.useCallback)(async (label, fn) => {
      import_react_toastify.toast.info(`Generating ${label} PDF...`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        const ok = await fn();
        if (ok) {
          import_react_toastify.toast.success(`${label} exported successfully`);
        } else {
          import_react_toastify.toast.info("No entries available to export.");
        }
      } catch (error) {
        console.error(`${label} export error:`, error);
        import_react_toastify.toast.error(`Failed to export ${label}`);
      }
    }, []);
    const exportEntryListByEventPDF = (0, import_react5.useCallback)(
      () => runReport(
        "Entry List by Event",
        () => exportEntryListByEventPdf({
          competition,
          rows: collectRegistrationRows(),
          isInternational,
          globalJourneyFilter
        })
      ),
      [
        runReport,
        competition,
        collectRegistrationRows,
        isInternational,
        globalJourneyFilter
      ]
    );
    const exportEntriesByEventPDF = (0, import_react5.useCallback)(
      () => runReport(
        "Entries by Event",
        () => exportEntriesByEventPdf({
          competition,
          rows: collectRegistrationRows(),
          isInternational,
          globalJourneyFilter
        })
      ),
      [
        runReport,
        competition,
        collectRegistrationRows,
        isInternational,
        globalJourneyFilter
      ]
    );
    const exportNumberOfEntriesByClubPDF = (0, import_react5.useCallback)(
      () => runReport(
        `Number of Entries by ${isInternational ? "Country" : "Club"}`,
        () => exportNumberOfEntriesByClubPdf({
          competition,
          rows: collectRegistrationRows(),
          isInternational,
          globalJourneyFilter
        })
      ),
      [
        runReport,
        competition,
        collectRegistrationRows,
        isInternational,
        globalJourneyFilter
      ]
    );
    const exportEntryListByClubPDF = (0, import_react5.useCallback)(
      () => runReport(
        `Entry List by ${isInternational ? "Country" : "Club"}`,
        () => exportEntryListByClubPdf({
          competition,
          raceRows: collectRaceRows(),
          isInternational,
          globalJourneyFilter
        })
      ),
      [
        runReport,
        competition,
        collectRaceRows,
        isInternational,
        globalJourneyFilter
      ]
    );
    const handleGenerateTimeTrials = async () => {
      if (!selectedEvent) return;
      if (!entries.length) {
        import_react_toastify.toast.error("No registered entries found for this event");
        return;
      }
      const payloadEntries = entries.map((entry) => ({
        athlete: entry.athlete || void 0,
        crew: Array.isArray(entry.crew) ? entry.crew : [],
        club: entry.club || void 0
      }));
      setGeneratingTT(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/beach-sprint/events/${selectedEvent._id}/generate-time-trials`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ entries: payloadEntries, lanesPerHeat: 4 })
          }
        );
        if (response.ok) {
          const result = await response.json();
          import_react_toastify.toast.success(result.message || "Time trials generated");
          fetchEvents();
          setSelectedEvent({ ...selectedEvent });
        } else {
          const error = await response.json();
          import_react_toastify.toast.error(error.message || "Failed to generate time trials");
        }
      } catch (error) {
        import_react_toastify.toast.error("Failed to generate time trials");
      } finally {
        setGeneratingTT(false);
      }
    };
    const [exportingEntries, setExportingEntries] = (0, import_react5.useState)(false);
    const handleExportEntries = async () => {
      setExportingEntries(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/beach-sprint/competitions/${competitionId}/entries-export`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) {
          let message = "Failed to export entries";
          try {
            const error = await response.json();
            message = error.message || message;
          } catch {
          }
          import_react_toastify.toast.error(message);
          return;
        }
        const disposition = response.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const fileName = match ? match[1] : "Entries_by_Team.xlsx";
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        import_react_toastify.toast.success("Entries exported");
      } catch (error) {
        import_react_toastify.toast.error("Failed to export entries");
      } finally {
        setExportingEntries(false);
      }
    };
    const [generatingEvents, setGeneratingEvents] = (0, import_react5.useState)(false);
    const handleAutoGenerateEvents = async () => {
      setGeneratingEvents(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/beach-sprint/competitions/${competitionId}/auto-generate-events`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          }
        );
        if (response.ok) {
          const result = await response.json();
          if (result.created?.length) {
            import_react_toastify.toast.success(result.message);
          } else if (result.totalGroups === 0) {
            import_react_toastify.toast.info(
              "No registrations found. Register clubs/athletes for this competition first."
            );
          } else {
            import_react_toastify.toast.info("All events already exist for the current registrations.");
          }
          fetchEvents();
        } else {
          const error = await response.json();
          import_react_toastify.toast.error(error.message || "Failed to generate events");
        }
      } catch (error) {
        import_react_toastify.toast.error("Failed to generate events");
      } finally {
        setGeneratingEvents(false);
      }
    };
    const handleCreateEvent = async (eventData) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/beach-sprint/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(eventData)
        });
        if (response.ok) {
          import_react_toastify.toast.success("Event created successfully");
          setShowCreateEvent(false);
          fetchEvents();
        } else {
          const error = await response.json();
          import_react_toastify.toast.error(error.message || "Failed to create event");
        }
      } catch (error) {
        import_react_toastify.toast.error("Failed to create event");
      }
    };
    const handleDeleteEvent = async (event) => {
      if (!confirm(`Delete "${event.name}"? This will remove all races.`)) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/beach-sprint/events/${event._id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (response.ok) {
          import_react_toastify.toast.success("Event deleted");
          if (selectedEvent?._id === event._id) setSelectedEvent(null);
          fetchEvents();
        } else {
          import_react_toastify.toast.error("Failed to delete event");
        }
      } catch (error) {
        import_react_toastify.toast.error("Failed to delete event");
      }
    };
    const handleRecordResults = async (results) => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/beach-sprint/races/${selectedRace._id}/results`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ results })
          }
        );
        if (response.ok) {
          import_react_toastify.toast.success("Results recorded");
          setShowResultsDialog(false);
          setSelectedRace(null);
          setSelectedEvent({ ...selectedEvent });
        } else {
          import_react_toastify.toast.error("Failed to record results");
        }
      } catch (error) {
        import_react_toastify.toast.error("Failed to record results");
      }
    };
    const handleProcessProgression = async (type) => {
      const endpoint = type === "time_trial" ? "process-time-trial" : type === "finals" ? "process-finals" : "process-knockout";
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/beach-sprint/events/${selectedEvent._id}/${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ phase: selectedEvent.currentPhase })
          }
        );
        if (response.ok) {
          const result = await response.json();
          import_react_toastify.toast.success(result.message);
          fetchEvents();
          setSelectedEvent({ ...selectedEvent });
        } else {
          const error = await response.json();
          import_react_toastify.toast.error(error.message || "Failed to process progression");
        }
      } catch (error) {
        import_react_toastify.toast.error("Failed to process progression");
      }
    };
    if (loading) {
      return /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center justify-center min-h-screen" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" }));
    }
    return /* @__PURE__ */ import_react5.default.createElement("div", { className: "min-h-screen bg-slate-50" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "bg-white border-b border-slate-200" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "max-w-7xl mx-auto px-4 py-4" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        onClick: () => navigate("/competitions"),
        className: "text-sm text-slate-500 hover:text-slate-700 mb-1"
      },
      "\u2190 Back to Competitions"
    ), /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs uppercase tracking-[0.28em] text-slate-400" }, "Race planner"), /* @__PURE__ */ import_react5.default.createElement("h1", { className: "text-2xl font-bold text-slate-900" }, "\u{1F3D6}\uFE0F", " ", competition?.names?.en || competition?.name || "Beach Sprint Competition"), competition?.season ? /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-sm text-slate-500" }, "Season ", competition.season, " - ", competition.code) : /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-slate-600" }, "Beach Sprint Events & Brackets")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex flex-wrap items-center gap-2" }, /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        type: "button",
        variant: "ghost",
        onClick: () => navigate(-1)
      },
      "Back"
    ), /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        type: "button",
        variant: "outline",
        onClick: () => navigate(`/competitions/${competitionId}/rankings`)
      },
      "\u{1F3C6} Rankings"
    ), /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        variant: "outline",
        onClick: handleExportEntries,
        disabled: exportingEntries
      },
      exportingEntries ? "Exporting..." : "\u{1F4E5} Export Entries (Excel)"
    ), /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        variant: "outline",
        onClick: handleAutoGenerateEvents,
        disabled: generatingEvents
      },
      generatingEvents ? "Generating..." : "\u26A1 Generate Events from Registrations"
    ), /* @__PURE__ */ import_react5.default.createElement(Button, { onClick: () => setShowCreateEvent(true) }, "+ Create Event"))))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "max-w-7xl mx-auto px-4 py-6 space-y-6" }, /* @__PURE__ */ import_react5.default.createElement("section", { className: "grid gap-4 md:grid-cols-3 lg:grid-cols-4" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs font-medium uppercase tracking-wider text-slate-500" }, "Total Athletes"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-blue-600" }, "\u{1F465}"))), /* @__PURE__ */ import_react5.default.createElement("p", { className: "mt-2 text-3xl font-bold text-slate-900" }, registrationStats?.totalAthletes || 0)), /* @__PURE__ */ import_react5.default.createElement("div", { className: "rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs font-medium uppercase tracking-wider text-slate-500" }, "Registered Clubs"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-indigo-600" }, "\u{1F3DB}\uFE0F"))), /* @__PURE__ */ import_react5.default.createElement("p", { className: "mt-2 text-3xl font-bold text-slate-900" }, registrationStats?.totalClubs || 0)), /* @__PURE__ */ import_react5.default.createElement("div", { className: "rounded-xl border border-slate-200 bg-gradient-to-br from-purple-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs font-medium uppercase tracking-wider text-slate-500" }, "Total Entries"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-purple-600" }, "\u{1F4CB}"))), /* @__PURE__ */ import_react5.default.createElement("p", { className: "mt-2 text-3xl font-bold text-slate-900" }, registrationStats?.totalEntries || 0)), /* @__PURE__ */ import_react5.default.createElement("div", { className: "rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-xs font-medium uppercase tracking-wider text-slate-500" }, "Races Generated"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-emerald-600" }, "\u{1F3C1}"))), /* @__PURE__ */ import_react5.default.createElement("p", { className: "mt-2 text-3xl font-bold text-slate-900" }, totalRacesGenerated || 0))), /* @__PURE__ */ import_react5.default.createElement("section", { className: "rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 pb-5 pt-3 shadow-sm" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center gap-3 mb-2" }, /* @__PURE__ */ import_react5.default.createElement("h2", { className: "text-sm font-bold text-slate-900 uppercase tracking-wider" }, "Categories Overview"), /* @__PURE__ */ import_react5.default.createElement("span", { className: "text-xs text-slate-400" }, "Click to load entries")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ import_react5.default.createElement("div", null, loadingRegistration && !registrationEntries.length ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex items-center gap-2 text-sm text-slate-500" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }), "Loading registration data...") : /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex flex-wrap gap-2" }, registrationStats?.byCategory?.map((cat) => /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        key: cat.id,
        type: "button",
        onClick: () => handleCategorySelect(cat.id),
        className: `inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${selectedCategoryId === cat.id ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"}`
      },
      /* @__PURE__ */ import_react5.default.createElement("span", { className: "font-semibold" }, cat.name),
      /* @__PURE__ */ import_react5.default.createElement(
        "span",
        {
          className: `rounded-full px-2 py-0.5 text-xs font-bold ${selectedCategoryId === cat.id ? "bg-blue-200 text-blue-800" : "bg-slate-100 text-slate-600"}`
        },
        cat.count
      )
    )), !registrationStats?.byCategory?.length && /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-sm text-slate-500" }, "No registrations found for this competition."))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "rounded-xl border border-slate-200 bg-slate-50 p-1.5 space-y-1.5" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500" }, "Entries Reports"), /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex flex-wrap gap-2 md:flex-nowrap" }, [
      {
        label: "Entry List by Event",
        onClick: exportEntryListByEventPDF
      },
      {
        label: "Entries by Event",
        onClick: exportEntriesByEventPDF
      },
      {
        label: "Number of Entries by Club",
        onClick: exportNumberOfEntriesByClubPDF
      },
      {
        label: "Entry List by Club",
        onClick: exportEntryListByClubPDF
      }
    ].map((item) => /* @__PURE__ */ import_react5.default.createElement(
      "button",
      {
        key: item.label,
        type: "button",
        onClick: item.onClick,
        className: "group flex min-w-[220px] flex-1 items-center rounded-md border border-slate-200 bg-white text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
      },
      /* @__PURE__ */ import_react5.default.createElement("span", { className: "flex h-9 w-9 flex-none items-center justify-center bg-sky-500 text-white text-sm font-bold rounded-l-md" }, "PDF"),
      /* @__PURE__ */ import_react5.default.createElement("span", { className: "px-3 py-1.5 text-sm font-semibold text-slate-800 group-hover:text-blue-800" }, item.label)
    )))))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "grid grid-cols-12 gap-6" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "col-span-4" }, /* @__PURE__ */ import_react5.default.createElement("h2", { className: "text-lg font-semibold text-slate-900 mb-4" }, "Events"), events.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "text-center py-8 bg-white rounded-lg border" }, /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-slate-500" }, "No events yet"), /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        className: "mt-4",
        onClick: () => setShowCreateEvent(true)
      },
      "Create First Event"
    )) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "space-y-3" }, events.map((event) => /* @__PURE__ */ import_react5.default.createElement(
      EventCard,
      {
        key: event._id,
        event,
        onSelect: setSelectedEvent,
        onDelete: handleDeleteEvent
      }
    )))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "col-span-8" }, selectedEvent ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "bg-white rounded-lg border" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "px-6 py-4 border-b border-slate-200" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex justify-between items-center" }, /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("h2", { className: "text-xl font-semibold text-slate-900" }, selectedEvent.name), /* @__PURE__ */ import_react5.default.createElement("p", { className: "text-slate-500" }, "Current Phase: ", PHASE_NAMES[selectedEvent.currentPhase])), /* @__PURE__ */ import_react5.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        variant: viewMode === "list" ? "default" : "outline",
        size: "sm",
        onClick: () => setViewMode("list")
      },
      "List"
    ), /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        variant: viewMode === "bracket" ? "default" : "outline",
        size: "sm",
        onClick: () => setViewMode("bracket")
      },
      "Bracket"
    ))), selectedEvent.status !== "completed" && /* @__PURE__ */ import_react5.default.createElement("div", { className: "mt-4 flex gap-2" }, selectedEvent.currentPhase === "time_trial" && /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        size: "sm",
        onClick: () => handleProcessProgression("time_trial")
      },
      "Process Time Trial \u2192 Generate Bracket"
    ), ["quarterfinal", "semifinal"].includes(
      selectedEvent.currentPhase
    ) && /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        size: "sm",
        onClick: () => handleProcessProgression("knockout")
      },
      "Process ",
      PHASE_NAMES[selectedEvent.currentPhase],
      " ",
      "Results"
    ), ["final_a", "final_b"].includes(
      selectedEvent.currentPhase
    ) && /* @__PURE__ */ import_react5.default.createElement(
      Button,
      {
        size: "sm",
        onClick: () => handleProcessProgression("finals")
      },
      "Process Finals & Assign Medals"
    ))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "p-6" }, viewMode !== "bracket" && /* @__PURE__ */ import_react5.default.createElement(
      EntriesPanel,
      {
        entries,
        loading: entriesLoading,
        onGenerate: handleGenerateTimeTrials,
        generating: generatingTT,
        canGenerate: selectedEvent.currentPhase === "time_trial"
      }
    ), viewMode === "bracket" ? /* @__PURE__ */ import_react5.default.createElement(BracketView, { bracket }) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "space-y-4" }, eventDetail?.races?.length > 0 ? (
      // Group races by phase
      PHASE_ORDER.map((phase) => {
        const phaseRaces = eventDetail.races.filter(
          (r2) => r2.phase === phase
        );
        if (phaseRaces.length === 0) return null;
        return /* @__PURE__ */ import_react5.default.createElement("div", { key: phase }, /* @__PURE__ */ import_react5.default.createElement("h3", { className: "font-semibold text-slate-700 mb-2" }, PHASE_NAMES[phase]), /* @__PURE__ */ import_react5.default.createElement("div", { className: "grid gap-3" }, phaseRaces.map((race) => /* @__PURE__ */ import_react5.default.createElement(
          RaceCard,
          {
            key: race._id,
            race,
            onRecordResults: (race2) => {
              setSelectedRace(race2);
              setShowResultsDialog(true);
            }
          }
        ))));
      })
    ) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "text-center py-8 text-slate-500" }, "No races generated yet. Add entries and generate time trials.")))) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "bg-white rounded-lg border p-8 text-center text-slate-500" }, "Select an event to view details")))), showCreateEvent && competition && /* @__PURE__ */ import_react5.default.createElement(
      CreateEventDialog,
      {
        competition,
        onSave: handleCreateEvent,
        onCancel: () => setShowCreateEvent(false)
      }
    ), showResultsDialog && selectedRace && /* @__PURE__ */ import_react5.default.createElement(
      ResultsDialog,
      {
        race: selectedRace,
        onSave: handleRecordResults,
        onCancel: () => {
          setShowResultsDialog(false);
          setSelectedRace(null);
        }
      }
    ));
  }
})();
