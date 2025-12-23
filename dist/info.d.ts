import type * as TS from 'typescript/lib/tsserverlibrary';
export declare enum SupportedType {
    Paramter = 0
}
export declare class UnionInfo {
    type: SupportedType;
    name: string;
    entries: CalledNode[];
    value?: string | undefined;
    docComment?: string[] | undefined;
    constructor(type: SupportedType, name: string, entries: CalledNode[], value?: string | undefined, docComment?: string[] | undefined);
}
export interface CalledNode extends TS.Node {
    id?: number;
    callParent?: CalledNode;
    original?: TS.Node;
    isRegexPattern?: boolean;
    codeText?: string;
}
export declare class TypeInfoFactory {
    private ts;
    private ls;
    private checker;
    private id;
    constructor(ts: typeof TS, ls: TS.LanguageService);
    create(fileName: string, position: number): UnionInfo[] | null;
    private findNodeAtPos;
    private getCallExpression;
    private getUnionParamtersInfo;
    private getUnionInfo;
    private getValue;
    private collectUnionMemberNodes;
    private collectConditionalTypeNode;
    private collectIndexedAccessTypeNode;
    private collectTypeLiteralNode;
    private collectMappedTypeNode;
    private collectTypeReferenceNode;
    private collectKeyOfKeywordTypeOperatorNode;
    private collectTupleTypeNode;
    private collectTypeQueryNode;
    private createLiteralNode;
    private buildTemplateLiteralNode;
    private cmp;
    private cmpLit;
}
