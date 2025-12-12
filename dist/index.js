"use strict";
function addExtraJSDocTagInfo(ts, quickInfo, typeInfo) {
  if (typeInfo.unionParams.length === 0) return;
  typeInfo.unionParams.forEach((p) => addDocComment(ts, p));
  if (!quickInfo.tags) quickInfo.tags = [];
  const tagIdxs = quickInfo.tags?.map((tag, idx) => ({ tag, idx })).filter((ti) => ti.tag.name === "param") ?? [];
  const newTags = [
    ...tagIdxs.length > 0 ? quickInfo.tags.filter((t, i) => i < tagIdxs[0].idx) : quickInfo.tags
  ];
  for (const paramInfo of typeInfo.unionParams) {
    const jsDocTag = findJsDocParamTagByName(tagIdxs, paramInfo.name);
    const newTag = addParamTagInfo(
      jsDocTag?.tag ?? defaultParamJSDocTag(paramInfo.name),
      paramInfo
    );
    newTags.push(newTag);
  }
  const lastParamTagIdx = tagIdxs.length === 0 ? 0 : tagIdxs[tagIdxs.length - 1]?.idx ?? 0;
  if (quickInfo.tags.length - 1 > lastParamTagIdx)
    newTags.push(...quickInfo.tags.filter((t, i) => i > lastParamTagIdx));
  quickInfo.tags = newTags;
}
function findJsDocParamTagByName(tags, name) {
  const foundTag = tags.find(
    ({ tag }) => tag.text?.some(
      (textPart) => textPart.kind === "parameterName" && textPart.text.toLowerCase() === name.toLowerCase()
    )
  );
  return foundTag ?? null;
}
function defaultParamJSDocTag(name) {
  return {
    name: "param",
    text: [
      {
        kind: "parameterName",
        text: name
      }
    ]
  };
}
function createMarkdownDisplayPart(mdText) {
  return {
    text: mdText,
    kind: "markdown"
  };
}
function addParamTagInfo(oldTag, typeInfo) {
  const newTag = JSON.parse(JSON.stringify(oldTag));
  if (!typeInfo?.docComment) return newTag;
  if (!newTag.text) newTag.text = [];
  newTag.text.push(
    createMarkdownDisplayPart(
      typeInfo.docComment?.map((line, i) => i > 0 ? line = "> " + line : line).join("\n")
    )
  );
  return newTag;
}
function addDocComment(ts, param) {
  const visited = /* @__PURE__ */ new Set();
  const comments = [];
  for (const entryNode of param.entries) {
    if (visited.has(entryNode.id)) continue;
    visited.add(entryNode.id);
    comments.push(extractJSDocsFromNode(ts, entryNode));
    let parent = entryNode.callParent;
    while (parent != null) {
      if (!visited.has(parent.id)) {
        comments.push(extractJSDocsFromNode(ts, parent));
        visited.add(parent.id);
      }
      parent = parent.callParent;
    }
  }
  const lines = comments.reverse().flat();
  if (!param.docComment) param.docComment = lines;
  else param.docComment.push(...lines);
}
function extractJSDocsFromNode(ts, node) {
  node = node.original ?? node;
  const sourceFile = node.getSourceFile();
  if (!sourceFile) return [];
  const sourceText = sourceFile.getFullText();
  const start = node.getStart();
  const comment = getLeadingComment(ts, sourceText, start);
  return comment ? prepareJSDocText(sourceText.substring(comment.pos, comment.end)) : [];
}
function getLeadingComment(ts, text, pos) {
  const comments = ts.getLeadingCommentRanges(text, pos) ?? [];
  if (comments.length > 0 && text[comments[0].pos + 2] === "*")
    return comments[comments.length - 1];
  text = text.substring(0, pos);
  const commentStart = text.lastIndexOf("/**");
  if (commentStart === -1) return;
  const commentEnd = text.lastIndexOf("*/");
  if (commentEnd === -1) return;
  const textBetween = text.substring(commentEnd + 2, pos);
  if (/[^ \t|\n]/.test(textBetween)) return;
  return {
    pos: commentStart + 3,
    end: commentEnd,
    kind: ts.SyntaxKind.MultiLineCommentTrivia
  };
}
function prepareJSDocText(rawComment) {
  return rawComment.replace("/**", "").replace("*/", "").split("\n").map((line) => line.trim().replace(/^\* ?/, "")).map((line) => line.replace(/@(\w+)/g, (_, tag) => `
> _@${tag}_`));
}
class TypeInfo {
  constructor(unionParams) {
    this.unionParams = unionParams;
  }
}
class UnionParameterInfo {
  constructor(i, name, entries, value, docComment) {
    this.i = i;
    this.name = name;
    this.entries = entries;
    this.value = value;
    this.docComment = docComment;
  }
}
class TypeInfoFactory {
  constructor(ts, ls) {
    this.ts = ts;
    this.ls = ls;
  }
  create(fileName, position) {
    const program = this.ls.getProgram();
    if (!program) return null;
    this.checker = program.getTypeChecker();
    if (!this.checker) return null;
    const source = program.getSourceFile(fileName);
    if (!source) return null;
    const node = this.findNodeAtPos(source, position);
    if (!node) return null;
    const symbol = this.checker.getSymbolAtLocation(node);
    if (!symbol) return null;
    const callExpression = this.getCallExpression(node);
    if (!callExpression) return null;
    const unionParams = this.getUnionParamters(callExpression);
    if (unionParams.length === 0) return null;
    return new TypeInfo(unionParams);
  }
  findNodeAtPos(srcFile, pos) {
    const find = (node) => pos >= node.getStart() && pos < node.getEnd() ? this.ts.forEachChild(node, find) || node : null;
    return find(srcFile);
  }
  getCallExpression(node) {
    if (this.ts.isCallExpression(node)) return node;
    while (node && !this.ts.isCallExpression(node)) node = node.parent;
    return node;
  }
  getUnionParamters(callExpr) {
    const paramTypes = [];
    const signature = this.checker.getResolvedSignature(callExpr);
    if (!signature) return paramTypes;
    const args = callExpr.arguments;
    const params = signature.getParameters();
    for (let i = 0; i < params.length; i++) {
      const paramInfo = this.getUnionParamInfo(i, params[i], args[i]);
      if (paramInfo) paramTypes.push(paramInfo);
    }
    return paramTypes;
  }
  getUnionParamInfo(i, paramSymbol, arg) {
    const decl = paramSymbol.valueDeclaration;
    if (!decl || !this.ts.isParameter(decl) || !decl.type) return null;
    const unionMemberNodes = this.collectUnionMemberNodes(decl.type);
    if (unionMemberNodes.length === 0) return null;
    const value = this.getValue(arg);
    const valueNodes = unionMemberNodes.filter((entry) => this.cmp(arg, entry));
    return new UnionParameterInfo(i, paramSymbol.name, valueNodes, value);
  }
  getValue(expr) {
    return this.ts.isLiteralExpression(expr) ? expr.text : expr.getText();
  }
  collectUnionMemberNodes(node, callParent) {
    const ts = this.ts;
    if (ts.isUnionTypeNode(node) || // e.g. string | number
    ts.isIntersectionTypeNode(node) || // e.g. Class1 & Class2
    ts.isHeritageClause(node)) {
      return node.types.map((tn) => this.collectUnionMemberNodes(tn, node)).flat();
    }
    if (ts.isConditionalTypeNode(node))
      return this.collectConditionalTypeNode(node);
    if (ts.isIndexedAccessTypeNode(node))
      return this.collectIndexedAccessTypeNode(node);
    if (ts.isTypeLiteralNode(node)) return this.collectTypeLiteralNode(node);
    if (ts.isMappedTypeNode(node)) return this.collectMappedTypeNode(node);
    if (ts.isTypeReferenceNode(node))
      return this.collectTypeReferenceNode(node);
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.KeyOfKeyword)
      return this.collectKeyOfKeywordTypeOperatorNode(node, callParent);
    if (ts.isParenthesizedTypeNode(node))
      return this.collectUnionMemberNodes(node.type, node);
    if (ts.isArrayTypeNode(node))
      return this.collectUnionMemberNodes(node.elementType, node);
    if (ts.isTupleTypeNode(node)) return this.collectTupleTypeNode(node);
    if (ts.isTypeQueryNode(node)) return this.collectTypeQueryNode(node);
    if (ts.isTemplateLiteralTypeNode(node))
      return this.buildTemplateLiteralNode(node);
    if (ts.isLiteralTypeNode(node) || // e.g. "text", 42, true
    ts.isTypeNode(node)) {
      node.callParent = callParent;
      return [node];
    }
    console.warn("Unknown node type: ", node);
    return [];
  }
  collectConditionalTypeNode(node) {
    return [
      ...this.collectUnionMemberNodes(node.checkType, node),
      ...this.collectUnionMemberNodes(node.extendsType, node),
      ...this.collectUnionMemberNodes(node.trueType, node),
      ...this.collectUnionMemberNodes(node.falseType, node)
    ];
  }
  collectIndexedAccessTypeNode(node) {
    return [
      ...this.collectUnionMemberNodes(node.objectType, node),
      ...this.collectUnionMemberNodes(node.indexType, node)
    ];
  }
  collectTypeLiteralNode(node) {
    return node.members.map(
      (m) => m.type ? this.collectUnionMemberNodes(m.type, node) : []
    ).flat();
  }
  collectMappedTypeNode(node) {
    const results = [];
    if (node.typeParameter.constraint)
      results.push(
        ...this.collectUnionMemberNodes(node.typeParameter.constraint, node)
      );
    if (node.type)
      results.push(...this.collectUnionMemberNodes(node.type, node));
    return results;
  }
  collectTypeReferenceNode(node) {
    const checker = this.checker, ts = this.ts, symbol = checker.getSymbolAtLocation(node.typeName);
    if (!symbol) return [];
    const aliasedSymbol = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const decl = aliasedSymbol.declarations?.[0];
    if (!decl) return [];
    const tn = ts.isTypeParameterDeclaration(decl) ? decl.constraint ?? null : ts.isTypeAliasDeclaration(decl) ? decl.type : null;
    if (!tn) return [];
    return this.collectUnionMemberNodes(tn, node);
  }
  collectKeyOfKeywordTypeOperatorNode(node, callParent) {
    const ts = this.ts, checker = this.checker, type = checker.getTypeAtLocation(node.type);
    return type.getProperties().map((p) => {
      const decl = p.getDeclarations()?.[0];
      const node2 = ts.factory.createLiteralTypeNode(
        ts.factory.createStringLiteral(p.getName())
      );
      node2.original = decl;
      node2.callParent = callParent;
      return node2;
    });
  }
  collectTupleTypeNode(node) {
    return node.elements.map((el) => this.collectUnionMemberNodes(el, node)).flat();
  }
  collectTypeQueryNode(node) {
    const symbol = this.checker.getSymbolAtLocation(node.exprName);
    if (symbol) {
      const decls = symbol.getDeclarations() ?? [];
      return decls.flatMap(
        (d) => this.collectUnionMemberNodes(d, node)
      );
    }
    return [];
  }
  // Creates new literal nodes with every possible content
  buildTemplateLiteralNode(node) {
    const results = [];
    const headText = node.head.text;
    for (const span of node.templateSpans) {
      const innerTypeNodes = this.collectUnionMemberNodes(span.type, node);
      for (const tn of innerTypeNodes) {
        if (this.ts.isLiteralTypeNode(tn) && (this.ts.isStringLiteral(tn.literal) || this.ts.isNumericLiteral(tn.literal))) {
          const fullValue = headText + tn.literal.text + span.literal.text;
          const literalNode = this.ts.factory.createLiteralTypeNode(
            this.ts.factory.createStringLiteral(fullValue)
          );
          literalNode.original = tn;
          literalNode.callParent = node;
          results.push(literalNode);
        } else {
          results.push(...this.collectUnionMemberNodes(tn, node));
        }
      }
    }
    return results;
  }
  cmp(expr, node) {
    const ts = this.ts;
    if (!ts.isLiteralTypeNode(node)) return false;
    const typeLiteral = node.literal;
    if (ts.isStringLiteral(expr) && ts.isStringLiteral(typeLiteral))
      return expr.text === typeLiteral.text;
    if (ts.isNumericLiteral(expr) && ts.isNumericLiteral(typeLiteral))
      return expr.text === typeLiteral.text;
    if (ts.isBigIntLiteral(expr) && ts.isBigIntLiteral(typeLiteral))
      return expr.text === typeLiteral.text;
    if (expr.kind === ts.SyntaxKind.TrueKeyword && typeLiteral.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword && typeLiteral.kind === ts.SyntaxKind.FalseKeyword)
      return true;
    if (expr.kind === ts.SyntaxKind.NullKeyword && typeLiteral.kind === ts.SyntaxKind.NullKeyword)
      return true;
    if (expr.kind === ts.SyntaxKind.UndefinedKeyword && typeLiteral.kind === ts.SyntaxKind.UndefinedKeyword)
      return true;
    return false;
  }
}
class UnionTypeDocsPlugin {
  constructor(ts) {
    this.ts = ts;
  }
  create(info) {
    this.logger = info.project.projectService.logger;
    this.ls = info.languageService;
    this.typeInfoFactory = new TypeInfoFactory(this.ts, this.ls);
    this.proxy = createLsProxy(this.ls);
    this.proxy.getQuickInfoAtPosition = this.getQuickInfoAtPosition.bind(this);
    this.proxy.getCompletionsAtPosition = this.getCompletionsAtPosition.bind(this);
    this.logger.info("[Union type docs plugin] Loaded");
    return this.proxy;
  }
  getQuickInfoAtPosition(fileName, pos) {
    const quickInfo = this.ls.getQuickInfoAtPosition(fileName, pos);
    if (!quickInfo) return quickInfo;
    const typeInfo = this.typeInfoFactory.create(fileName, pos);
    if (!typeInfo) return quickInfo;
    addExtraJSDocTagInfo(this.ts, quickInfo, typeInfo);
    return quickInfo;
  }
  getCompletionsAtPosition(fileName, pos, opts, fmt) {
    const cmpl = this.ls.getCompletionsAtPosition(fileName, pos, opts, fmt);
    return cmpl;
  }
}
function createLsProxy(oldLs) {
  const proxy = /* @__PURE__ */ Object.create(null);
  for (const k of Object.keys(oldLs)) {
    const x = oldLs[k];
    proxy[k] = typeof x === "function" ? x.bind(oldLs) : x;
  }
  return proxy;
}
module.exports = (mod) => new UnionTypeDocsPlugin(mod.typescript);
//# sourceMappingURL=index.js.map
