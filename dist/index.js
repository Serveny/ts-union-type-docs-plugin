"use strict";
function addExtraDocs(ts, quickInfo, typeInfo) {
  if (typeInfo.unionParams.length === 0) return;
  typeInfo.unionParams.forEach((p) => addDocComment(ts, p));
  quickInfo.documentation = [
    ...quickInfo.documentation ?? [],
    {
      text: createMarkdown(typeInfo),
      kind: "markdown"
    }
  ];
}
function addDocComment(ts, param) {
  for (const node of param.entries) {
    const nodeWithDocs = node.original ?? node;
    const sourceFile = nodeWithDocs.getSourceFile();
    if (!sourceFile) continue;
    param.docComment = extractJSDocsFromNode(ts, nodeWithDocs, sourceFile);
  }
}
function createMarkdown(typeInfo) {
  const paramBlocks = typeInfo.unionParams.map((pi) => paramMarkdown(pi));
  return `

---
### 🌟 Parameter-Details
${paramBlocks.join("\n")}
`;
}
function paramMarkdown(info) {
  const docs = info.docComment?.join("\n") ?? "";
  return `
#### ${numberEmoji(info.i + 1)} ${info.name}: _${info.value}_
${docs}`;
}
function extractJSDocsFromNode(ts, node, sourceFile) {
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
**@${tag}**`));
}
const numEmjs = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
function numberEmoji(num) {
  if (num === 10) return "🔟";
  return [...String(num)].map((char) => numEmjs[parseInt(char, 10)]);
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
  collectUnionMemberNodes(node) {
    const ts = this.ts, checker = this.checker;
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node) || ts.isHeritageClause(node)) {
      return node.types.map((tn) => this.collectUnionMemberNodes(tn)).flat();
    }
    if (ts.isConditionalTypeNode(node)) {
      return [
        ...this.collectUnionMemberNodes(node.checkType),
        ...this.collectUnionMemberNodes(node.extendsType),
        ...this.collectUnionMemberNodes(node.trueType),
        ...this.collectUnionMemberNodes(node.falseType)
      ];
    }
    if (ts.isIndexedAccessTypeNode(node)) {
      return [
        ...this.collectUnionMemberNodes(node.objectType),
        ...this.collectUnionMemberNodes(node.indexType)
      ];
    }
    if (ts.isTypeLiteralNode(node)) {
      return node.members.map(
        (m) => m.type ? this.collectUnionMemberNodes(m.type) : []
      ).flat();
    }
    if (ts.isMappedTypeNode(node)) {
      const results = [];
      if (node.typeParameter.constraint)
        results.push(
          ...this.collectUnionMemberNodes(node.typeParameter.constraint)
        );
      if (node.type) results.push(...this.collectUnionMemberNodes(node.type));
      return results;
    }
    if (ts.isTypeReferenceNode(node)) {
      const symbol = checker.getSymbolAtLocation(node.typeName);
      if (!symbol) return [];
      const aliasedSymbol = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const decl = aliasedSymbol.declarations?.[0];
      if (!decl) return [];
      const tn = ts.isTypeParameterDeclaration(decl) ? decl.constraint ?? null : ts.isTypeAliasDeclaration(decl) ? decl.type : null;
      if (!tn) return [];
      return this.collectUnionMemberNodes(tn);
    }
    if (ts.isTypeOperatorNode(node)) {
      if (node.operator === ts.SyntaxKind.KeyOfKeyword) {
        const type = checker.getTypeAtLocation(node.type);
        return type.getProperties().map((p) => {
          const decl = p.getDeclarations()?.[0];
          const node2 = ts.factory.createLiteralTypeNode(
            ts.factory.createStringLiteral(p.getName())
          );
          node2.original = decl;
          return node2;
        });
      }
    }
    if (ts.isParenthesizedTypeNode(node)) {
      return this.collectUnionMemberNodes(node.type);
    }
    if (ts.isArrayTypeNode(node)) {
      return this.collectUnionMemberNodes(node.elementType);
    }
    if (ts.isTupleTypeNode(node)) {
      return node.elements.map((el) => this.collectUnionMemberNodes(el)).flat();
    }
    if (ts.isTypeQueryNode(node)) {
      const symbol = checker.getSymbolAtLocation(node.exprName);
      if (symbol) {
        const decls = symbol.getDeclarations() ?? [];
        return decls.flatMap((d) => this.collectUnionMemberNodes(d));
      }
      return [];
    }
    if (ts.isLiteralTypeNode(node) || ts.isTypeNode(node)) {
      return [node];
    }
    return [];
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
    addExtraDocs(this.ts, quickInfo, typeInfo);
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
