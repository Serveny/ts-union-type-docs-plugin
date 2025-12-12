import type * as TS from 'typescript/lib/tsserverlibrary';
export declare class TypeInfo {
    unionParams: UnionParameterInfo[];
    constructor(unionParams: UnionParameterInfo[]);
}
export declare class UnionParameterInfo {
    i: number;
    name: string;
    entries: CalledNode[];
    value?: string | undefined;
    docComment?: string[] | undefined;
    constructor(i: number, name: string, entries: CalledNode[], value?: string | undefined, docComment?: string[] | undefined);
}
export interface CalledNode extends TS.TypeNode {
    callParent?: CalledNode;
}
export declare class TypeInfoFactory {
    private ts;
    private ls;
    private checker;
    constructor(ts: typeof TS, ls: TS.LanguageService);
    create(fileName: string, position: number): TypeInfo | null;
    private findNodeAtPos;
    private getCallExpression;
    private getUnionParamters;
    private getUnionParamInfo;
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
    private buildTemplateLiteralNode;
    private cmp;
}
