'use strict';
function _interopDefault(ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }
var require$$0 = _interopDefault(require('assert'));
var require$$0$1 = _interopDefault(require('path'));
var os = _interopDefault(require('os'));
var fs = _interopDefault(require('fs'));
var util = _interopDefault(require('util'));
var module$1 = _interopDefault(require('module'));
var index$2 = x => {
    if (typeof x !== 'string') {
        throw new TypeError('Expected a string, got ' + typeof x);
    }
    // Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
    // conversion translates it to FEFF (UTF-16 BOM)
    if (x.charCodeAt(0) === 0xFEFF) {
        return x.slice(1);
    }
    return x;
};
function assertDoc(val) {
    if (!(typeof val === "string" || (val != null && typeof val.type === "string"))) {
        throw new Error("Value " + JSON.stringify(val) + " is not a valid document");
    }
}
function concat$1(parts) {
    parts.forEach(assertDoc);
    // We cannot do this until we change `printJSXElement` to not
    // access the internals of a document directly.
    // if(parts.length === 1) {
    //   // If it's a single document, no need to concat it.
    //   return parts[0];
    // }
    return { type: "concat", parts };
}
function indent$1(contents) {
    assertDoc(contents);
    return { type: "indent", contents };
}
function align(n, contents) {
    assertDoc(contents);
    return { type: "align", contents, n };
}
function group(contents, opts) {
    opts = opts || {};
    assertDoc(contents);
    return {
        type: "group",
        contents: contents,
        break: !!opts.shouldBreak,
        expandedStates: opts.expandedStates
    };
}
function conditionalGroup(states, opts) {
    return group(states[0], Object.assign(opts || {}, { expandedStates: states }));
}
function fill(parts) {
    parts.forEach(assertDoc);
    return { type: "fill", parts };
}
function ifBreak(breakContents, flatContents) {
    if (breakContents) {
        assertDoc(breakContents);
    }
    if (flatContents) {
        assertDoc(flatContents);
    }
    return { type: "if-break", breakContents, flatContents };
}
function lineSuffix$1(contents) {
    assertDoc(contents);
    return { type: "line-suffix", contents };
}
const lineSuffixBoundary = { type: "line-suffix-boundary" };
const breakParent$1 = { type: "break-parent" };
const line = { type: "line" };
const softline = { type: "line", soft: true };
const hardline$1 = concat$1([{ type: "line", hard: true }, breakParent$1]);
const literalline = concat$1([
    { type: "line", hard: true, literal: true },
    breakParent$1
]);
const cursor$1 = { type: "cursor", placeholder: Symbol("cursor") };
function join$1(sep, arr) {
    const res = [];
    for (let i = 0; i < arr.length; i++) {
        if (i !== 0) {
            res.push(sep);
        }
        res.push(arr[i]);
    }
    return concat$1(res);
}
function addAlignmentToDoc(doc, size, tabWidth) {
    let aligned = doc;
    if (size > 0) {
        // Use indent to add tabs for all the levels of tabs we need
        for (let i = 0; i < Math.floor(size / tabWidth); ++i) {
            aligned = indent$1(aligned);
        }
        // Use align for all the spaces that are needed
        aligned = align(size % tabWidth, aligned);
        // size is absolute from 0 and not relative to the current
        // indentation, so we use -Infinity to reset the indentation to 0
        aligned = align(-Infinity, aligned);
    }
    return aligned;
}
var docBuilders$1 = {
    concat: concat$1,
    join: join$1,
    line,
    softline,
    hardline: hardline$1,
    literalline,
    group,
    conditionalGroup,
    fill,
    lineSuffix: lineSuffix$1,
    lineSuffixBoundary,
    cursor: cursor$1,
    breakParent: breakParent$1,
    ifBreak,
    indent: indent$1,
    align,
    addAlignmentToDoc
};
function isExportDeclaration(node) {
    if (node) {
        switch (node.type) {
            case "ExportDefaultDeclaration":
            case "ExportDefaultSpecifier":
            case "DeclareExportDeclaration":
            case "ExportNamedDeclaration":
            case "ExportAllDeclaration":
                return true;
        }
    }
    return false;
}
function getParentExportDeclaration(path) {
    const parentNode = path.getParentNode();
    if (path.getName() === "declaration" && isExportDeclaration(parentNode)) {
        return parentNode;
    }
    return null;
}
function getPenultimate(arr) {
    if (arr.length > 1) {
        return arr[arr.length - 2];
    }
    return null;
}
function getLast(arr) {
    if (arr.length > 0) {
        return arr[arr.length - 1];
    }
    return null;
}
function skip(chars) {
    return (text, index, opts) => {
        const backwards = opts && opts.backwards;
        // Allow `skip` functions to be threaded together without having
        // to check for failures (did someone say monads?).
        if (index === false) {
            return false;
        }
        const length = text.length;
        let cursor = index;
        while (cursor >= 0 && cursor < length) {
            const c = text.charAt(cursor);
            if (chars instanceof RegExp) {
                if (!chars.test(c)) {
                    return cursor;
                }
            }
            else if (chars.indexOf(c) === -1) {
                return cursor;
            }
            backwards ? cursor-- : cursor++;
        }
        if (cursor === -1 || cursor === length) {
            // If we reached the beginning or end of the file, return the
            // out-of-bounds cursor. It's up to the caller to handle this
            // correctly. We don't want to indicate `false` though if it
            // actually skipped valid characters.
            return cursor;
        }
        return false;
    };
}
const skipWhitespace = skip(/\s/);
const skipSpaces = skip(" \t");
const skipToLineEnd = skip(",; \t");
const skipEverythingButNewLine = skip(/[^\r\n]/);
function skipInlineComment(text, index) {
    if (index === false) {
        return false;
    }
    if (text.charAt(index) === "/" && text.charAt(index + 1) === "*") {
        for (let i = index + 2; i < text.length; ++i) {
            if (text.charAt(i) === "*" && text.charAt(i + 1) === "/") {
                return i + 2;
            }
        }
    }
    return index;
}
function skipTrailingComment(text, index) {
    if (index === false) {
        return false;
    }
    if (text.charAt(index) === "/" && text.charAt(index + 1) === "/") {
        return skipEverythingButNewLine(text, index);
    }
    return index;
}
// This one doesn't use the above helper function because it wants to
// test \r\n in order and `skip` doesn't support ordering and we only
// want to skip one newline. It's simple to implement.
function skipNewline(text, index, opts) {
    const backwards = opts && opts.backwards;
    if (index === false) {
        return false;
    }
    const atIndex = text.charAt(index);
    if (backwards) {
        if (text.charAt(index - 1) === "\r" && atIndex === "\n") {
            return index - 2;
        }
        if (atIndex === "\n" ||
            atIndex === "\r" ||
            atIndex === "\u2028" ||
            atIndex === "\u2029") {
            return index - 1;
        }
    }
    else {
        if (atIndex === "\r" && text.charAt(index + 1) === "\n") {
            return index + 2;
        }
        if (atIndex === "\n" ||
            atIndex === "\r" ||
            atIndex === "\u2028" ||
            atIndex === "\u2029") {
            return index + 1;
        }
    }
    return index;
}
function hasNewline(text, index, opts) {
    opts = opts || {};
    const idx = skipSpaces(text, opts.backwards ? index - 1 : index, opts);
    const idx2 = skipNewline(text, idx, opts);
    return idx !== idx2;
}
function hasNewlineInRange(text, start, end) {
    for (let i = start; i < end; ++i) {
        if (text.charAt(i) === "\n") {
            return true;
        }
    }
    return false;
}
// Note: this function doesn't ignore leading comments unlike isNextLineEmpty
function isPreviousLineEmpty(text, node) {
    let idx = locStart$1(node) - 1;
    idx = skipSpaces(text, idx, { backwards: true });
    idx = skipNewline(text, idx, { backwards: true });
    idx = skipSpaces(text, idx, { backwards: true });
    const idx2 = skipNewline(text, idx, { backwards: true });
    return idx !== idx2;
}
function isNextLineEmpty(text, node) {
    let oldIdx = null;
    let idx = locEnd$1(node);
    while (idx !== oldIdx) {
        // We need to skip all the potential trailing inline comments
        oldIdx = idx;
        idx = skipToLineEnd(text, idx);
        idx = skipInlineComment(text, idx);
        idx = skipSpaces(text, idx);
    }
    idx = skipTrailingComment(text, idx);
    idx = skipNewline(text, idx);
    return hasNewline(text, idx);
}
function getNextNonSpaceNonCommentCharacter$1(text, node) {
    let oldIdx = null;
    let idx = locEnd$1(node);
    while (idx !== oldIdx) {
        oldIdx = idx;
        idx = skipSpaces(text, idx);
        idx = skipInlineComment(text, idx);
        idx = skipTrailingComment(text, idx);
        idx = skipNewline(text, idx);
    }
    return text.charAt(idx);
}
function hasSpaces(text, index, opts) {
    opts = opts || {};
    const idx = skipSpaces(text, opts.backwards ? index - 1 : index, opts);
    return idx !== index;
}
function locStart$1(node) {
    // Handle nodes with decorators. They should start at the first decorator
    if (node.declaration &&
        node.declaration.decorators &&
        node.declaration.decorators.length > 0) {
        return locStart$1(node.declaration.decorators[0]);
    }
    if (node.decorators && node.decorators.length > 0) {
        return locStart$1(node.decorators[0]);
    }
    if (node.__location) {
        return node.__location.startOffset;
    }
    if (node.range) {
        return node.range[0];
    }
    if (typeof node.start === "number") {
        return node.start;
    }
    if (node.source) {
        return lineColumnToIndex(node.source.start, node.source.input.css) - 1;
    }
    if (node.loc) {
        return node.loc.start;
    }
}
function locEnd$1(node) {
    const endNode = node.nodes && getLast(node.nodes);
    if (endNode && node.source && !node.source.end) {
        node = endNode;
    }
    let loc;
    if (node.range) {
        loc = node.range[1];
    }
    else if (typeof node.end === "number") {
        loc = node.end;
    }
    else if (node.source) {
        loc = lineColumnToIndex(node.source.end, node.source.input.css);
    }
    if (node.__location) {
        return node.__location.endOffset;
    }
    if (node.typeAnnotation) {
        return Math.max(loc, locEnd$1(node.typeAnnotation));
    }
    if (node.loc && !loc) {
        return node.loc.end;
    }
    return loc;
}
// Super inefficient, needs to be cached.
function lineColumnToIndex(lineColumn, text) {
    let index = 0;
    for (let i = 0; i < lineColumn.line - 1; ++i) {
        index = text.indexOf("\n", index) + 1;
        if (index === -1) {
            return -1;
        }
    }
    return index + lineColumn.column;
}
function setLocStart(node, index) {
    if (node.range) {
        node.range[0] = index;
    }
    else {
        node.start = index;
    }
}
function setLocEnd(node, index) {
    if (node.range) {
        node.range[1] = index;
    }
    else {
        node.end = index;
    }
}
const PRECEDENCE = {};
[
    ["||"],
    ["&&"],
    ["|"],
    ["^"],
    ["&"],
    ["==", "===", "!=", "!=="],
    ["<", ">", "<=", ">=", "in", "instanceof"],
    [">>", "<<", ">>>"],
    ["+", "-"],
    ["*", "/", "%"],
    ["**"]
].forEach((tier, i) => {
    tier.forEach(op => {
        PRECEDENCE[op] = i;
    });
});
function getPrecedence(op) {
    return PRECEDENCE[op];
}
const equalityOperators = {
    "==": true,
    "!=": true,
    "===": true,
    "!==": true
};
const multiplicativeOperators = {
    "*": true,
    "/": true,
    "%": true
};
const bitshiftOperators = {
    ">>": true,
    ">>>": true,
    "<<": true
};
function shouldFlatten(parentOp, nodeOp) {
    if (getPrecedence(nodeOp) !== getPrecedence(parentOp)) {
        return false;
    }
    // ** is right-associative
    // x ** y ** z --> x ** (y ** z)
    if (parentOp === "**") {
        return false;
    }
    // x == y == z --> (x == y) == z
    if (equalityOperators[parentOp] && equalityOperators[nodeOp]) {
        return false;
    }
    // x * y % z --> (x * y) % z
    if ((nodeOp === "%" && multiplicativeOperators[parentOp]) ||
        (parentOp === "%" && multiplicativeOperators[nodeOp])) {
        return false;
    }
    // x << y << z --> (x << y) << z
    if (bitshiftOperators[parentOp] && bitshiftOperators[nodeOp]) {
        return false;
    }
    return true;
}
function isBitwiseOperator(operator) {
    return (!!bitshiftOperators[operator] ||
        operator === "|" ||
        operator === "^" ||
        operator === "&");
}
// Tests if an expression starts with `{`, or (if forbidFunctionAndClass holds) `function` or `class`.
// Will be overzealous if there's already necessary grouping parentheses.
function startsWithNoLookaheadToken(node, forbidFunctionAndClass) {
    node = getLeftMost(node);
    switch (node.type) {
        // Hack. Remove after https://github.com/eslint/typescript-eslint-parser/issues/331
        case "ObjectPattern":
            return !forbidFunctionAndClass;
        case "FunctionExpression":
        case "ClassExpression":
            return forbidFunctionAndClass;
        case "ObjectExpression":
            return true;
        case "MemberExpression":
            return startsWithNoLookaheadToken(node.object, forbidFunctionAndClass);
        case "TaggedTemplateExpression":
            if (node.tag.type === "FunctionExpression") {
                // IIFEs are always already parenthesized
                return false;
            }
            return startsWithNoLookaheadToken(node.tag, forbidFunctionAndClass);
        case "CallExpression":
            if (node.callee.type === "FunctionExpression") {
                // IIFEs are always already parenthesized
                return false;
            }
            return startsWithNoLookaheadToken(node.callee, forbidFunctionAndClass);
        case "ConditionalExpression":
            return startsWithNoLookaheadToken(node.test, forbidFunctionAndClass);
        case "UpdateExpression":
            return (!node.prefix &&
                startsWithNoLookaheadToken(node.argument, forbidFunctionAndClass));
        case "BindExpression":
            return (node.object &&
                startsWithNoLookaheadToken(node.object, forbidFunctionAndClass));
        case "SequenceExpression":
            return startsWithNoLookaheadToken(node.expressions[0], forbidFunctionAndClass);
        case "TSAsExpression":
            return startsWithNoLookaheadToken(node.expression, forbidFunctionAndClass);
        default:
            return false;
    }
}
function getLeftMost(node) {
    if (node.left) {
        return getLeftMost(node.left);
    }
    return node;
}
function hasBlockComments(node) {
    return node.comments && node.comments.some(isBlockComment);
}
function isBlockComment(comment) {
    return comment.type === "Block" || comment.type === "CommentBlock";
}
function getAlignmentSize(value, tabWidth, startIndex) {
    startIndex = startIndex || 0;
    let size = 0;
    for (let i = startIndex; i < value.length; ++i) {
        if (value[i] === "\t") {
            // Tabs behave in a way that they are aligned to the nearest
            // multiple of tabWidth:
            // 0 -> 4, 1 -> 4, 2 -> 4, 3 -> 4
            // 4 -> 8, 5 -> 8, 6 -> 8, 7 -> 8 ...
            size = size + tabWidth - size % tabWidth;
        }
        else {
            size++;
        }
    }
    return size;
}
var util$3 = {
    getPrecedence,
    shouldFlatten,
    isBitwiseOperator,
    isExportDeclaration,
    getParentExportDeclaration,
    getPenultimate,
    getLast,
    getNextNonSpaceNonCommentCharacter: getNextNonSpaceNonCommentCharacter$1,
    skipWhitespace,
    skipSpaces,
    skipNewline,
    isNextLineEmpty,
    isPreviousLineEmpty,
    hasNewline,
    hasNewlineInRange,
    hasSpaces,
    locStart: locStart$1,
    locEnd: locEnd$1,
    setLocStart,
    setLocEnd,
    startsWithNoLookaheadToken,
    hasBlockComments,
    isBlockComment,
    getAlignmentSize
};
const assert = require$$0;
const docBuilders = docBuilders$1;
const concat = docBuilders.concat;
const hardline = docBuilders.hardline;
const breakParent = docBuilders.breakParent;
const indent = docBuilders.indent;
const lineSuffix = docBuilders.lineSuffix;
const join = docBuilders.join;
const cursor = docBuilders.cursor;
const util$2 = util$3;
const childNodesCacheKey = Symbol("child-nodes");
const locStart = util$2.locStart;
const locEnd = util$2.locEnd;
const getNextNonSpaceNonCommentCharacter = util$2.getNextNonSpaceNonCommentCharacter;
function getSortedChildNodes(node, text, resultArray) {
    if (!node) {
        return;
    }
    if (resultArray) {
        if (node &&
            ((node.type &&
                node.type !== "CommentBlock" &&
                node.type !== "CommentLine" &&
                node.type !== "Line" &&
                node.type !== "Block" &&
                node.type !== "EmptyStatement" &&
                node.type !== "TemplateElement") ||
                (node.kind && node.kind !== "Comment"))) {
            // This reverse insertion sort almost always takes constant
            // time because we almost always (maybe always?) append the
            // nodes in order anyway.
            let i;
            for (i = resultArray.length - 1; i >= 0; --i) {
                if (locStart(resultArray[i]) <= locStart(node) &&
                    locEnd(resultArray[i]) <= locEnd(node)) {
                    break;
                }
            }
            resultArray.splice(i + 1, 0, node);
            return;
        }
    }
    else if (node[childNodesCacheKey]) {
        return node[childNodesCacheKey];
    }
    let names;
    if (node && typeof node === "object") {
        names = Object.keys(node).filter(n => n !== "enclosingNode" && n !== "precedingNode" && n !== "followingNode");
    }
    else {
        return;
    }
    if (!resultArray) {
        Object.defineProperty(node, childNodesCacheKey, {
            value: (resultArray = []),
            enumerable: false
        });
    }
    for (let i = 0, nameCount = names.length; i < nameCount; ++i) {
        getSortedChildNodes(node[names[i]], text, resultArray);
    }
    return resultArray;
}
// As efficiently as possible, decorate the comment object with
// .precedingNode, .enclosingNode, and/or .followingNode properties, at
// least one of which is guaranteed to be defined.
function decorateComment(node, comment, text) {
    const childNodes = getSortedChildNodes(node, text);
    let precedingNode;
    let followingNode;
    // Time to dust off the old binary search robes and wizard hat.
    let left = 0;
    let right = childNodes.length;
    while (left < right) {
        const middle = (left + right) >> 1;
        const child = childNodes[middle];
        if (locStart(child) - locStart(comment) <= 0 &&
            locEnd(comment) - locEnd(child) <= 0) {
            // The comment is completely contained by this child node.
            comment.enclosingNode = child;
            decorateComment(child, comment, text);
            return; // Abandon the binary search at this level.
        }
        if (locEnd(child) - locStart(comment) <= 0) {
            // This child node falls completely before the comment.
            // Because we will never consider this node or any nodes
            // before it again, this node must be the closest preceding
            // node we have encountered so far.
            precedingNode = child;
            left = middle + 1;
            continue;
        }
        if (locEnd(comment) - locStart(child) <= 0) {
            // This child node falls completely after the comment.
            // Because we will never consider this node or any nodes after
            // it again, this node must be the closest following node we
            // have encountered so far.
            followingNode = child;
            right = middle;
            continue;
        }
        throw new Error("Comment location overlaps with node location");
    }
    // We don't want comments inside of different expressions inside of the same
    // template literal to move to another expression.
    if (comment.enclosingNode &&
        comment.enclosingNode.type === "TemplateLiteral") {
        const quasis = comment.enclosingNode.quasis;
        const commentIndex = findExpressionIndexForComment(quasis, comment);
        if (precedingNode &&
            findExpressionIndexForComment(quasis, precedingNode) !== commentIndex) {
            precedingNode = null;
        }
        if (followingNode &&
            findExpressionIndexForComment(quasis, followingNode) !== commentIndex) {
            followingNode = null;
        }
    }
    if (precedingNode) {
        comment.precedingNode = precedingNode;
    }
    if (followingNode) {
        comment.followingNode = followingNode;
    }
}
function attach(comments, ast, text) {
    if (!Array.isArray(comments)) {
        return;
    }
    const tiesToBreak = [];
    comments.forEach((comment, i) => {
        decorateComment(ast, comment, text);
        const precedingNode = comment.precedingNode;
        const enclosingNode = comment.enclosingNode;
        const followingNode = comment.followingNode;
        const isLastComment = comments.length - 1 === i;
        if (util$2.hasNewline(text, locStart(comment), { backwards: true })) {
            // If a comment exists on its own line, prefer a leading comment.
            // We also need to check if it's the first line of the file.
            if (handleLastFunctionArgComments(text, precedingNode, enclosingNode, followingNode, comment) ||
                handleMemberExpressionComments(enclosingNode, followingNode, comment) ||
                handleIfStatementComments(text, precedingNode, enclosingNode, followingNode, comment) ||
                handleTryStatementComments(enclosingNode, followingNode, comment) ||
                handleClassComments(enclosingNode, comment) ||
                handleImportSpecifierComments(enclosingNode, comment) ||
                handleObjectPropertyComments(enclosingNode, comment) ||
                handleForComments(enclosingNode, precedingNode, comment) ||
                handleUnionTypeComments(precedingNode, enclosingNode, followingNode, comment) ||
                handleOnlyComments(enclosingNode, ast, comment, isLastComment) ||
                handleImportDeclarationComments(text, enclosingNode, precedingNode, comment) ||
                handleAssignmentPatternComments(enclosingNode, comment)) {
                // We're good
            }
            else if (followingNode) {
                // Always a leading comment.
                addLeadingComment(followingNode, comment);
            }
            else if (precedingNode) {
                addTrailingComment(precedingNode, comment);
            }
            else if (enclosingNode) {
                addDanglingComment(enclosingNode, comment);
            }
            else {
                // There are no nodes, let's attach it to the root of the ast
                addDanglingComment(ast, comment);
            }
        }
        else if (util$2.hasNewline(text, locEnd(comment))) {
            if (handleLastFunctionArgComments(text, precedingNode, enclosingNode, followingNode, comment) ||
                handleConditionalExpressionComments(enclosingNode, precedingNode, followingNode, comment, text) ||
                handleImportSpecifierComments(enclosingNode, comment) ||
                handleIfStatementComments(text, precedingNode, enclosingNode, followingNode, comment) ||
                handleClassComments(enclosingNode, comment) ||
                handleLabeledStatementComments(enclosingNode, comment) ||
                handleCallExpressionComments(precedingNode, enclosingNode, comment) ||
                handlePropertyComments(enclosingNode, comment) ||
                handleExportNamedDeclarationComments(enclosingNode, comment) ||
                handleOnlyComments(enclosingNode, ast, comment, isLastComment) ||
                handleClassMethodComments(enclosingNode, comment) ||
                handleTypeAliasComments(enclosingNode, followingNode, comment) ||
                handleVariableDeclaratorComments(enclosingNode, followingNode, comment)) {
                // We're good
            }
            else if (precedingNode) {
                // There is content before this comment on the same line, but
                // none after it, so prefer a trailing comment of the previous node.
                addTrailingComment(precedingNode, comment);
            }
            else if (followingNode) {
                addLeadingComment(followingNode, comment);
            }
            else if (enclosingNode) {
                addDanglingComment(enclosingNode, comment);
            }
            else {
                // There are no nodes, let's attach it to the root of the ast
                addDanglingComment(ast, comment);
            }
        }
        else {
            if (handleIfStatementComments(text, precedingNode, enclosingNode, followingNode, comment) ||
                handleObjectPropertyAssignment(enclosingNode, precedingNode, comment) ||
                handleCommentInEmptyParens(text, enclosingNode, comment) ||
                handleMethodNameComments(enclosingNode, precedingNode, comment) ||
                handleOnlyComments(enclosingNode, ast, comment, isLastComment)) {
                // We're good
            }
            else if (precedingNode && followingNode) {
                // Otherwise, text exists both before and after the comment on
                // the same line. If there is both a preceding and following
                // node, use a tie-breaking algorithm to determine if it should
                // be attached to the next or previous node. In the last case,
                // simply attach the right node;
                const tieCount = tiesToBreak.length;
                if (tieCount > 0) {
                    const lastTie = tiesToBreak[tieCount - 1];
                    if (lastTie.followingNode !== comment.followingNode) {
                        breakTies(tiesToBreak, text);
                    }
                }
                tiesToBreak.push(comment);
            }
            else if (precedingNode) {
                addTrailingComment(precedingNode, comment);
            }
            else if (followingNode) {
                addLeadingComment(followingNode, comment);
            }
            else if (enclosingNode) {
                addDanglingComment(enclosingNode, comment);
            }
            else {
                // There are no nodes, let's attach it to the root of the ast
                addDanglingComment(ast, comment);
            }
        }
    });
    breakTies(tiesToBreak, text);
    comments.forEach(comment => {
        // These node references were useful for breaking ties, but we
        // don't need them anymore, and they create cycles in the AST that
        // may lead to infinite recursion if we don't delete them here.
        delete comment.precedingNode;
        delete comment.enclosingNode;
        delete comment.followingNode;
    });
}
function breakTies(tiesToBreak, text) {
    const tieCount = tiesToBreak.length;
    if (tieCount === 0) {
        return;
    }
    const precedingNode = tiesToBreak[0].precedingNode;
    const followingNode = tiesToBreak[0].followingNode;
    let gapEndPos = locStart(followingNode);
    // Iterate backwards through tiesToBreak, examining the gaps
    // between the tied comments. In order to qualify as leading, a
    // comment must be separated from followingNode by an unbroken series of
    // whitespace-only gaps (or other comments).
    let indexOfFirstLeadingComment;
    for (indexOfFirstLeadingComment = tieCount; indexOfFirstLeadingComment > 0; --indexOfFirstLeadingComment) {
        const comment = tiesToBreak[indexOfFirstLeadingComment - 1];
        assert.strictEqual(comment.precedingNode, precedingNode);
        assert.strictEqual(comment.followingNode, followingNode);
        const gap = text.slice(locEnd(comment), gapEndPos);
        if (/\S/.test(gap)) {
            // The gap string contained something other than whitespace.
            break;
        }
        gapEndPos = locStart(comment);
    }
    tiesToBreak.forEach((comment, i) => {
        if (i < indexOfFirstLeadingComment) {
            addTrailingComment(precedingNode, comment);
        }
        else {
            addLeadingComment(followingNode, comment);
        }
    });
    tiesToBreak.length = 0;
}
function addCommentHelper(node, comment) {
    const comments = node.comments || (node.comments = []);
    comments.push(comment);
    comment.printed = false;
    // For some reason, TypeScript parses `// x` inside of JSXText as a comment
    // We already "print" it via the raw text, we don't need to re-print it as a
    // comment
    if (node.type === "JSXText") {
        comment.printed = true;
    }
}
function addLeadingComment(node, comment) {
    comment.leading = true;
    comment.trailing = false;
    addCommentHelper(node, comment);
}
function addDanglingComment(node, comment) {
    comment.leading = false;
    comment.trailing = false;
    addCommentHelper(node, comment);
}
function addTrailingComment(node, comment) {
    comment.leading = false;
    comment.trailing = true;
    addCommentHelper(node, comment);
}
function addBlockStatementFirstComment(node, comment) {
    const body = node.body.filter(n => n.type !== "EmptyStatement");
    if (body.length === 0) {
        addDanglingComment(node, comment);
    }
    else {
        addLeadingComment(body[0], comment);
    }
}
function addBlockOrNotComment(node, comment) {
    if (node.type === "BlockStatement") {
        addBlockStatementFirstComment(node, comment);
    }
    else {
        addLeadingComment(node, comment);
    }
}
// There are often comments before the else clause of if statements like
//
//   if (1) { ... }
//   // comment
//   else { ... }
//
// They are being attached as leading comments of the BlockExpression which
// is not well printed. What we want is to instead move the comment inside
// of the block and make it leadingComment of the first element of the block
// or dangling comment of the block if there is nothing inside
//
//   if (1) { ... }
//   else {
//     // comment
//     ...
//   }
function handleIfStatementComments(text, precedingNode, enclosingNode, followingNode, comment) {
    if (!enclosingNode ||
        enclosingNode.type !== "IfStatement" ||
        !followingNode) {
        return false;
    }
    // We unfortunately have no way using the AST or location of nodes to know
    // if the comment is positioned before or after the condition parenthesis:
    //   if (a /* comment */) {}
    //   if (a) /* comment */ {}
    // The only workaround I found is to look at the next character to see if
    // it is a ).
    if (getNextNonSpaceNonCommentCharacter(text, comment) === ")") {
        addTrailingComment(precedingNode, comment);
        return true;
    }
    if (followingNode.type === "BlockStatement") {
        addBlockStatementFirstComment(followingNode, comment);
        return true;
    }
    if (followingNode.type === "IfStatement") {
        addBlockOrNotComment(followingNode.consequent, comment);
        return true;
    }
    return false;
}
// Same as IfStatement but for TryStatement
function handleTryStatementComments(enclosingNode, followingNode, comment) {
    if (!enclosingNode ||
        enclosingNode.type !== "TryStatement" ||
        !followingNode) {
        return false;
    }
    if (followingNode.type === "BlockStatement") {
        addBlockStatementFirstComment(followingNode, comment);
        return true;
    }
    if (followingNode.type === "TryStatement") {
        addBlockOrNotComment(followingNode.finalizer, comment);
        return true;
    }
    if (followingNode.type === "CatchClause") {
        addBlockOrNotComment(followingNode.body, comment);
        return true;
    }
    return false;
}
function handleMemberExpressionComments(enclosingNode, followingNode, comment) {
    if (enclosingNode &&
        enclosingNode.type === "MemberExpression" &&
        followingNode &&
        followingNode.type === "Identifier") {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleConditionalExpressionComments(enclosingNode, precedingNode, followingNode, comment, text) {
    const isSameLineAsPrecedingNode = precedingNode &&
        !util$2.hasNewlineInRange(text, locEnd(precedingNode), locStart(comment));
    if ((!precedingNode || !isSameLineAsPrecedingNode) &&
        enclosingNode &&
        enclosingNode.type === "ConditionalExpression" &&
        followingNode) {
        addLeadingComment(followingNode, comment);
        return true;
    }
    return false;
}
function handleObjectPropertyAssignment(enclosingNode, precedingNode, comment) {
    if (enclosingNode &&
        (enclosingNode.type === "ObjectProperty" ||
            enclosingNode.type === "Property") &&
        enclosingNode.shorthand &&
        enclosingNode.key === precedingNode &&
        enclosingNode.value.type === "AssignmentPattern") {
        addTrailingComment(enclosingNode.value.left, comment);
        return true;
    }
    return false;
}
function handleMethodNameComments(enclosingNode, precedingNode, comment) {
    // This is only needed for estree parsers (flow, typescript) to attach
    // after a method name:
    // obj = { fn /*comment*/() {} };
    if (enclosingNode &&
        precedingNode &&
        (enclosingNode.type === "Property" ||
            enclosingNode.type === "MethodDefinition") &&
        precedingNode.type === "Identifier" &&
        enclosingNode.key === precedingNode) {
        addTrailingComment(precedingNode, comment);
        return true;
    }
    return false;
}
function handleCommentInEmptyParens(text, enclosingNode, comment) {
    if (getNextNonSpaceNonCommentCharacter(text, comment) !== ")") {
        return false;
    }
    // Only add dangling comments to fix the case when no params are present,
    // i.e. a function without any argument.
    if (enclosingNode &&
        (((enclosingNode.type === "FunctionDeclaration" ||
            enclosingNode.type === "FunctionExpression" ||
            enclosingNode.type === "ArrowFunctionExpression" ||
            enclosingNode.type === "ClassMethod" ||
            enclosingNode.type === "ObjectMethod") &&
            enclosingNode.params.length === 0) ||
            (enclosingNode.type === "CallExpression" &&
                enclosingNode.arguments.length === 0))) {
        addDanglingComment(enclosingNode, comment);
        return true;
    }
    if (enclosingNode &&
        (enclosingNode.type === "MethodDefinition" &&
            enclosingNode.value.params.length === 0)) {
        addDanglingComment(enclosingNode.value, comment);
        return true;
    }
    return false;
}
function handleLastFunctionArgComments(text, precedingNode, enclosingNode, followingNode, comment) {
    // Type definitions functions
    if (precedingNode &&
        precedingNode.type === "FunctionTypeParam" &&
        enclosingNode &&
        enclosingNode.type === "FunctionTypeAnnotation" &&
        followingNode &&
        followingNode.type !== "FunctionTypeParam") {
        addTrailingComment(precedingNode, comment);
        return true;
    }
    // Real functions
    if (precedingNode &&
        (precedingNode.type === "Identifier" ||
            precedingNode.type === "AssignmentPattern") &&
        enclosingNode &&
        (enclosingNode.type === "ArrowFunctionExpression" ||
            enclosingNode.type === "FunctionExpression" ||
            enclosingNode.type === "FunctionDeclaration" ||
            enclosingNode.type === "ObjectMethod" ||
            enclosingNode.type === "ClassMethod") &&
        getNextNonSpaceNonCommentCharacter(text, comment) === ")") {
        addTrailingComment(precedingNode, comment);
        return true;
    }
    return false;
}
function handleClassComments(enclosingNode, comment) {
    if (enclosingNode &&
        (enclosingNode.type === "ClassDeclaration" ||
            enclosingNode.type === "ClassExpression")) {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleImportSpecifierComments(enclosingNode, comment) {
    if (enclosingNode && enclosingNode.type === "ImportSpecifier") {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleObjectPropertyComments(enclosingNode, comment) {
    if (enclosingNode && enclosingNode.type === "ObjectProperty") {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleLabeledStatementComments(enclosingNode, comment) {
    if (enclosingNode && enclosingNode.type === "LabeledStatement") {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleCallExpressionComments(precedingNode, enclosingNode, comment) {
    if (enclosingNode &&
        enclosingNode.type === "CallExpression" &&
        precedingNode &&
        enclosingNode.callee === precedingNode &&
        enclosingNode.arguments.length > 0) {
        addLeadingComment(enclosingNode.arguments[0], comment);
        return true;
    }
    return false;
}
function handleUnionTypeComments(precedingNode, enclosingNode, followingNode, comment) {
    if (enclosingNode &&
        (enclosingNode.type === "UnionTypeAnnotation" ||
            enclosingNode.type === "TSUnionType")) {
        addTrailingComment(precedingNode, comment);
        return true;
    }
    return false;
}
function handlePropertyComments(enclosingNode, comment) {
    if (enclosingNode &&
        (enclosingNode.type === "Property" ||
            enclosingNode.type === "ObjectProperty")) {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleExportNamedDeclarationComments(enclosingNode, comment) {
    if (enclosingNode && enclosingNode.type === "ExportNamedDeclaration") {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleOnlyComments(enclosingNode, ast, comment, isLastComment) {
    // With Flow the enclosingNode is undefined so use the AST instead.
    if (ast && ast.body && ast.body.length === 0) {
        if (isLastComment) {
            addDanglingComment(ast, comment);
        }
        else {
            addLeadingComment(ast, comment);
        }
        return true;
    }
    else if (enclosingNode &&
        enclosingNode.type === "Program" &&
        enclosingNode.body.length === 0 &&
        enclosingNode.directives &&
        enclosingNode.directives.length === 0) {
        if (isLastComment) {
            addDanglingComment(enclosingNode, comment);
        }
        else {
            addLeadingComment(enclosingNode, comment);
        }
        return true;
    }
    return false;
}
function handleForComments(enclosingNode, precedingNode, comment) {
    if (enclosingNode &&
        (enclosingNode.type === "ForInStatement" ||
            enclosingNode.type === "ForOfStatement")) {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleImportDeclarationComments(text, enclosingNode, precedingNode, comment) {
    if (precedingNode &&
        enclosingNode &&
        enclosingNode.type === "ImportDeclaration" &&
        util$2.hasNewline(text, util$2.locEnd(comment))) {
        addTrailingComment(precedingNode, comment);
        return true;
    }
    return false;
}
function handleAssignmentPatternComments(enclosingNode, comment) {
    if (enclosingNode && enclosingNode.type === "AssignmentPattern") {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleClassMethodComments(enclosingNode, comment) {
    if (enclosingNode && enclosingNode.type === "ClassMethod") {
        addTrailingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleTypeAliasComments(enclosingNode, followingNode, comment) {
    if (enclosingNode && enclosingNode.type === "TypeAlias") {
        addLeadingComment(enclosingNode, comment);
        return true;
    }
    return false;
}
function handleVariableDeclaratorComments(enclosingNode, followingNode, comment) {
    if (enclosingNode &&
        enclosingNode.type === "VariableDeclarator" &&
        followingNode &&
        (followingNode.type === "ObjectExpression" ||
            followingNode.type === "ArrayExpression")) {
        addLeadingComment(followingNode, comment);
        return true;
    }
    return false;
}
function printComment(commentPath, options) {
    const comment = commentPath.getValue();
    comment.printed = true;
    switch (comment.type || comment.kind) {
        case "Comment":
            return "#" + comment.value.trimRight();
        case "CommentBlock":
        case "Block":
            return "/*" + comment.value + "*/";
        case "CommentLine":
        case "Line":
            // Print shebangs with the proper comment characters
            if (options.originalText.slice(util$2.locStart(comment)).startsWith("#!")) {
                return "#!" + comment.value.trimRight();
            }
            return "//" + comment.value.trimRight();
        default:
            throw new Error("Not a comment: " + JSON.stringify(comment));
    }
}
function findExpressionIndexForComment(quasis, comment) {
    const startPos = locStart(comment) - 1;
    for (let i = 1; i < quasis.length; ++i) {
        if (startPos < getQuasiRange(quasis[i]).start) {
            return i - 1;
        }
    }
    // We haven't found it, it probably means that some of the locations are off.
    // Let's just return the first one.
    return 0;
}
function getQuasiRange(expr) {
    if (expr.start !== undefined) {
        // Babylon
        return { start: expr.start, end: expr.end };
    }
    // Flow
    return { start: expr.range[0], end: expr.range[1] };
}
function printLeadingComment(commentPath, print, options) {
    const comment = commentPath.getValue();
    const contents = printComment(commentPath, options);
    if (!contents) {
        return "";
    }
    const isBlock = util$2.isBlockComment(comment);
    // Leading block comments should see if they need to stay on the
    // same line or not.
    if (isBlock) {
        return concat([
            contents,
            util$2.hasNewline(options.originalText, locEnd(comment)) ? hardline : " "
        ]);
    }
    return concat([contents, hardline]);
}
function printTrailingComment(commentPath, print, options) {
    const comment = commentPath.getValue();
    const contents = printComment(commentPath, options);
    if (!contents) {
        return "";
    }
    const isBlock = util$2.isBlockComment(comment);
    if (util$2.hasNewline(options.originalText, locStart(comment), {
        backwards: true
    })) {
        // This allows comments at the end of nested structures:
        // {
        //   x: 1,
        //   y: 2
        //   // A comment
        // }
        // Those kinds of comments are almost always leading comments, but
        // here it doesn't go "outside" the block and turns it into a
        // trailing comment for `2`. We can simulate the above by checking
        // if this a comment on its own line; normal trailing comments are
        // always at the end of another expression.
        const isLineBeforeEmpty = util$2.isPreviousLineEmpty(options.originalText, comment);
        return lineSuffix(concat([hardline, isLineBeforeEmpty ? hardline : "", contents]));
    }
    else if (isBlock) {
        // Trailing block comments never need a newline
        return concat([" ", contents]);
    }
    return concat([lineSuffix(" " + contents), !isBlock ? breakParent : ""]);
}
function printDanglingComments(path, options, sameIndent) {
    const parts = [];
    const node = path.getValue();
    if (!node || !node.comments) {
        return "";
    }
    path.each(commentPath => {
        const comment = commentPath.getValue();
        if (comment && !comment.leading && !comment.trailing) {
            parts.push(printComment(commentPath, options));
        }
    }, "comments");
    if (parts.length === 0) {
        return "";
    }
    if (sameIndent) {
        return join(hardline, parts);
    }
    return indent(concat([hardline, join(hardline, parts)]));
}
function prependCursorPlaceholder(path, options, printed) {
    if (path.getNode() === options.cursorNode && path.getValue()) {
        return concat([cursor, printed]);
    }
    return printed;
}
function printComments(path, print, options, needsSemi) {
    const value = path.getValue();
    const printed = print(path);
    const comments = value && value.comments;
    if (!comments || comments.length === 0) {
        return prependCursorPlaceholder(path, options, printed);
    }
    const leadingParts = [];
    const trailingParts = [needsSemi ? ";" : "", printed];
    path.each(commentPath => {
        const comment = commentPath.getValue();
        const leading = comment.leading;
        const trailing = comment.trailing;
        if (leading) {
            const contents = printLeadingComment(commentPath, print, options);
            if (!contents) {
                return;
            }
            leadingParts.push(contents);
            const text = options.originalText;
            if (util$2.hasNewline(text, util$2.skipNewline(text, util$2.locEnd(comment)))) {
                leadingParts.push(hardline);
            }
        }
        else if (trailing) {
            trailingParts.push(printTrailingComment(commentPath, print, options));
        }
    }, "comments");
    return prependCursorPlaceholder(path, options, concat(leadingParts.concat(trailingParts)));
}
var comments$1 = {
    attach,
    printComments,
    printDanglingComments,
    getSortedChildNodes
};
var name = "prettier-miscellaneous";
var version$1 = "1.5.3";
var description = "Prettier Miscellaneous is a fork of Prettier with the goal of supporting minor extra options";
var bin = { "prettier": "./bin/prettier.js" };
var repository = "arijs/prettier-miscellaneous";
var homepage = "https://prettier.io";
var author = "Rafael Hengles";
var license = "MIT";
var main = "./index.js";
var dependencies = { "babel-code-frame": "7.0.0-alpha.12", "babylon": "7.0.0-beta.13", "chalk": "2.0.1", "cosmiconfig": "2.1.3", "dashify": "0.2.2", "diff": "3.2.0", "esutils": "2.0.2", "flow-parser": "0.47.0", "get-stream": "3.0.0", "globby": "^6.1.0", "graphql": "0.10.1", "ignore": "^3.3.3", "jest-validate": "20.0.3", "json-to-ast": "2.0.0-alpha1.2", "minimatch": "3.0.4", "minimist": "1.2.0", "parse5": "3.0.2", "postcss": "^6.0.1", "postcss-less": "^1.0.0", "postcss-media-query-parser": "0.2.3", "postcss-scss": "1.0.0", "postcss-selector-parser": "2.2.3", "postcss-values-parser": "git://github.com/shellscape/postcss-values-parser.git#5e351360479116f3fe309602cdd15b0a233bc29f", "strip-bom": "3.0.0", "typescript": "2.5.0-dev.20170617", "typescript-eslint-parser": "git://github.com/eslint/typescript-eslint-parser.git#7c38401aa1452e6cc493151b8ab3a591e4d5e74a" };
var devDependencies = { "babel-cli": "6.24.1", "babel-preset-es2015": "6.24.1", "codecov": "2.2.0", "cross-env": "5.0.1", "cross-spawn": "5.1.0", "eslint": "4.1.1", "eslint-friendly-formatter": "3.0.0", "eslint-plugin-import": "2.6.1", "eslint-plugin-prettier": "2.1.2", "eslint-plugin-react": "7.1.0", "jest": "20.0.0", "mkdirp": "^0.5.1", "prettier": "1.5.2", "rimraf": "2.6.1", "rollup": "0.41.1", "rollup-plugin-commonjs": "7.0.0", "rollup-plugin-json": "2.1.0", "rollup-plugin-node-builtins": "2.0.0", "rollup-plugin-node-globals": "1.1.0", "rollup-plugin-node-resolve": "2.0.0", "rollup-plugin-replace": "1.1.1", "shelljs": "0.7.8", "sw-toolbox": "3.6.0", "uglify-es": "3.0.15", "webpack": "2.6.1" };
var scripts = { "test": "jest", "posttest": "npm run test-tabs && npm run test-tabs-inv", "test-tabs": "node ./bin/prettier.js --use-tabs --bracket-spacing --trailing-comma array,object -- ./bin/prettier.js > ./bin/prettier-with-tabs.js", "test-tabs-inv": "node ./bin/prettier-with-tabs.js -- ./bin/prettier-with-tabs.js > ./bin/prettier-spaces.js", "test-integration": "jest tests_integration", "lint": "cross-env EFF_NO_LINK_RULES=true eslint . --format node_modules/eslint-friendly-formatter", "build": "./scripts/build/build.js" };
var _package = {
    name: name,
    version: version$1,
    description: description,
    bin: bin,
    repository: repository,
    homepage: homepage,
    author: author,
    license: license,
    main: main,
    dependencies: dependencies,
    devDependencies: devDependencies,
    scripts: scripts
};
var _package$1 = Object.freeze({
    name: name,
    version: version$1,
    description: description,
    bin: bin,
    repository: repository,
    homepage: homepage,
    author: author,
    license: license,
    main: main,
    dependencies: dependencies,
    devDependencies: devDependencies,
    scripts: scripts,
    default: _package
});
const assert$2 = require$$0;
const util$6 = util$3;
const startsWithNoLookaheadToken$1 = util$6.startsWithNoLookaheadToken;
function FastPath$1(value) {
    assert$2.ok(this instanceof FastPath$1);
    this.stack = [value];
}
// The name of the current property is always the penultimate element of
// this.stack, and always a String.
FastPath$1.prototype.getName = function getName() {
    const s = this.stack;
    const len = s.length;
    if (len > 1) {
        return s[len - 2];
    }
    // Since the name is always a string, null is a safe sentinel value to
    // return if we do not know the name of the (root) value.
    return null;
};
// The value of the current property is always the final element of
// this.stack.
FastPath$1.prototype.getValue = function getValue() {
    const s = this.stack;
    return s[s.length - 1];
};
function getNodeHelper(path, count) {
    const s = path.stack;
    for (let i = s.length - 1; i >= 0; i -= 2) {
        const value = s[i];
        if (value && !Array.isArray(value) && --count < 0) {
            return value;
        }
    }
    return null;
}
FastPath$1.prototype.getNode = function getNode(count) {
    return getNodeHelper(this, ~~count);
};
FastPath$1.prototype.getParentNode = function getParentNode(count) {
    return getNodeHelper(this, ~~count + 1);
};
// Temporarily push properties named by string arguments given after the
// callback function onto this.stack, then call the callback with a
// reference to this (modified) FastPath object. Note that the stack will
// be restored to its original state after the callback is finished, so it
// is probably a mistake to retain a reference to the path.
FastPath$1.prototype.call = function call(callback /*, name1, name2, ... */) {
    const s = this.stack;
    const origLen = s.length;
    let value = s[origLen - 1];
    const argc = arguments.length;
    for (let i = 1; i < argc; ++i) {
        const name = arguments[i];
        value = value[name];
        s.push(name, value);
    }
    const result = callback(this);
    s.length = origLen;
    return result;
};
// Similar to FastPath.prototype.call, except that the value obtained by
// accessing this.getValue()[name1][name2]... should be array-like. The
// callback will be called with a reference to this path object for each
// element of the array.
FastPath$1.prototype.each = function each(callback /*, name1, name2, ... */) {
    const s = this.stack;
    const origLen = s.length;
    let value = s[origLen - 1];
    const argc = arguments.length;
    for (let i = 1; i < argc; ++i) {
        const name = arguments[i];
        value = value[name];
        s.push(name, value);
    }
    for (let i = 0; i < value.length; ++i) {
        if (i in value) {
            s.push(i, value[i]);
            // If the callback needs to know the value of i, call
            // path.getName(), assuming path is the parameter name.
            callback(this);
            s.length -= 2;
        }
    }
    s.length = origLen;
};
// Similar to FastPath.prototype.each, except that the results of the
// callback function invocations are stored in an array and returned at
// the end of the iteration.
FastPath$1.prototype.map = function map(callback /*, name1, name2, ... */) {
    const s = this.stack;
    const origLen = s.length;
    let value = s[origLen - 1];
    const argc = arguments.length;
    for (let i = 1; i < argc; ++i) {
        const name = arguments[i];
        value = value[name];
        s.push(name, value);
    }
    const result = new Array(value.length);
    for (let i = 0; i < value.length; ++i) {
        if (i in value) {
            s.push(i, value[i]);
            result[i] = callback(this, i);
            s.length -= 2;
        }
    }
    s.length = origLen;
    return result;
};
FastPath$1.prototype.needsParens = function (options) {
    const parent = this.getParentNode();
    if (!parent) {
        return false;
    }
    const name = this.getName();
    const node = this.getNode();
    // If the value of this path is some child of a Node and not a Node
    // itself, then it doesn't need parentheses. Only Node objects (in
    // fact, only Expression nodes) need parentheses.
    if (this.getValue() !== node) {
        return false;
    }
    // Only statements don't need parentheses.
    if (isStatement(node)) {
        return false;
    }
    // Identifiers never need parentheses.
    if (node.type === "Identifier") {
        return false;
    }
    if (parent.type === "ParenthesizedExpression") {
        return false;
    }
    // Add parens around the extends clause of a class. It is needed for almost
    // all expressions.
    if ((parent.type === "ClassDeclaration" || parent.type === "ClassExpression") &&
        parent.superClass === node &&
        (node.type === "ArrowFunctionExpression" ||
            node.type === "AssignmentExpression" ||
            node.type === "AwaitExpression" ||
            node.type === "BinaryExpression" ||
            node.type === "ConditionalExpression" ||
            node.type === "LogicalExpression" ||
            node.type === "NewExpression" ||
            node.type === "ObjectExpression" ||
            node.type === "ParenthesizedExpression" ||
            node.type === "SequenceExpression" ||
            node.type === "TaggedTemplateExpression" ||
            node.type === "UnaryExpression" ||
            node.type === "UpdateExpression" ||
            node.type === "YieldExpression")) {
        return true;
    }
    if ((parent.type === "ArrowFunctionExpression" &&
        parent.body === node &&
        node.type !== "SequenceExpression" &&
        startsWithNoLookaheadToken$1(node, /* forbidFunctionAndClass */ false)) ||
        (parent.type === "ExpressionStatement" &&
            startsWithNoLookaheadToken$1(node, /* forbidFunctionAndClass */ true))) {
        return true;
    }
    switch (node.type) {
        case "CallExpression": {
            let firstParentNotMemberExpression = parent;
            let i = 0;
            while (firstParentNotMemberExpression &&
                firstParentNotMemberExpression.type === "MemberExpression") {
                firstParentNotMemberExpression = this.getParentNode(++i);
            }
            if (firstParentNotMemberExpression.type === "NewExpression" &&
                firstParentNotMemberExpression.callee === this.getParentNode(i - 1)) {
                return true;
            }
            return false;
        }
        case "SpreadElement":
        case "SpreadProperty":
            return (parent.type === "MemberExpression" &&
                name === "object" &&
                parent.object === node);
        case "UpdateExpression":
            if (parent.type === "UnaryExpression") {
                return (node.prefix &&
                    ((node.operator === "++" && parent.operator === "+") ||
                        (node.operator === "--" && parent.operator === "-")));
            }
        // else fallthrough
        case "UnaryExpression":
            switch (parent.type) {
                case "UnaryExpression":
                    return (node.operator === parent.operator &&
                        (node.operator === "+" || node.operator === "-"));
                case "MemberExpression":
                    return name === "object" && parent.object === node;
                case "TaggedTemplateExpression":
                    return true;
                case "NewExpression":
                case "CallExpression":
                    return name === "callee" && parent.callee === node;
                case "BinaryExpression":
                    return parent.operator === "**" && name === "left";
                default:
                    return false;
            }
        case "BinaryExpression": {
            if (parent.type === "UpdateExpression") {
                return true;
            }
            const isLeftOfAForStatement = node => {
                let i = 0;
                while (node) {
                    const parent = this.getParentNode(i++);
                    if (!parent) {
                        return false;
                    }
                    if (parent.type === "ForStatement" && parent.init === node) {
                        return true;
                    }
                    node = parent;
                }
                return false;
            };
            if (node.operator === "in" && isLeftOfAForStatement(node)) {
                return true;
            }
        }
        // fallthrough
        case "TSTypeAssertionExpression":
        case "TSAsExpression":
        case "LogicalExpression":
            switch (parent.type) {
                case "CallExpression":
                case "NewExpression":
                    return name === "callee" && parent.callee === node;
                case "ClassDeclaration":
                    return name === "superClass" && parent.superClass === node;
                case "TSTypeAssertionExpression":
                case "TaggedTemplateExpression":
                case "UnaryExpression":
                case "SpreadElement":
                case "SpreadProperty":
                case "BindExpression":
                case "AwaitExpression":
                case "TSAsExpression":
                case "TSNonNullExpression":
                    return true;
                case "MemberExpression":
                    return name === "object" && parent.object === node;
                case "BinaryExpression":
                case "LogicalExpression": {
                    if (!node.operator && node.type !== "TSTypeAssertionExpression") {
                        return true;
                    }
                    const po = parent.operator;
                    const pp = util$6.getPrecedence(po);
                    const no = node.operator;
                    const np = util$6.getPrecedence(no);
                    if (pp > np) {
                        return true;
                    }
                    if (po === "||" && no === "&&") {
                        return true;
                    }
                    if (pp === np && name === "right") {
                        assert$2.strictEqual(parent.right, node);
                        return true;
                    }
                    if (pp === np && !util$6.shouldFlatten(po, no)) {
                        return true;
                    }
                    // Add parenthesis when working with binary operators
                    // It's not stricly needed but helps with code understanding
                    if (util$6.isBitwiseOperator(po)) {
                        return true;
                    }
                    return false;
                }
                default:
                    return false;
            }
        case "TSParenthesizedType": {
            const grandParent = this.getParentNode(1);
            if ((parent.type === "TypeParameter" ||
                parent.type === "VariableDeclarator" ||
                parent.type === "TypeAnnotation" ||
                parent.type === "GenericTypeAnnotation") &&
                (node.typeAnnotation.type === "TypeAnnotation" &&
                    node.typeAnnotation.typeAnnotation.type !== "TSFunctionType" &&
                    grandParent.type !== "TSTypeOperator")) {
                return false;
            }
            // Delegate to inner TSParenthesizedType
            if (node.typeAnnotation.type === "TSParenthesizedType") {
                return false;
            }
            return true;
        }
        case "SequenceExpression":
            switch (parent.type) {
                case "ReturnStatement":
                    return false;
                case "ForStatement":
                    // Although parentheses wouldn't hurt around sequence
                    // expressions in the head of for loops, traditional style
                    // dictates that e.g. i++, j++ should not be wrapped with
                    // parentheses.
                    return false;
                case "ExpressionStatement":
                    return name !== "expression";
                case "ArrowFunctionExpression":
                    // We do need parentheses, but SequenceExpressions are handled
                    // specially when printing bodies of arrow functions.
                    return name !== "body";
                default:
                    // Otherwise err on the side of overparenthesization, adding
                    // explicit exceptions above if this proves overzealous.
                    return true;
            }
        case "YieldExpression":
            if (parent.type === "UnaryExpression" ||
                parent.type === "AwaitExpression" ||
                parent.type === "TSAsExpression" ||
                parent.type === "TSNonNullExpression") {
                return true;
            }
        // else fallthrough
        case "AwaitExpression":
            switch (parent.type) {
                case "TaggedTemplateExpression":
                case "BinaryExpression":
                case "LogicalExpression":
                case "SpreadElement":
                case "SpreadProperty":
                case "TSAsExpression":
                case "TSNonNullExpression":
                    return true;
                case "MemberExpression":
                    return parent.object === node;
                case "NewExpression":
                case "CallExpression":
                    return parent.callee === node;
                case "ConditionalExpression":
                    return parent.test === node;
                default:
                    return false;
            }
        case "ArrayTypeAnnotation":
            return parent.type === "NullableTypeAnnotation";
        case "IntersectionTypeAnnotation":
        case "UnionTypeAnnotation":
            return (parent.type === "ArrayTypeAnnotation" ||
                parent.type === "NullableTypeAnnotation" ||
                parent.type === "IntersectionTypeAnnotation" ||
                parent.type === "UnionTypeAnnotation");
        case "NullableTypeAnnotation":
            return parent.type === "ArrayTypeAnnotation";
        case "FunctionTypeAnnotation":
            return (parent.type === "UnionTypeAnnotation" ||
                parent.type === "IntersectionTypeAnnotation");
        case "StringLiteral":
        case "NumericLiteral":
        case "Literal":
            if (typeof node.value === "string" &&
                parent.type === "ExpressionStatement" &&
                // TypeScript workaround for eslint/typescript-eslint-parser#267
                // See corresponding workaround in printer.js case: "Literal"
                ((options.parser !== "typescript" && !parent.directive) ||
                    (options.parser === "typescript" &&
                        options.originalText.substr(util$6.locStart(node) - 1, 1) === "("))) {
                // To avoid becoming a directive
                const grandParent = this.getParentNode(1);
                return (grandParent.type === "Program" ||
                    grandParent.type === "BlockStatement");
            }
            return (parent.type === "MemberExpression" &&
                typeof node.value === "number" &&
                name === "object" &&
                parent.object === node);
        case "AssignmentExpression": {
            const grandParent = this.getParentNode(1);
            if (parent.type === "ArrowFunctionExpression" && parent.body === node) {
                return true;
            }
            else if (parent.type === "ClassProperty" &&
                parent.key === node &&
                parent.computed) {
                return false;
            }
            else if (parent.type === "TSPropertySignature" &&
                parent.name === node) {
                return false;
            }
            else if (parent.type === "ForStatement" &&
                (parent.init === node || parent.update === node)) {
                return false;
            }
            else if (parent.type === "ExpressionStatement") {
                return node.left.type === "ObjectPattern";
            }
            else if (parent.type === "TSPropertySignature" && parent.key === node) {
                return false;
            }
            else if (parent.type === "AssignmentExpression") {
                return false;
            }
            else if (parent.type === "SequenceExpression" &&
                grandParent &&
                grandParent.type === "ForStatement" &&
                (grandParent.init === parent || grandParent.update === parent)) {
                return false;
            }
            return true;
        }
        case "ConditionalExpression":
            switch (parent.type) {
                case "TaggedTemplateExpression":
                case "UnaryExpression":
                case "SpreadElement":
                case "SpreadProperty":
                case "BinaryExpression":
                case "LogicalExpression":
                case "ExportDefaultDeclaration":
                case "AwaitExpression":
                case "JSXSpreadAttribute":
                case "TSTypeAssertionExpression":
                case "TSAsExpression":
                case "TSNonNullExpression":
                    return true;
                case "NewExpression":
                case "CallExpression":
                    return name === "callee" && parent.callee === node;
                case "ConditionalExpression":
                    return name === "test" && parent.test === node;
                case "MemberExpression":
                    return name === "object" && parent.object === node;
                default:
                    return false;
            }
        case "FunctionExpression":
            switch (parent.type) {
                case "CallExpression":
                    return name === "callee"; // Not strictly necessary, but it's clearer to the reader if IIFEs are wrapped in parentheses.
                case "TaggedTemplateExpression":
                    return true; // This is basically a kind of IIFE.
                case "ExportDefaultDeclaration":
                    return true;
                default:
                    return false;
            }
        case "ArrowFunctionExpression":
            switch (parent.type) {
                case "CallExpression":
                    return name === "callee";
                case "NewExpression":
                    return name === "callee";
                case "MemberExpression":
                    return name === "object";
                case "TSAsExpression":
                case "BindExpression":
                case "TaggedTemplateExpression":
                case "UnaryExpression":
                case "LogicalExpression":
                case "BinaryExpression":
                case "AwaitExpression":
                case "TSTypeAssertionExpression":
                    return true;
                case "ConditionalExpression":
                    return name === "test";
                default:
                    return false;
            }
        case "ClassExpression":
            return parent.type === "ExportDefaultDeclaration";
    }
    return false;
};
function isStatement(node) {
    return (node.type === "BlockStatement" ||
        node.type === "BreakStatement" ||
        node.type === "ClassBody" ||
        node.type === "ClassDeclaration" ||
        node.type === "ClassMethod" ||
        node.type === "ClassProperty" ||
        node.type === "ContinueStatement" ||
        node.type === "DebuggerStatement" ||
        node.type === "DeclareClass" ||
        node.type === "DeclareExportAllDeclaration" ||
        node.type === "DeclareExportDeclaration" ||
        node.type === "DeclareFunction" ||
        node.type === "DeclareInterface" ||
        node.type === "DeclareModule" ||
        node.type === "DeclareModuleExports" ||
        node.type === "DeclareVariable" ||
        node.type === "DoWhileStatement" ||
        node.type === "ExportAllDeclaration" ||
        node.type === "ExportDefaultDeclaration" ||
        node.type === "ExportNamedDeclaration" ||
        node.type === "ExpressionStatement" ||
        node.type === "ForAwaitStatement" ||
        node.type === "ForInStatement" ||
        node.type === "ForOfStatement" ||
        node.type === "ForStatement" ||
        node.type === "FunctionDeclaration" ||
        node.type === "IfStatement" ||
        node.type === "ImportDeclaration" ||
        node.type === "InterfaceDeclaration" ||
        node.type === "LabeledStatement" ||
        node.type === "MethodDefinition" ||
        node.type === "ReturnStatement" ||
        node.type === "SwitchStatement" ||
        node.type === "ThrowStatement" ||
        node.type === "TryStatement" ||
        node.type === "TSAbstractClassDeclaration" ||
        node.type === "TSEnumDeclaration" ||
        node.type === "TSImportEqualsDeclaration" ||
        node.type === "TSInterfaceDeclaration" ||
        node.type === "TSModuleDeclaration" ||
        node.type === "TSNamespaceExportDeclaration" ||
        node.type === "TSNamespaceFunctionDeclaration" ||
        node.type === "TypeAlias" ||
        node.type === "VariableDeclaration" ||
        node.type === "WhileStatement" ||
        node.type === "WithStatement");
}
var fastPath = FastPath$1;
function traverseDoc(doc, onEnter, onExit, shouldTraverseConditionalGroups) {
    function traverseDocRec(doc) {
        let shouldRecurse = true;
        if (onEnter) {
            if (onEnter(doc) === false) {
                shouldRecurse = false;
            }
        }
        if (shouldRecurse) {
            if (doc.type === "concat" || doc.type === "fill") {
                for (let i = 0; i < doc.parts.length; i++) {
                    traverseDocRec(doc.parts[i]);
                }
            }
            else if (doc.type === "if-break") {
                if (doc.breakContents) {
                    traverseDocRec(doc.breakContents);
                }
                if (doc.flatContents) {
                    traverseDocRec(doc.flatContents);
                }
            }
            else if (doc.type === "group" && doc.expandedStates) {
                if (shouldTraverseConditionalGroups) {
                    doc.expandedStates.forEach(traverseDocRec);
                }
                else {
                    traverseDocRec(doc.contents);
                }
            }
            else if (doc.contents) {
                traverseDocRec(doc.contents);
            }
        }
        if (onExit) {
            onExit(doc);
        }
    }
    traverseDocRec(doc);
}
function mapDoc(doc, func) {
    doc = func(doc);
    if (doc.type === "concat" || doc.type === "fill") {
        return Object.assign({}, doc, {
            parts: doc.parts.map(d => mapDoc(d, func))
        });
    }
    else if (doc.type === "if-break") {
        return Object.assign({}, doc, {
            breakContents: doc.breakContents && mapDoc(doc.breakContents, func),
            flatContents: doc.flatContents && mapDoc(doc.flatContents, func)
        });
    }
    else if (doc.contents) {
        return Object.assign({}, doc, { contents: mapDoc(doc.contents, func) });
    }
    return doc;
}
function findInDoc(doc, fn, defaultValue) {
    let result = defaultValue;
    let hasStopped = false;
    traverseDoc(doc, doc => {
        const maybeResult = fn(doc);
        if (maybeResult !== undefined) {
            hasStopped = true;
            result = maybeResult;
        }
        if (hasStopped) {
            return false;
        }
    });
    return result;
}
function isEmpty$1(n) {
    return typeof n === "string" && n.length === 0;
}
function getFirstString(doc) {
    return findInDoc(doc, doc => {
        if (typeof doc === "string" && doc.trim().length !== 0) {
            return doc;
        }
    }, null);
}
function isLineNext$1(doc) {
    return findInDoc(doc, doc => {
        if (typeof doc === "string") {
            return false;
        }
        if (doc.type === "line") {
            return true;
        }
    }, false);
}
function willBreak$1(doc) {
    return findInDoc(doc, doc => {
        if (doc.type === "group" && doc.break) {
            return true;
        }
        if (doc.type === "line" && doc.hard) {
            return true;
        }
        if (doc.type === "break-parent") {
            return true;
        }
    }, false);
}
function breakParentGroup(groupStack) {
    if (groupStack.length > 0) {
        const parentGroup = groupStack[groupStack.length - 1];
        // Breaks are not propagated through conditional groups because
        // the user is expected to manually handle what breaks.
        if (!parentGroup.expandedStates) {
            parentGroup.break = true;
        }
    }
    return null;
}
function propagateBreaks(doc) {
    const alreadyVisited = new Map();
    const groupStack = [];
    traverseDoc(doc, doc => {
        if (doc.type === "break-parent") {
            breakParentGroup(groupStack);
        }
        if (doc.type === "group") {
            groupStack.push(doc);
            if (alreadyVisited.has(doc)) {
                return false;
            }
            alreadyVisited.set(doc, true);
        }
    }, doc => {
        if (doc.type === "group") {
            const group = groupStack.pop();
            if (group.break) {
                breakParentGroup(groupStack);
            }
        }
    }, 
    /* shouldTraverseConditionalGroups */ true);
}
function removeLines(doc) {
    // Force this doc into flat mode by statically converting all
    // lines into spaces (or soft lines into nothing). Hard lines
    // should still output because there's too great of a chance
    // of breaking existing assumptions otherwise.
    return mapDoc(doc, d => {
        if (d.type === "line" && !d.hard) {
            return d.soft ? "" : " ";
        }
        else if (d.type === "if-break") {
            return d.flatContents || "";
        }
        return d;
    });
}
function rawText$1(node) {
    return node.extra ? node.extra.raw : node.raw;
}
var docUtils$2 = {
    isEmpty: isEmpty$1,
    getFirstString,
    willBreak: willBreak$1,
    isLineNext: isLineNext$1,
    traverseDoc,
    mapDoc,
    propagateBreaks,
    removeLines,
    rawText: rawText$1
};
function commonjsRequire() {
    throw new Error('Dynamic requires are not currently supported by rollup-plugin-commonjs');
}
function createCommonjsModule(fn, module) {
    return module = { exports: {} }, fn(module, module.exports), module.exports;
}
var index$6 = createCommonjsModule(function (module, exports) {
    // Copyright 2014, 2015, 2016, 2017 Simon Lydell
    // License: MIT. (See LICENSE.)
    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    // This regex comes from regex.coffee, and is inserted here by generate-index.js
    // (run `npm run build`).
    exports.default = /((['"])(?:(?!\2|\\).|\\(?:\r\n|[\s\S]))*(\2)?|`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{(?:[^{}]|\{[^}]*\}?)*\}?)*(`)?)|(\/\/.*)|(\/\*(?:[^*]|\*(?!\/))*(\*\/)?)|(\/(?!\*)(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\]\\]).|\\.)+\/(?:(?!\s*(?:\b|[\u0080-\uFFFF$\\'"~({]|[+\-!](?!=)|\.?\d))|[gmiyu]{1,5}\b(?![\u0080-\uFFFF$\\]|\s*(?:[+\-*%&|^<>!=?({]|\/(?![\/*])))))|(0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?)|((?!\d)(?:(?!\s)[$\w\u0080-\uFFFF]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})+)|(--|\+\+|&&|\|\||=>|\.{3}|(?:[+\-\/%&|^]|\*{1,2}|<{1,2}|>{1,3}|!=?|={1,2})=?|[?~.,:;[\](){}])|(\s+)|(^$|[\s\S])/g;
    exports.matchToToken = function (match) {
        var token = { type: "invalid", value: match[0] };
        if (match[1])
            token.type = "string", token.closed = !!(match[3] || match[4]);
        else if (match[5])
            token.type = "comment";
        else if (match[6])
            token.type = "comment", token.closed = !!match[7];
        else if (match[8])
            token.type = "regex";
        else if (match[9])
            token.type = "number";
        else if (match[10])
            token.type = "name";
        else if (match[11])
            token.type = "punctuator";
        else if (match[12])
            token.type = "whitespace";
        return token;
    };
});
var ast = createCommonjsModule(function (module) {
    /*
      Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com>
    
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
    
        * Redistributions of source code must retain the above copyright
          notice, this list of conditions and the following disclaimer.
        * Redistributions in binary form must reproduce the above copyright
          notice, this list of conditions and the following disclaimer in the
          documentation and/or other materials provided with the distribution.
    
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS'
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
      ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
      DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
      (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
      LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
      ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
      (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
      THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    */
    (function () {
        'use strict';
        function isExpression(node) {
            if (node == null) {
                return false;
            }
            switch (node.type) {
                case 'ArrayExpression':
                case 'AssignmentExpression':
                case 'BinaryExpression':
                case 'CallExpression':
                case 'ConditionalExpression':
                case 'FunctionExpression':
                case 'Identifier':
                case 'Literal':
                case 'LogicalExpression':
                case 'MemberExpression':
                case 'NewExpression':
                case 'ObjectExpression':
                case 'SequenceExpression':
                case 'ThisExpression':
                case 'UnaryExpression':
                case 'UpdateExpression':
                    return true;
            }
            return false;
        }
        function isIterationStatement(node) {
            if (node == null) {
                return false;
            }
            switch (node.type) {
                case 'DoWhileStatement':
                case 'ForInStatement':
                case 'ForStatement':
                case 'WhileStatement':
                    return true;
            }
            return false;
        }
        function isStatement(node) {
            if (node == null) {
                return false;
            }
            switch (node.type) {
                case 'BlockStatement':
                case 'BreakStatement':
                case 'ContinueStatement':
                case 'DebuggerStatement':
                case 'DoWhileStatement':
                case 'EmptyStatement':
                case 'ExpressionStatement':
                case 'ForInStatement':
                case 'ForStatement':
                case 'IfStatement':
                case 'LabeledStatement':
                case 'ReturnStatement':
                case 'SwitchStatement':
                case 'ThrowStatement':
                case 'TryStatement':
                case 'VariableDeclaration':
                case 'WhileStatement':
                case 'WithStatement':
                    return true;
            }
            return false;
        }
        function isSourceElement(node) {
            return isStatement(node) || node != null && node.type === 'FunctionDeclaration';
        }
        function trailingStatement(node) {
            switch (node.type) {
                case 'IfStatement':
                    if (node.alternate != null) {
                        return node.alternate;
                    }
                    return node.consequent;
                case 'LabeledStatement':
                case 'ForStatement':
                case 'ForInStatement':
                case 'WhileStatement':
                case 'WithStatement':
                    return node.body;
            }
            return null;
        }
        function isProblematicIfStatement(node) {
            var current;
            if (node.type !== 'IfStatement') {
                return false;
            }
            if (node.alternate == null) {
                return false;
            }
            current = node.consequent;
            do {
                if (current.type === 'IfStatement') {
                    if (current.alternate == null) {
                        return true;
                    }
                }
                current = trailingStatement(current);
            } while (current);
            return false;
        }
        module.exports = {
            isExpression: isExpression,
            isStatement: isStatement,
            isIterationStatement: isIterationStatement,
            isSourceElement: isSourceElement,
            isProblematicIfStatement: isProblematicIfStatement,
            trailingStatement: trailingStatement
        };
    }());
    /* vim: set sw=4 ts=4 et tw=80 : */
});
var code = createCommonjsModule(function (module) {
    /*
      Copyright (C) 2013-2014 Yusuke Suzuki <utatane.tea@gmail.com>
      Copyright (C) 2014 Ivan Nikulin <ifaaan@gmail.com>
    
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
    
        * Redistributions of source code must retain the above copyright
          notice, this list of conditions and the following disclaimer.
        * Redistributions in binary form must reproduce the above copyright
          notice, this list of conditions and the following disclaimer in the
          documentation and/or other materials provided with the distribution.
    
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
      ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
      DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
      (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
      LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
      ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
      (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
      THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    */
    (function () {
        'use strict';
        var ES6Regex, ES5Regex, NON_ASCII_WHITESPACES, IDENTIFIER_START, IDENTIFIER_PART, ch;
        // See `tools/generate-identifier-regex.js`.
        ES5Regex = {
            // ECMAScript 5.1/Unicode v7.0.0 NonAsciiIdentifierStart:
            NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/,
            // ECMAScript 5.1/Unicode v7.0.0 NonAsciiIdentifierPart:
            NonAsciiIdentifierPart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/
        };
        ES6Regex = {
            // ECMAScript 6/Unicode v7.0.0 NonAsciiIdentifierStart:
            NonAsciiIdentifierStart: /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDE00-\uDE11\uDE13-\uDE2B\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF5D-\uDF61]|\uD805[\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDE00-\uDE2F\uDE44\uDE80-\uDEAA]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF98]|\uD809[\uDC00-\uDC6E]|[\uD80C\uD840-\uD868\uD86A-\uD86C][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D]|\uD87E[\uDC00-\uDE1D]/,
            // ECMAScript 6/Unicode v7.0.0 NonAsciiIdentifierPart:
            NonAsciiIdentifierPart: /[\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDD0-\uDDDA\uDE00-\uDE11\uDE13-\uDE37\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF01-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9]|\uD806[\uDCA0-\uDCE9\uDCFF\uDEC0-\uDEF8]|\uD808[\uDC00-\uDF98]|\uD809[\uDC00-\uDC6E]|[\uD80C\uD840-\uD868\uD86A-\uD86C][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/
        };
        function isDecimalDigit(ch) {
            return 0x30 <= ch && ch <= 0x39; // 0..9
        }
        function isHexDigit(ch) {
            return 0x30 <= ch && ch <= 0x39 ||
                0x61 <= ch && ch <= 0x66 ||
                0x41 <= ch && ch <= 0x46; // A..F
        }
        function isOctalDigit(ch) {
            return ch >= 0x30 && ch <= 0x37; // 0..7
        }
        // 7.2 White Space
        NON_ASCII_WHITESPACES = [
            0x1680, 0x180E,
            0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
            0x202F, 0x205F,
            0x3000,
            0xFEFF
        ];
        function isWhiteSpace(ch) {
            return ch === 0x20 || ch === 0x09 || ch === 0x0B || ch === 0x0C || ch === 0xA0 ||
                ch >= 0x1680 && NON_ASCII_WHITESPACES.indexOf(ch) >= 0;
        }
        // 7.3 Line Terminators
        function isLineTerminator(ch) {
            return ch === 0x0A || ch === 0x0D || ch === 0x2028 || ch === 0x2029;
        }
        // 7.6 Identifier Names and Identifiers
        function fromCodePoint(cp) {
            if (cp <= 0xFFFF) {
                return String.fromCharCode(cp);
            }
            var cu1 = String.fromCharCode(Math.floor((cp - 0x10000) / 0x400) + 0xD800);
            var cu2 = String.fromCharCode(((cp - 0x10000) % 0x400) + 0xDC00);
            return cu1 + cu2;
        }
        IDENTIFIER_START = new Array(0x80);
        for (ch = 0; ch < 0x80; ++ch) {
            IDENTIFIER_START[ch] =
                ch >= 0x61 && ch <= 0x7A ||
                    ch >= 0x41 && ch <= 0x5A ||
                    ch === 0x24 || ch === 0x5F; // $ (dollar) and _ (underscore)
        }
        IDENTIFIER_PART = new Array(0x80);
        for (ch = 0; ch < 0x80; ++ch) {
            IDENTIFIER_PART[ch] =
                ch >= 0x61 && ch <= 0x7A ||
                    ch >= 0x41 && ch <= 0x5A ||
                    ch >= 0x30 && ch <= 0x39 ||
                    ch === 0x24 || ch === 0x5F; // $ (dollar) and _ (underscore)
        }
        function isIdentifierStartES5(ch) {
            return ch < 0x80 ? IDENTIFIER_START[ch] : ES5Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch));
        }
        function isIdentifierPartES5(ch) {
            return ch < 0x80 ? IDENTIFIER_PART[ch] : ES5Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch));
        }
        function isIdentifierStartES6(ch) {
            return ch < 0x80 ? IDENTIFIER_START[ch] : ES6Regex.NonAsciiIdentifierStart.test(fromCodePoint(ch));
        }
        function isIdentifierPartES6(ch) {
            return ch < 0x80 ? IDENTIFIER_PART[ch] : ES6Regex.NonAsciiIdentifierPart.test(fromCodePoint(ch));
        }
        module.exports = {
            isDecimalDigit: isDecimalDigit,
            isHexDigit: isHexDigit,
            isOctalDigit: isOctalDigit,
            isWhiteSpace: isWhiteSpace,
            isLineTerminator: isLineTerminator,
            isIdentifierStartES5: isIdentifierStartES5,
            isIdentifierPartES5: isIdentifierPartES5,
            isIdentifierStartES6: isIdentifierStartES6,
            isIdentifierPartES6: isIdentifierPartES6
        };
    }());
    /* vim: set sw=4 ts=4 et tw=80 : */
});
var keyword = createCommonjsModule(function (module) {
    /*
      Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com>
    
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
    
        * Redistributions of source code must retain the above copyright
          notice, this list of conditions and the following disclaimer.
        * Redistributions in binary form must reproduce the above copyright
          notice, this list of conditions and the following disclaimer in the
          documentation and/or other materials provided with the distribution.
    
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
      ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
      DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
      (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
      LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
      ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
      (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
      THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    */
    (function () {
        'use strict';
        var code$$1 = code;
        function isStrictModeReservedWordES6(id) {
            switch (id) {
                case 'implements':
                case 'interface':
                case 'package':
                case 'private':
                case 'protected':
                case 'public':
                case 'static':
                case 'let':
                    return true;
                default:
                    return false;
            }
        }
        function isKeywordES5(id, strict) {
            // yield should not be treated as keyword under non-strict mode.
            if (!strict && id === 'yield') {
                return false;
            }
            return isKeywordES6(id, strict);
        }
        function isKeywordES6(id, strict) {
            if (strict && isStrictModeReservedWordES6(id)) {
                return true;
            }
            switch (id.length) {
                case 2:
                    return (id === 'if') || (id === 'in') || (id === 'do');
                case 3:
                    return (id === 'var') || (id === 'for') || (id === 'new') || (id === 'try');
                case 4:
                    return (id === 'this') || (id === 'else') || (id === 'case') ||
                        (id === 'void') || (id === 'with') || (id === 'enum');
                case 5:
                    return (id === 'while') || (id === 'break') || (id === 'catch') ||
                        (id === 'throw') || (id === 'const') || (id === 'yield') ||
                        (id === 'class') || (id === 'super');
                case 6:
                    return (id === 'return') || (id === 'typeof') || (id === 'delete') ||
                        (id === 'switch') || (id === 'export') || (id === 'import');
                case 7:
                    return (id === 'default') || (id === 'finally') || (id === 'extends');
                case 8:
                    return (id === 'function') || (id === 'continue') || (id === 'debugger');
                case 10:
                    return (id === 'instanceof');
                default:
                    return false;
            }
        }
        function isReservedWordES5(id, strict) {
            return id === 'null' || id === 'true' || id === 'false' || isKeywordES5(id, strict);
        }
        function isReservedWordES6(id, strict) {
            return id === 'null' || id === 'true' || id === 'false' || isKeywordES6(id, strict);
        }
        function isRestrictedWord(id) {
            return id === 'eval' || id === 'arguments';
        }
        function isIdentifierNameES5(id) {
            var i, iz, ch;
            if (id.length === 0) {
                return false;
            }
            ch = id.charCodeAt(0);
            if (!code$$1.isIdentifierStartES5(ch)) {
                return false;
            }
            for (i = 1, iz = id.length; i < iz; ++i) {
                ch = id.charCodeAt(i);
                if (!code$$1.isIdentifierPartES5(ch)) {
                    return false;
                }
            }
            return true;
        }
        function decodeUtf16(lead, trail) {
            return (lead - 0xD800) * 0x400 + (trail - 0xDC00) + 0x10000;
        }
        function isIdentifierNameES6(id) {
            var i, iz, ch, lowCh, check;
            if (id.length === 0) {
                return false;
            }
            check = code$$1.isIdentifierStartES6;
            for (i = 0, iz = id.length; i < iz; ++i) {
                ch = id.charCodeAt(i);
                if (0xD800 <= ch && ch <= 0xDBFF) {
                    ++i;
                    if (i >= iz) {
                        return false;
                    }
                    lowCh = id.charCodeAt(i);
                    if (!(0xDC00 <= lowCh && lowCh <= 0xDFFF)) {
                        return false;
                    }
                    ch = decodeUtf16(ch, lowCh);
                }
                if (!check(ch)) {
                    return false;
                }
                check = code$$1.isIdentifierPartES6;
            }
            return true;
        }
        function isIdentifierES5(id, strict) {
            return isIdentifierNameES5(id) && !isReservedWordES5(id, strict);
        }
        function isIdentifierES6(id, strict) {
            return isIdentifierNameES6(id) && !isReservedWordES6(id, strict);
        }
        module.exports = {
            isKeywordES5: isKeywordES5,
            isKeywordES6: isKeywordES6,
            isReservedWordES5: isReservedWordES5,
            isReservedWordES6: isReservedWordES6,
            isRestrictedWord: isRestrictedWord,
            isIdentifierNameES5: isIdentifierNameES5,
            isIdentifierNameES6: isIdentifierNameES6,
            isIdentifierES5: isIdentifierES5,
            isIdentifierES6: isIdentifierES6
        };
    }());
    /* vim: set sw=4 ts=4 et tw=80 : */
});
var utils = createCommonjsModule(function (module, exports) {
    /*
      Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com>
    
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
    
        * Redistributions of source code must retain the above copyright
          notice, this list of conditions and the following disclaimer.
        * Redistributions in binary form must reproduce the above copyright
          notice, this list of conditions and the following disclaimer in the
          documentation and/or other materials provided with the distribution.
    
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
      ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
      DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
      (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
      LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
      ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
      (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
      THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    */
    (function () {
        'use strict';
        exports.ast = ast;
        exports.code = code;
        exports.keyword = keyword;
    }());
    /* vim: set sw=4 ts=4 et tw=80 : */
});
var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
var index$10 = function (str) {
    if (typeof str !== 'string') {
        throw new TypeError('Expected a string');
    }
    return str.replace(matchOperatorsRe, '\\$&');
};
var index$12 = createCommonjsModule(function (module) {
    'use strict';
    function assembleStyles() {
        var styles = {
            modifiers: {
                reset: [0, 0],
                bold: [1, 22],
                dim: [2, 22],
                italic: [3, 23],
                underline: [4, 24],
                inverse: [7, 27],
                hidden: [8, 28],
                strikethrough: [9, 29]
            },
            colors: {
                black: [30, 39],
                red: [31, 39],
                green: [32, 39],
                yellow: [33, 39],
                blue: [34, 39],
                magenta: [35, 39],
                cyan: [36, 39],
                white: [37, 39],
                gray: [90, 39]
            },
            bgColors: {
                bgBlack: [40, 49],
                bgRed: [41, 49],
                bgGreen: [42, 49],
                bgYellow: [43, 49],
                bgBlue: [44, 49],
                bgMagenta: [45, 49],
                bgCyan: [46, 49],
                bgWhite: [47, 49]
            }
        };
        // fix humans
        styles.colors.grey = styles.colors.gray;
        Object.keys(styles).forEach(function (groupName) {
            var group = styles[groupName];
            Object.keys(group).forEach(function (styleName) {
                var style = group[styleName];
                styles[styleName] = group[styleName] = {
                    open: '\u001b[' + style[0] + 'm',
                    close: '\u001b[' + style[1] + 'm'
                };
            });
            Object.defineProperty(styles, groupName, {
                value: group,
                enumerable: false
            });
        });
        return styles;
    }
    Object.defineProperty(module, 'exports', {
        enumerable: true,
        get: assembleStyles
    });
});
var index$16 = function () {
    return /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g;
};
var ansiRegex = index$16();
var index$14 = function (str) {
    return typeof str === 'string' ? str.replace(ansiRegex, '') : str;
};
var ansiRegex$1 = index$16;
var re = new RegExp(ansiRegex$1().source); // remove the `g` flag
var index$18 = re.test.bind(re);
var argv = process.argv;
var terminator = argv.indexOf('--');
var hasFlag = function (flag) {
    flag = '--' + flag;
    var pos = argv.indexOf(flag);
    return pos !== -1 && (terminator !== -1 ? pos < terminator : true);
};
var index$20 = (function () {
    if ('FORCE_COLOR' in process.env) {
        return true;
    }
    if (hasFlag('no-color') ||
        hasFlag('no-colors') ||
        hasFlag('color=false')) {
        return false;
    }
    if (hasFlag('color') ||
        hasFlag('colors') ||
        hasFlag('color=true') ||
        hasFlag('color=always')) {
        return true;
    }
    if (process.stdout && !process.stdout.isTTY) {
        return false;
    }
    if (process.platform === 'win32') {
        return true;
    }
    if ('COLORTERM' in process.env) {
        return true;
    }
    if (process.env.TERM === 'dumb') {
        return false;
    }
    if (/^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM)) {
        return true;
    }
    return false;
})();
var escapeStringRegexp = index$10;
var ansiStyles = index$12;
var stripAnsi = index$14;
var hasAnsi = index$18;
var supportsColor = index$20;
var defineProps = Object.defineProperties;
var isSimpleWindowsTerm = process.platform === 'win32' && !/^xterm/i.test(process.env.TERM);
function Chalk(options) {
    // detect mode if not set manually
    this.enabled = !options || options.enabled === undefined ? supportsColor : options.enabled;
}
// use bright blue on Windows as the normal blue color is illegible
if (isSimpleWindowsTerm) {
    ansiStyles.blue.open = '\u001b[94m';
}
var styles = (function () {
    var ret = {};
    Object.keys(ansiStyles).forEach(function (key) {
        ansiStyles[key].closeRe = new RegExp(escapeStringRegexp(ansiStyles[key].close), 'g');
        ret[key] = {
            get: function () {
                return build.call(this, this._styles.concat(key));
            }
        };
    });
    return ret;
})();
var proto = defineProps(function chalk() { }, styles);
function build(_styles) {
    var builder = function () {
        return applyStyle.apply(builder, arguments);
    };
    builder._styles = _styles;
    builder.enabled = this.enabled;
    // __proto__ is used because we must return a function, but there is
    // no way to create a function with a different prototype.
    /* eslint-disable no-proto */
    builder.__proto__ = proto;
    return builder;
}
function applyStyle() {
    // support varags, but simply cast to string in case there's only one arg
    var args = arguments;
    var argsLen = args.length;
    var str = argsLen !== 0 && String(arguments[0]);
    if (argsLen > 1) {
        // don't slice `arguments`, it prevents v8 optimizations
        for (var a = 1; a < argsLen; a++) {
            str += ' ' + args[a];
        }
    }
    if (!this.enabled || !str) {
        return str;
    }
    var nestedStyles = this._styles;
    var i = nestedStyles.length;
    // Turns out that on Windows dimmed gray text becomes invisible in cmd.exe,
    // see https://github.com/chalk/chalk/issues/58
    // If we're on Windows and we're dealing with a gray color, temporarily make 'dim' a noop.
    var originalDim = ansiStyles.dim.open;
    if (isSimpleWindowsTerm && (nestedStyles.indexOf('gray') !== -1 || nestedStyles.indexOf('grey') !== -1)) {
        ansiStyles.dim.open = '';
    }
    while (i--) {
        var code = ansiStyles[nestedStyles[i]];
        // Replace any instances already present with a re-opening code
        // otherwise only the part of the string until said closing code
        // will be colored, and the rest will simply be 'plain'.
        str = code.open + str.replace(code.closeRe, code.open) + code.close;
    }
    // Reset the original 'dim' if we changed it to work around the Windows dimmed gray issue.
    ansiStyles.dim.open = originalDim;
    return str;
}
function init() {
    var ret = {};
    Object.keys(styles).forEach(function (name) {
        ret[name] = {
            get: function () {
                return build.call(this, [name]);
            }
        };
    });
    return ret;
}
defineProps(Chalk.prototype, init());
var index$8 = new Chalk();
var styles_1 = ansiStyles;
var hasColor = hasAnsi;
var stripColor = stripAnsi;
var supportsColor_1 = supportsColor;
index$8.styles = styles_1;
index$8.hasColor = hasColor;
index$8.stripColor = stripColor;
index$8.supportsColor = supportsColor_1;
var index$4 = createCommonjsModule(function (module, exports) {
    "use strict";
    exports.__esModule = true;
    exports.codeFrameColumns = codeFrameColumns;
    exports.default = function (rawLines, lineNumber, colNumber) {
        var opts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
        if (!deprecationWarningShown) {
            deprecationWarningShown = true;
            var deprecationError = new Error("Passing lineNumber and colNumber is deprecated to babel-code-frame. Please use `codeFrameColumns`.");
            deprecationError.name = "DeprecationWarning";
            if (process.emitWarning) {
                process.emitWarning(deprecationError);
            }
            else {
                console.warn(deprecationError);
            }
        }
        colNumber = Math.max(colNumber, 0);
        var location = { start: { column: colNumber, line: lineNumber } };
        return codeFrameColumns(rawLines, location, opts);
    };
    var _jsTokens = index$6;
    var _jsTokens2 = _interopRequireDefault(_jsTokens);
    var _esutils = utils;
    var _esutils2 = _interopRequireDefault(_esutils);
    var _chalk = index$8;
    var _chalk2 = _interopRequireDefault(_chalk);
    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
    var deprecationWarningShown = false;
    function getDefs(chalk) {
        return {
            keyword: chalk.cyan,
            capitalized: chalk.yellow,
            jsx_tag: chalk.yellow,
            punctuator: chalk.yellow,
            number: chalk.magenta,
            string: chalk.green,
            regex: chalk.magenta,
            comment: chalk.grey,
            invalid: chalk.white.bgRed.bold,
            gutter: chalk.grey,
            marker: chalk.red.bold
        };
    }
    var NEWLINE = /\r\n|[\n\r\u2028\u2029]/;
    var JSX_TAG = /^[a-z][\w-]*$/i;
    var BRACKET = /^[()\[\]{}]$/;
    function getTokenType(match) {
        var _match$slice = match.slice(-2), offset = _match$slice[0], text = _match$slice[1];
        var token = (0, _jsTokens.matchToToken)(match);
        if (token.type === "name") {
            if (_esutils2.default.keyword.isReservedWordES6(token.value)) {
                return "keyword";
            }
            if (JSX_TAG.test(token.value) && (text[offset - 1] === "<" || text.substr(offset - 2, 2) == "</")) {
                return "jsx_tag";
            }
            if (token.value[0] !== token.value[0].toLowerCase()) {
                return "capitalized";
            }
        }
        if (token.type === "punctuator" && BRACKET.test(token.value)) {
            return "bracket";
        }
        return token.type;
    }
    function highlight(defs, text) {
        return text.replace(_jsTokens2.default, function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }
            var type = getTokenType(args);
            var colorize = defs[type];
            if (colorize) {
                return args[0].split(NEWLINE).map(function (str) {
                    return colorize(str);
                }).join("\n");
            }
            else {
                return args[0];
            }
        });
    }
    function getMarkerLines(loc, source, opts) {
        var startLoc = Object.assign({}, { column: 0, line: -1 }, loc.start);
        var endLoc = Object.assign({}, startLoc, loc.end);
        var linesAbove = opts.linesAbove || 2;
        var linesBelow = opts.linesBelow || 3;
        var startLine = startLoc.line;
        var startColumn = startLoc.column;
        var endLine = endLoc.line;
        var endColumn = endLoc.column;
        var start = Math.max(startLine - (linesAbove + 1), 0);
        var end = Math.min(source.length, endLine + linesBelow);
        if (startLine === -1) {
            start = 0;
        }
        if (endLine === -1) {
            end = source.length;
        }
        var lineDiff = endLine - startLine;
        var markerLines = {};
        if (lineDiff) {
            for (var i = 0; i <= lineDiff; i++) {
                var lineNumber = i + startLine;
                if (!startColumn) {
                    markerLines[lineNumber] = true;
                }
                else if (i === 0) {
                    var sourceLength = source[lineNumber - 1].length;
                    markerLines[lineNumber] = [startColumn, sourceLength - startColumn];
                }
                else if (i === lineDiff) {
                    markerLines[lineNumber] = [0, endColumn];
                }
                else {
                    var _sourceLength = source[lineNumber - i].length;
                    markerLines[lineNumber] = [0, _sourceLength];
                }
            }
        }
        else {
            if (startColumn === endColumn) {
                if (startColumn) {
                    markerLines[startLine] = [startColumn, 0];
                }
                else {
                    markerLines[startLine] = true;
                }
            }
            else {
                markerLines[startLine] = [startColumn, endColumn - startColumn];
            }
        }
        return { start: start, end: end, markerLines: markerLines };
    }
    function codeFrameColumns(rawLines, loc) {
        var opts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        var highlighted = opts.highlightCode && _chalk2.default.supportsColor || opts.forceColor;
        var chalk = _chalk2.default;
        if (opts.forceColor) {
            chalk = new _chalk2.default.constructor({ enabled: true });
        }
        var maybeHighlight = function maybeHighlight(chalkFn, string) {
            return highlighted ? chalkFn(string) : string;
        };
        var defs = getDefs(chalk);
        if (highlighted)
            rawLines = highlight(defs, rawLines);
        var lines = rawLines.split(NEWLINE);
        var _getMarkerLines = getMarkerLines(loc, lines, opts), start = _getMarkerLines.start, end = _getMarkerLines.end, markerLines = _getMarkerLines.markerLines;
        var numberMaxWidth = String(end).length;
        var frame = lines.slice(start, end).map(function (line, index) {
            var number = start + 1 + index;
            var paddedNumber = (" " + number).slice(-numberMaxWidth);
            var gutter = " " + paddedNumber + " | ";
            var hasMarker = markerLines[number];
            if (hasMarker) {
                var markerLine = "";
                if (Array.isArray(hasMarker)) {
                    var markerSpacing = line.slice(0, Math.max(hasMarker[0] - 1, 0)).replace(/[^\t]/g, " ");
                    var numberOfMarkers = hasMarker[1] || 1;
                    markerLine = ["\n ", maybeHighlight(defs.gutter, gutter.replace(/\d/g, " ")), markerSpacing, maybeHighlight(defs.marker, "^").repeat(numberOfMarkers)].join("");
                }
                return [maybeHighlight(defs.marker, ">"), maybeHighlight(defs.gutter, gutter), line, markerLine].join("");
            }
            else {
                return " " + maybeHighlight(defs.gutter, gutter) + line;
            }
        }).join("\n");
        if (highlighted) {
            return chalk.reset(frame);
        }
        else {
            return frame;
        }
    }
});
const path = require$$0$1;
const parsers = {
    get flow() {
        return require("./parser-flow");
    },
    get graphql() {
        return require("./parser-graphql");
    },
    get parse5() {
        return require("./parser-parse5");
    },
    get babylon() {
        return require("./parser-babylon");
    },
    get typescript() {
        return require("./parser-typescript");
    },
    get postcss() {
        return require("./parser-postcss");
    },
    get json() {
        return require("./parser-json");
    }
};
function resolveParseFunction(opts) {
    if (typeof opts.parser === "function") {
        return opts.parser;
    }
    if (typeof opts.parser === "string") {
        if (parsers.hasOwnProperty(opts.parser)) {
            return parsers[opts.parser];
        }
        try {
            return require(path.resolve(process.cwd(), opts.parser));
        }
        catch (err) {
            throw new Error(`Couldn't resolve parser "${opts.parser}"`);
        }
    }
    return parsers.babylon;
}
function parse(text, opts) {
    const parseFunction = resolveParseFunction(opts);
    try {
        return parseFunction(text, parsers, opts);
    }
    catch (error) {
        const loc = error.loc;
        if (loc) {
            const codeFrame = index$4;
            error.codeFrame = codeFrame.codeFrameColumns(text, loc, {
                highlightCode: true
            });
            error.message += "\n" + error.codeFrame;
            throw error;
        }
        throw error.stack;
    }
}
var parser$1 = { parse };
const util$7 = util$3;
const docUtils$1 = docUtils$2;
const docBuilders$4 = docBuilders$1;
const comments$4 = comments$1;
const indent$3 = docBuilders$4.indent;
const hardline$3 = docBuilders$4.hardline;
const softline$2 = docBuilders$4.softline;
const concat$3 = docBuilders$4.concat;
function printSubtree(subtreeParser, path, print, options) {
    const next = Object.assign({}, { transformDoc: doc => doc }, subtreeParser);
    next.options = Object.assign({}, options, next.options, {
        originalText: next.text
    });
    const ast = parser$1.parse(next.text, next.options);
    const astComments = ast.comments;
    delete ast.comments;
    comments$4.attach(astComments, ast, next.text, next.options);
    const nextDoc = printer.printAstToDoc(ast, next.options);
    return next.transformDoc(nextDoc, { path, print });
}
/**
 * @returns {{ text, options?, transformDoc? } | void}
 */
function getSubtreeParser(path, options) {
    switch (options.parser) {
        case "parse5":
            return fromHtmlParser2(path, options);
        case "babylon":
        case "flow":
        case "typescript":
            return fromBabylonFlowOrTypeScript(path, options);
    }
}
function fromBabylonFlowOrTypeScript(path) {
    const node = path.getValue();
    switch (node.type) {
        case "TemplateLiteral": {
            const isCss = [isStyledJsx, isStyledComponents].some(isIt => isIt(path));
            if (isCss) {
                // Get full template literal with expressions replaced by placeholders
                const rawQuasis = node.quasis.map(q => q.value.raw);
                const text = rawQuasis.join("@prettier-placeholder");
                return {
                    options: { parser: "postcss" },
                    transformDoc: transformCssDoc,
                    text: text
                };
            }
            break;
        }
        case "TemplateElement": {
            const parent = path.getParentNode();
            const parentParent = path.getParentNode(1);
            /*
             * react-relay and graphql-tag
             * graphql`...`
             * graphql.experimental`...`
             * gql`...`
             */
            if (parentParent &&
                parentParent.type === "TaggedTemplateExpression" &&
                parent.quasis.length === 1 &&
                ((parentParent.tag.type === "MemberExpression" &&
                    parentParent.tag.object.name === "graphql" &&
                    parentParent.tag.property.name === "experimental") ||
                    (parentParent.tag.type === "Identifier" &&
                        (parentParent.tag.name === "gql" ||
                            parentParent.tag.name === "graphql")))) {
                return {
                    options: { parser: "graphql" },
                    transformDoc: doc => concat$3([
                        indent$3(concat$3([softline$2, stripTrailingHardline(doc)])),
                        softline$2
                    ]),
                    text: parent.quasis[0].value.raw
                };
            }
            break;
        }
    }
}
function fromHtmlParser2(path, options) {
    const node = path.getValue();
    switch (node.type) {
        case "text": {
            const parent = path.getParentNode();
            // Inline JavaScript
            if (parent.type === "script" &&
                ((!parent.attribs.lang && !parent.attribs.lang) ||
                    parent.attribs.type === "text/javascript" ||
                    parent.attribs.type === "application/javascript")) {
                const parser = options.parser === "flow" ? "flow" : "babylon";
                return {
                    options: { parser },
                    transformDoc: doc => concat$3([hardline$3, doc]),
                    text: getText(options, node)
                };
            }
            // Inline TypeScript
            if (parent.type === "script" &&
                (parent.attribs.type === "application/x-typescript" ||
                    parent.attribs.lang === "ts")) {
                return {
                    options: { parser: "typescript" },
                    transformDoc: doc => concat$3([hardline$3, doc]),
                    text: getText(options, node)
                };
            }
            // Inline Styles
            if (parent.type === "style") {
                return {
                    options: { parser: "postcss" },
                    transformDoc: doc => concat$3([hardline$3, stripTrailingHardline(doc)]),
                    text: getText(options, node)
                };
            }
            break;
        }
        case "attribute": {
            /*
             * Vue binding sytax: JS expressions
             * :class="{ 'some-key': value }"
             * v-bind:id="'list-' + id"
             * v-if="foo && !bar"
             * @click="someFunction()"
             */
            if (/(^@)|(^v-)|:/.test(node.key) && !/^\w+$/.test(node.value)) {
                return {
                    text: node.value,
                    options: {
                        parser: parseJavaScriptExpression,
                        // Use singleQuote since HTML attributes use double-quotes.
                        // TODO(azz): We still need to do an entity escape on the attribute.
                        singleQuote: true
                    },
                    transformDoc: doc => {
                        return concat$3([
                            node.key,
                            '="',
                            util$7.hasNewlineInRange(node.value, 0, node.value.length)
                                ? doc
                                : docUtils$1.removeLines(doc),
                            '"'
                        ]);
                    }
                };
            }
        }
    }
}
function transformCssDoc(quasisDoc, parent) {
    const parentNode = parent.path.getValue();
    const expressionDocs = parentNode.expressions
        ? parent.path.map(parent.print, "expressions")
        : [];
    const newDoc = replacePlaceholders(quasisDoc, expressionDocs);
    if (!newDoc) {
        throw new Error("Couldn't insert all the expressions");
    }
    return concat$3([
        "`",
        indent$3(concat$3([softline$2, stripTrailingHardline(newDoc)])),
        softline$2,
        "`"
    ]);
}
// Search all the placeholders in the quasisDoc tree
// and replace them with the expression docs one by one
// returns a new doc with all the placeholders replaced,
// or null if it couldn't replace any expression
function replacePlaceholders(quasisDoc, expressionDocs) {
    if (!expressionDocs || !expressionDocs.length) {
        return quasisDoc;
    }
    const expressions = expressionDocs.slice();
    const newDoc = docUtils$1.mapDoc(quasisDoc, doc => {
        if (!doc || !doc.parts || !doc.parts.length) {
            return doc;
        }
        let parts = doc.parts;
        if (parts.length > 1 &&
            parts[0] === "@" &&
            typeof parts[1] === "string" &&
            parts[1].startsWith("prettier-placeholder")) {
            // If placeholder is split, join it
            const at = parts[0];
            const placeholder = parts[1];
            const rest = parts.slice(2);
            parts = [at + placeholder].concat(rest);
        }
        if (typeof parts[0] === "string" &&
            parts[0].startsWith("@prettier-placeholder")) {
            const placeholder = parts[0];
            const rest = parts.slice(1);
            // When the expression has a suffix appended, like:
            // animation: linear ${time}s ease-out;
            const suffix = placeholder.slice("@prettier-placeholder".length);
            const expression = expressions.shift();
            parts = ["${", expression, "}" + suffix].concat(rest);
        }
        return Object.assign({}, doc, {
            parts: parts
        });
    });
    return expressions.length === 0 ? newDoc : null;
}
function parseJavaScriptExpression(text, parsers) {
    // Force parsing as an expression
    const ast = parsers.babylon(`(${text})`);
    // Extract expression from the declaration
    return {
        type: "File",
        program: ast.program.body[0].expression
    };
}
function getText(options, node) {
    return options.originalText.slice(util$7.locStart(node), util$7.locEnd(node));
}
function stripTrailingHardline(doc) {
    // HACK remove ending hardline, original PR: #1984
    if (doc.type === "concat" &&
        doc.parts[0].type === "concat" &&
        doc.parts[0].parts.length === 2 &&
        // doc.parts[0].parts[1] === hardline :
        doc.parts[0].parts[1].type === "concat" &&
        doc.parts[0].parts[1].parts.length === 2 &&
        doc.parts[0].parts[1].parts[0].hard &&
        doc.parts[0].parts[1].parts[1].type === "break-parent") {
        return doc.parts[0].parts[0];
    }
    return doc;
}
/**
 * Template literal in this context:
 * <style jsx>{`div{color:red}`}</style>
 */
function isStyledJsx(path) {
    const node = path.getValue();
    const parent = path.getParentNode();
    const parentParent = path.getParentNode(1);
    return (parentParent &&
        node.quasis &&
        parent.type === "JSXExpressionContainer" &&
        parentParent.type === "JSXElement" &&
        parentParent.openingElement.name.name === "style" &&
        parentParent.openingElement.attributes.some(attribute => attribute.name.name === "jsx"));
}
/**
 * Template literal in these contexts:
 * styled.button`color: red`
 * Foo.extend`color: red`
 * css`color: red`
 * keyframes`0% { opacity: 0; }`
 * injectGlobal`body{ margin:0: }`
 */
function isStyledComponents(path) {
    const parent = path.getParentNode();
    return (parent &&
        parent.type === "TaggedTemplateExpression" &&
        ((parent.tag.type === "MemberExpression" &&
            (parent.tag.object.name === "styled" ||
                (/^[A-Z]/.test(parent.tag.object.name) &&
                    parent.tag.property.name === "extend"))) ||
            (parent.tag.type === "Identifier" && parent.tag.name === "css")));
}
var multiparser$1 = {
    getSubtreeParser,
    printSubtree
};
const docBuilders$5 = docBuilders$1;
const concat$4 = docBuilders$5.concat;
const join$3 = docBuilders$5.join;
const hardline$4 = docBuilders$5.hardline;
const line$2 = docBuilders$5.line;
const softline$3 = docBuilders$5.softline;
const group$2 = docBuilders$5.group;
const indent$4 = docBuilders$5.indent;
const ifBreak$2 = docBuilders$5.ifBreak;
function genericPrint$1(path, options, print) {
    const n = path.getValue();
    if (!n) {
        return "";
    }
    if (typeof n === "string") {
        return n;
    }
    switch (n.kind) {
        case "Document": {
            return concat$4([
                join$3(concat$4([hardline$4, hardline$4]), path.map(print, "definitions")),
                hardline$4
            ]);
        }
        case "OperationDefinition": {
            return concat$4([
                n.name === null ? "" : n.operation,
                n.name ? concat$4([" ", path.call(print, "name")]) : "",
                n.variableDefinitions && n.variableDefinitions.length
                    ? group$2(concat$4([
                        "(",
                        indent$4(concat$4([
                            softline$3,
                            join$3(concat$4([ifBreak$2("", ", "), softline$3]), path.map(print, "variableDefinitions"))
                        ])),
                        softline$3,
                        ")"
                    ]))
                    : "",
                printDirectives(path, print, n),
                n.selectionSet ? (n.name === null ? "" : " ") : "",
                path.call(print, "selectionSet")
            ]);
        }
        case "FragmentDefinition": {
            return concat$4([
                "fragment ",
                path.call(print, "name"),
                " on ",
                path.call(print, "typeCondition"),
                printDirectives(path, print, n),
                " ",
                path.call(print, "selectionSet")
            ]);
        }
        case "SelectionSet": {
            return concat$4([
                "{",
                indent$4(concat$4([hardline$4, join$3(hardline$4, path.map(print, "selections"))])),
                hardline$4,
                "}"
            ]);
        }
        case "Field": {
            return group$2(concat$4([
                n.alias ? concat$4([path.call(print, "alias"), ": "]) : "",
                path.call(print, "name"),
                n.arguments.length > 0
                    ? group$2(concat$4([
                        "(",
                        indent$4(concat$4([
                            softline$3,
                            join$3(concat$4([ifBreak$2("", ", "), softline$3]), path.map(print, "arguments"))
                        ])),
                        softline$3,
                        ")"
                    ]))
                    : "",
                printDirectives(path, print, n),
                n.selectionSet ? " " : "",
                path.call(print, "selectionSet")
            ]));
        }
        case "Name": {
            return n.value;
        }
        case "StringValue": {
            return concat$4(['"', n.value, '"']);
        }
        case "IntValue":
        case "FloatValue":
        case "EnumValue": {
            return n.value;
        }
        case "BooleanValue": {
            return n.value ? "true" : "false";
        }
        case "NullValue": {
            return "null";
        }
        case "Variable": {
            return concat$4(["$", path.call(print, "name")]);
        }
        case "ListValue": {
            return group$2(concat$4([
                "[",
                indent$4(concat$4([
                    softline$3,
                    join$3(concat$4([ifBreak$2("", ", "), softline$3]), path.map(print, "values"))
                ])),
                softline$3,
                "]"
            ]));
        }
        case "ObjectValue": {
            return group$2(concat$4([
                "{",
                options.bracesSpacing && n.fields.length > 0 ? " " : "",
                indent$4(concat$4([
                    softline$3,
                    join$3(concat$4([ifBreak$2("", ", "), softline$3]), path.map(print, "fields"))
                ])),
                softline$3,
                ifBreak$2("", options.bracesSpacing && n.fields.length > 0 ? " " : ""),
                "}"
            ]));
        }
        case "ObjectField":
        case "Argument": {
            return concat$4([
                path.call(print, "name"),
                ": ",
                path.call(print, "value")
            ]);
        }
        case "Directive": {
            return concat$4([
                "@",
                path.call(print, "name"),
                n.arguments.length > 0
                    ? group$2(concat$4([
                        "(",
                        indent$4(concat$4([
                            softline$3,
                            join$3(concat$4([ifBreak$2("", ", "), softline$3]), path.map(print, "arguments"))
                        ])),
                        softline$3,
                        ")"
                    ]))
                    : ""
            ]);
        }
        case "NamedType": {
            return path.call(print, "name");
        }
        case "VariableDefinition": {
            return concat$4([
                path.call(print, "variable"),
                ": ",
                path.call(print, "type"),
                n.defaultValue ? concat$4([" = ", path.call(print, "defaultValue")]) : ""
            ]);
        }
        case "TypeExtensionDefinition": {
            return concat$4(["extend ", path.call(print, "definition")]);
        }
        case "ObjectTypeDefinition": {
            return concat$4([
                "type ",
                path.call(print, "name"),
                n.interfaces.length > 0
                    ? concat$4([" implements ", join$3(", ", path.map(print, "interfaces"))])
                    : "",
                printDirectives(path, print, n),
                " {",
                n.fields.length > 0
                    ? indent$4(concat$4([hardline$4, join$3(hardline$4, path.map(print, "fields"))]))
                    : "",
                hardline$4,
                "}"
            ]);
        }
        case "FieldDefinition": {
            return concat$4([
                path.call(print, "name"),
                n.arguments.length > 0
                    ? group$2(concat$4([
                        "(",
                        indent$4(concat$4([
                            softline$3,
                            join$3(concat$4([ifBreak$2("", ", "), softline$3]), path.map(print, "arguments"))
                        ])),
                        softline$3,
                        ")"
                    ]))
                    : "",
                ": ",
                path.call(print, "type"),
                printDirectives(path, print, n)
            ]);
        }
        case "DirectiveDefinition": {
            return concat$4([
                "directive ",
                "@",
                path.call(print, "name"),
                n.arguments.length > 0
                    ? group$2(concat$4([
                        "(",
                        indent$4(concat$4([
                            softline$3,
                            join$3(concat$4([ifBreak$2("", ", "), softline$3]), path.map(print, "arguments"))
                        ])),
                        softline$3,
                        ")"
                    ]))
                    : "",
                concat$4([" on ", join$3(" | ", path.map(print, "locations"))])
            ]);
        }
        case "EnumTypeDefinition": {
            return concat$4([
                "enum ",
                path.call(print, "name"),
                printDirectives(path, print, n),
                " {",
                n.values.length > 0
                    ? indent$4(concat$4([hardline$4, join$3(hardline$4, path.map(print, "values"))]))
                    : "",
                hardline$4,
                "}"
            ]);
        }
        case "EnumValueDefinition": {
            return concat$4([
                path.call(print, "name"),
                printDirectives(path, print, n)
            ]);
        }
        case "InputValueDefinition": {
            return concat$4([
                path.call(print, "name"),
                ": ",
                path.call(print, "type"),
                n.defaultValue ? concat$4([" = ", path.call(print, "defaultValue")]) : "",
                printDirectives(path, print, n)
            ]);
        }
        case "InputObjectTypeDefinition": {
            return concat$4([
                "input ",
                path.call(print, "name"),
                printDirectives(path, print, n),
                " {",
                n.fields.length > 0
                    ? indent$4(concat$4([hardline$4, join$3(hardline$4, path.map(print, "fields"))]))
                    : "",
                hardline$4,
                "}"
            ]);
        }
        case "SchemaDefinition": {
            return concat$4([
                "schema",
                printDirectives(path, print, n),
                " {",
                n.operationTypes.length > 0
                    ? indent$4(concat$4([
                        hardline$4,
                        join$3(hardline$4, path.map(print, "operationTypes"))
                    ]))
                    : "",
                hardline$4,
                "}"
            ]);
        }
        case "OperationTypeDefinition": {
            return concat$4([
                path.call(print, "operation"),
                ": ",
                path.call(print, "type")
            ]);
        }
        case "InterfaceTypeDefinition": {
            return concat$4([
                "interface ",
                path.call(print, "name"),
                printDirectives(path, print, n),
                " {",
                n.fields.length > 0
                    ? indent$4(concat$4([hardline$4, join$3(hardline$4, path.map(print, "fields"))]))
                    : "",
                hardline$4,
                "}"
            ]);
        }
        case "FragmentSpread": {
            return concat$4([
                "...",
                path.call(print, "name"),
                printDirectives(path, print, n)
            ]);
        }
        case "InlineFragment": {
            return concat$4([
                "...",
                n.typeCondition
                    ? concat$4([" on ", path.call(print, "typeCondition")])
                    : "",
                printDirectives(path, print, n),
                " ",
                path.call(print, "selectionSet")
            ]);
        }
        case "UnionTypeDefinition": {
            return group$2(concat$4([
                "union ",
                path.call(print, "name"),
                " =",
                ifBreak$2("", " "),
                indent$4(concat$4([
                    ifBreak$2(concat$4([line$2, "  "])),
                    join$3(concat$4([line$2, "| "]), path.map(print, "types"))
                ]))
            ]));
        }
        case "ScalarTypeDefinition": {
            return concat$4([
                "scalar ",
                path.call(print, "name"),
                printDirectives(path, print, n)
            ]);
        }
        case "NonNullType": {
            return concat$4([path.call(print, "type"), "!"]);
        }
        case "ListType": {
            return concat$4(["[", path.call(print, "type"), "]"]);
        }
        default:
            throw new Error("unknown graphql type: " + JSON.stringify(n.kind));
    }
}
function printDirectives(path, print, n) {
    if (n.directives.length === 0) {
        return "";
    }
    return concat$4([
        " ",
        group$2(indent$4(concat$4([
            softline$3,
            join$3(concat$4([ifBreak$2("", " "), softline$3]), path.map(print, "directives"))
        ])))
    ]);
}
var printerGraphql = genericPrint$1;
const util$8 = util$3;
const docBuilders$6 = docBuilders$1;
const concat$5 = docBuilders$6.concat;
const join$4 = docBuilders$6.join;
const hardline$5 = docBuilders$6.hardline;
const line$3 = docBuilders$6.line;
const softline$4 = docBuilders$6.softline;
const group$3 = docBuilders$6.group;
const indent$5 = docBuilders$6.indent;
// const ifBreak = docBuilders.ifBreak;
// http://w3c.github.io/html/single-page.html#void-elements
const voidTags = {
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
};
function genericPrint$2(path, options, print) {
    const n = path.getValue();
    if (!n) {
        return "";
    }
    if (typeof n === "string") {
        return n;
    }
    switch (n.type) {
        case "root": {
            return printChildren(path, print);
        }
        case "directive": {
            return concat$5(["<", n.data, ">", hardline$5]);
        }
        case "text": {
            return n.data.replace(/\s+/g, " ").trim();
        }
        case "script":
        case "style":
        case "tag": {
            const selfClose = voidTags[n.name] ? ">" : " />";
            const children = printChildren(path, print);
            const hasNewline = util$8.hasNewlineInRange(options.originalText, util$8.locStart(n), util$8.locEnd(n));
            return group$3(concat$5([
                hasNewline ? hardline$5 : "",
                "<",
                n.name,
                printAttributes(path, print),
                n.children.length ? ">" : selfClose,
                n.name.toLowerCase() === "html"
                    ? concat$5([hardline$5, children])
                    : indent$5(children),
                n.children.length ? concat$5([softline$4, "</", n.name, ">"]) : hardline$5
            ]));
        }
        case "comment": {
            return concat$5(["<!-- ", n.data.trim(), " -->"]);
        }
        case "attribute": {
            if (!n.value) {
                return n.key;
            }
            return concat$5([n.key, '="', n.value, '"']);
        }
        default:
            throw new Error("unknown htmlparser2 type: " + n.type);
    }
}
function printAttributes(path, print) {
    const node = path.getValue();
    return concat$5([
        node.attributes.length ? " " : "",
        indent$5(join$4(line$3, path.map(print, "attributes")))
    ]);
}
function printChildren(path, print) {
    const children = [];
    path.each(childPath => {
        const child = childPath.getValue();
        if (child.type !== "text") {
            children.push(hardline$5);
        }
        children.push(childPath.call(print));
    }, "children");
    return concat$5(children);
}
var printerHtmlparser2 = genericPrint$2;
const util$9 = util$3;
const docBuilders$7 = docBuilders$1;
const concat$6 = docBuilders$7.concat;
const join$5 = docBuilders$7.join;
const line$4 = docBuilders$7.line;
const hardline$6 = docBuilders$7.hardline;
const softline$5 = docBuilders$7.softline;
const group$4 = docBuilders$7.group;
const fill$2 = docBuilders$7.fill;
const indent$6 = docBuilders$7.indent;
const docUtils$4 = docUtils$2;
const removeLines$1 = docUtils$4.removeLines;
function genericPrint$3(path, options, print) {
    const n = path.getValue();
    if (!n) {
        return "";
    }
    if (typeof n === "string") {
        return n;
    }
    switch (n.type) {
        case "css-root": {
            return concat$6([printNodeSequence(path, options, print), hardline$6]);
        }
        case "css-comment": {
            if (n.raws.content) {
                return n.raws.content;
            }
            const text = options.originalText.slice(util$9.locStart(n), util$9.locEnd(n));
            const rawText = n.raws.text || n.text;
            // Workaround a bug where the location is off.
            // https://github.com/postcss/postcss-scss/issues/63
            if (text.indexOf(rawText) === -1) {
                if (n.raws.inline) {
                    return concat$6(["// ", rawText]);
                }
                return concat$6(["/* ", rawText, " */"]);
            }
            return text;
        }
        case "css-rule": {
            return concat$6([
                path.call(print, "selector"),
                n.important ? " !important" : "",
                n.nodes
                    ? concat$6([
                        " {",
                        n.nodes.length > 0
                            ? indent$6(concat$6([hardline$6, printNodeSequence(path, options, print)]))
                            : "",
                        hardline$6,
                        "}"
                    ])
                    : ";"
            ]);
        }
        case "css-decl": {
            // When the following less construct &:extend(.foo); is parsed with scss,
            // it will put a space after `:` and break it. Ideally we should parse
            // less files with less, but we can hardcode this to work with scss as
            // well.
            const isValueExtend = n.value.type === "value-root" &&
                n.value.group.type === "value-value" &&
                n.value.group.group.type === "value-func" &&
                n.value.group.group.value === "extend";
            const isComposed = n.value.type === "value-root" &&
                n.value.group.type === "value-value" &&
                n.prop === "composes";
            return concat$6([
                n.raws.before.replace(/[\s;]/g, ""),
                n.prop,
                ":",
                isValueExtend ? "" : " ",
                isComposed
                    ? removeLines$1(path.call(print, "value"))
                    : path.call(print, "value"),
                n.important ? " !important" : "",
                n.nodes
                    ? concat$6([
                        " {",
                        indent$6(concat$6([softline$5, printNodeSequence(path, options, print)])),
                        softline$5,
                        "}"
                    ])
                    : ";"
            ]);
        }
        case "css-atrule": {
            const hasParams = n.params &&
                !(n.params.type === "media-query-list" && n.params.value === "");
            return concat$6([
                "@",
                n.name,
                hasParams ? concat$6([" ", path.call(print, "params")]) : "",
                n.nodes
                    ? concat$6([
                        " {",
                        indent$6(concat$6([
                            n.nodes.length > 0 ? softline$5 : "",
                            printNodeSequence(path, options, print)
                        ])),
                        softline$5,
                        "}"
                    ])
                    : ";"
            ]);
        }
        case "css-import": {
            return concat$6([
                "@",
                n.name,
                " ",
                n.directives ? concat$6([n.directives, " "]) : "",
                n.importPath,
                ";"
            ]);
        }
        // postcss-media-query-parser
        case "media-query-list": {
            const parts = [];
            path.each(childPath => {
                const node = childPath.getValue();
                if (node.type === "media-query" && node.value === "") {
                    return;
                }
                parts.push(childPath.call(print));
            }, "nodes");
            return group$4(indent$6(join$5(concat$6([",", line$4]), parts)));
        }
        case "media-query": {
            return join$5(" ", path.map(print, "nodes"));
        }
        case "media-type": {
            return n.value;
        }
        case "media-feature-expression": {
            if (!n.nodes) {
                return n.value;
            }
            return concat$6(["(", concat$6(path.map(print, "nodes")), ")"]);
        }
        case "media-feature": {
            return n.value.replace(/ +/g, " ");
        }
        case "media-colon": {
            return concat$6([n.value, " "]);
        }
        case "media-value": {
            return n.value;
        }
        case "media-keyword": {
            return n.value;
        }
        case "media-url": {
            return n.value;
        }
        case "media-unknown": {
            return n.value;
        }
        // postcss-selector-parser
        case "selector-root": {
            return group$4(join$5(concat$6([",", hardline$6]), path.map(print, "nodes")));
        }
        case "selector-comment": {
            return n.value;
        }
        case "selector-string": {
            return n.value;
        }
        case "selector-tag": {
            return n.value;
        }
        case "selector-id": {
            return concat$6(["#", n.value]);
        }
        case "selector-class": {
            return concat$6([".", n.value]);
        }
        case "selector-attribute": {
            return concat$6([
                "[",
                n.attribute,
                n.operator ? n.operator : "",
                n.value ? n.value : "",
                n.insensitive ? " i" : "",
                "]"
            ]);
        }
        case "selector-combinator": {
            if (n.value === "+" || n.value === ">" || n.value === "~") {
                const parent = path.getParentNode();
                const leading = parent.type === "selector-selector" && parent.nodes[0] === n
                    ? ""
                    : line$4;
                return concat$6([leading, n.value, " "]);
            }
            return n.value.trim() || line$4;
        }
        case "selector-universal": {
            return n.value;
        }
        case "selector-selector": {
            return group$4(indent$6(concat$6(path.map(print, "nodes"))));
        }
        case "selector-pseudo": {
            return concat$6([
                n.value,
                n.nodes && n.nodes.length > 0
                    ? concat$6(["(", join$5(", ", path.map(print, "nodes")), ")"])
                    : ""
            ]);
        }
        case "selector-nesting": {
            return printValue(n.value);
        }
        // postcss-values-parser
        case "value-root": {
            return path.call(print, "group");
        }
        case "value-comma_group": {
            const printed = path.map(print, "groups");
            const parts = [];
            for (let i = 0; i < n.groups.length; ++i) {
                parts.push(printed[i]);
                if (i !== n.groups.length - 1 &&
                    n.groups[i + 1].raws &&
                    n.groups[i + 1].raws.before !== "") {
                    if (n.groups[i + 1].type === "value-operator" &&
                        ["+", "-", "/", "*", "%"].indexOf(n.groups[i + 1].value) !== -1) {
                        parts.push(" ");
                    }
                    else {
                        parts.push(line$4);
                    }
                }
            }
            return group$4(indent$6(fill$2(parts)));
        }
        case "value-paren_group": {
            const parent = path.getParentNode();
            const isURLCall = parent && parent.type === "value-func" && parent.value === "url";
            if (isURLCall &&
                (n.groups.length === 1 ||
                    (n.groups.length > 0 &&
                        n.groups[0].type === "value-comma_group" &&
                        n.groups[0].groups.length > 0 &&
                        n.groups[0].groups[0].type === "value-word" &&
                        n.groups[0].groups[0].value === "data"))) {
                return concat$6([
                    n.open ? path.call(print, "open") : "",
                    join$5(",", path.map(print, "groups")),
                    n.close ? path.call(print, "close") : ""
                ]);
            }
            if (!n.open) {
                const printed = path.map(print, "groups");
                const res = [];
                for (let i = 0; i < printed.length; i++) {
                    if (i !== 0) {
                        res.push(concat$6([",", line$4]));
                    }
                    res.push(printed[i]);
                }
                return group$4(indent$6(fill$2(res)));
            }
            return group$4(concat$6([
                n.open ? path.call(print, "open") : "",
                indent$6(concat$6([
                    softline$5,
                    join$5(concat$6([",", line$4]), path.map(print, "groups"))
                ])),
                softline$5,
                n.close ? path.call(print, "close") : ""
            ]));
        }
        case "value-value": {
            return path.call(print, "group");
        }
        case "value-func": {
            return concat$6([n.value, path.call(print, "group")]);
        }
        case "value-paren": {
            if (n.raws.before !== "") {
                return concat$6([line$4, n.value]);
            }
            return n.value;
        }
        case "value-number": {
            return concat$6([n.value, n.unit]);
        }
        case "value-operator": {
            return n.value;
        }
        case "value-word": {
            if (n.isColor && n.isHex) {
                return n.value.toLowerCase();
            }
            return n.value;
        }
        case "value-colon": {
            return n.value;
        }
        case "value-comma": {
            return concat$6([n.value, " "]);
        }
        case "value-string": {
            return concat$6([
                n.quoted ? n.raws.quote : "",
                n.value,
                n.quoted ? n.raws.quote : ""
            ]);
        }
        case "value-atword": {
            return concat$6(["@", n.value]);
        }
        default:
            throw new Error("unknown postcss type: " + JSON.stringify(n.type));
    }
}
function printNodeSequence(path, options, print) {
    const node = path.getValue();
    const parts = [];
    let i = 0;
    path.map(pathChild => {
        const prevNode = node.nodes[i - 1];
        if (prevNode &&
            prevNode.type === "css-comment" &&
            prevNode.text.trim() === "prettier-ignore") {
            const childNode = pathChild.getValue();
            parts.push(options.originalText.slice(util$9.locStart(childNode), util$9.locEnd(childNode)));
        }
        else {
            parts.push(pathChild.call(print));
        }
        if (i !== node.nodes.length - 1) {
            if ((node.nodes[i + 1].type === "css-comment" &&
                !util$9.hasNewline(options.originalText, util$9.locStart(node.nodes[i + 1]), { backwards: true })) ||
                (node.nodes[i + 1].type === "css-atrule" &&
                    node.nodes[i + 1].name === "else")) {
                parts.push(" ");
            }
            else {
                parts.push(hardline$6);
                if (util$9.isNextLineEmpty(options.originalText, pathChild.getValue())) {
                    parts.push(hardline$6);
                }
            }
        }
        i++;
    }, "nodes");
    return concat$6(parts);
}
function printValue(value) {
    return value;
}
var printerPostcss = genericPrint$3;
const assert$1 = require$$0;
const comments$3 = comments$1;
const FastPath = fastPath;
const multiparser = multiparser$1;
const util$5 = util$3;
const isIdentifierName = utils.keyword.isIdentifierNameES6;
const docBuilders$3 = docBuilders$1;
const concat$2 = docBuilders$3.concat;
const join$2 = docBuilders$3.join;
const line$1 = docBuilders$3.line;
const hardline$2 = docBuilders$3.hardline;
const softline$1 = docBuilders$3.softline;
const literalline$1 = docBuilders$3.literalline;
const group$1 = docBuilders$3.group;
const indent$2 = docBuilders$3.indent;
const align$1 = docBuilders$3.align;
const conditionalGroup$1 = docBuilders$3.conditionalGroup;
const fill$1 = docBuilders$3.fill;
const ifBreak$1 = docBuilders$3.ifBreak;
const breakParent$2 = docBuilders$3.breakParent;
const lineSuffixBoundary$1 = docBuilders$3.lineSuffixBoundary;
const addAlignmentToDoc$1 = docBuilders$3.addAlignmentToDoc;
const docUtils = docUtils$2;
const willBreak = docUtils.willBreak;
const isLineNext = docUtils.isLineNext;
const isEmpty = docUtils.isEmpty;
const rawText = docUtils.rawText;
function shouldPrintComma(options, level) {
    return options.trailingComma[level];
}
function getPrintFunction(options) {
    switch (options.parser) {
        case "graphql":
            return printerGraphql;
        case "parse5":
            return printerHtmlparser2;
        case "postcss":
            return printerPostcss;
        default:
            return genericPrintNoParens;
    }
}
function hasJsxIgnoreComment(path) {
    const node = path.getValue();
    const parent = path.getParentNode();
    if (!parent || node.type !== "JSXElement" || parent.type !== "JSXElement") {
        return false;
    }
    // Lookup the previous sibling, ignoring any empty JSXText elements
    const index = parent.children.indexOf(node);
    let prevSibling = null;
    for (let i = index; i > 0; i--) {
        const candidate = parent.children[i - 1];
        if (candidate.type === "JSXText" && !isMeaningfulJSXText(candidate)) {
            continue;
        }
        prevSibling = candidate;
        break;
    }
    return (prevSibling &&
        prevSibling.type === "JSXExpressionContainer" &&
        prevSibling.expression.type === "JSXEmptyExpression" &&
        prevSibling.expression.comments.find(comment => comment.value.trim() === "prettier-ignore"));
}
function genericPrint(path, options, printPath, args) {
    assert$1.ok(path instanceof FastPath);
    const node = path.getValue();
    // Escape hatch
    if (node &&
        ((node.comments &&
            node.comments.length > 0 &&
            node.comments.some(comment => comment.value.trim() === "prettier-ignore")) ||
            hasJsxIgnoreComment(path))) {
        return options.originalText.slice(util$5.locStart(node), util$5.locEnd(node));
    }
    if (node) {
        // Potentially switch to a different parser
        const next = multiparser.getSubtreeParser(path, options);
        if (next) {
            try {
                return multiparser.printSubtree(next, path, printPath, options);
            }
            catch (error) {
                /* istanbul ignore if */
                if (process.env.PRETTIER_DEBUG) {
                    const e = new Error(error);
                    e.parser = next.options.parser;
                    throw e;
                }
                // Continue with current parser
            }
        }
    }
    let needsParens = false;
    const linesWithoutParens = getPrintFunction(options)(path, options, printPath, args);
    if (!node || isEmpty(linesWithoutParens)) {
        return linesWithoutParens;
    }
    const decorators = [];
    if (node.decorators &&
        node.decorators.length > 0 &&
        // If the parent node is an export declaration, it will be
        // responsible for printing node.decorators.
        !util$5.getParentExportDeclaration(path)) {
        let separator = hardline$2;
        path.each(decoratorPath => {
            let prefix = "@";
            let decorator = decoratorPath.getValue();
            if (decorator.expression) {
                decorator = decorator.expression;
                prefix = "";
            }
            if (node.decorators.length === 1 &&
                node.type !== "ClassDeclaration" &&
                node.type !== "MethodDefinition" &&
                node.type !== "ClassMethod" &&
                (decorator.type === "Identifier" ||
                    decorator.type === "MemberExpression" ||
                    (decorator.type === "CallExpression" &&
                        (decorator.arguments.length === 0 ||
                            (decorator.arguments.length === 1 &&
                                (isStringLiteral(decorator.arguments[0]) ||
                                    decorator.arguments[0].type === "Identifier" ||
                                    decorator.arguments[0].type === "MemberExpression")))))) {
                separator = line$1;
            }
            decorators.push(prefix, printPath(decoratorPath), separator);
        }, "decorators");
    }
    else if (util$5.isExportDeclaration(node) &&
        node.declaration &&
        node.declaration.decorators) {
        // Export declarations are responsible for printing any decorators
        // that logically apply to node.declaration.
        path.each(decoratorPath => {
            const decorator = decoratorPath.getValue();
            const prefix = decorator.type === "Decorator" ? "" : "@";
            decorators.push(prefix, printPath(decoratorPath), hardline$2);
        }, "declaration", "decorators");
    }
    else {
        // Nodes with decorators can't have parentheses, so we can avoid
        // computing path.needsParens() except in this case.
        needsParens = path.needsParens(options);
    }
    if (node.type) {
        // HACK: ASI prevention in no-semi mode relies on knowledge of whether
        // or not a paren has been inserted (see `exprNeedsASIProtection()`).
        // For now, we're just passing that information by mutating the AST here,
        // but it would be nice to find a cleaner way to do this.
        node.needsParens = needsParens;
    }
    const parts = [];
    if (needsParens) {
        parts.unshift("(");
    }
    parts.push(linesWithoutParens);
    if (needsParens) {
        parts.push(")");
    }
    if (decorators.length > 0) {
        return group$1(concat$2(decorators.concat(parts)));
    }
    return concat$2(parts);
}
function getPropertyPadding(options, path) {
    if (!options.alignObjectProperties) {
        return "";
    }
    const n = path.getValue();
    const type = n.type;
    const parentNode = path.getParentNode();
    const isPropertyKey = (parentNode.type === "Property" || parentNode.type === "ObjectProperty") &&
        parentNode.key === n;
    if (!isPropertyKey) {
        return "";
    }
    const parentObject = path.getParentNode(1);
    const shouldBreak = util$5.hasNewlineInRange(options.originalText, util$5.locStart(parentObject), util$5.locEnd(parentObject));
    if (!shouldBreak) {
        return "";
    }
    const nameLength = type === "Identifier"
        ? n.name.length
        : type === "NumericLiteral"
            ? printNumber(n.extra.raw).length
            : type === "StringLiteral" ? nodeStr(n, options).length : undefined;
    if (nameLength === undefined) {
        return "";
    }
    const properties = parentObject.properties;
    const lengths = properties.map(p => {
        if (!p.key) {
            return 0;
        }
        return p.key.end - p.key.start + (p.computed ? 2 : 0);
    });
    const maxLength = Math.max.apply(null, lengths);
    const padLength = maxLength - nameLength + 1;
    const padding = " ".repeat(padLength);
    return padding;
}
function genericPrintNoParens(path, options, print, args) {
    const n = path.getValue();
    const semi = options.semi ? ";" : "";
    if (!n) {
        return "";
    }
    if (typeof n === "string") {
        return n;
    }
    let parts = [];
    switch (n.type) {
        case "File":
            return path.call(print, "program");
        case "Program":
            // Babel 6
            if (n.directives) {
                path.each(childPath => {
                    parts.push(print(childPath), semi, hardline$2);
                    if (util$5.isNextLineEmpty(options.originalText, childPath.getValue())) {
                        parts.push(hardline$2);
                    }
                }, "directives");
            }
            parts.push(path.call(bodyPath => {
                return printStatementSequence(bodyPath, options, print);
            }, "body"));
            parts.push(comments$3.printDanglingComments(path, options, /* sameIndent */ true));
            // Only force a trailing newline if there were any contents.
            if (n.body.length || n.comments) {
                parts.push(hardline$2);
            }
            return concat$2(parts);
        // Babel extension.
        case "EmptyStatement":
            return "";
        case "ExpressionStatement":
            // Detect Flow-parsed directives
            if (n.directive) {
                return concat$2([nodeStr(n.expression, options, true), semi]);
            }
            return concat$2([path.call(print, "expression"), semi]); // Babel extension.
        case "ParenthesizedExpression":
            return concat$2(["(", path.call(print, "expression"), ")"]);
        case "AssignmentExpression":
            return printAssignment(n.left, path.call(print, "left"), concat$2([" ", n.operator]), n.right, path.call(print, "right"), options, n.type);
        case "BinaryExpression":
        case "LogicalExpression": {
            const parent = path.getParentNode();
            const parentParent = path.getParentNode(1);
            const isInsideParenthesis = n !== parent.body &&
                (parent.type === "IfStatement" ||
                    parent.type === "WhileStatement" ||
                    parent.type === "DoWhileStatement");
            const parts = printBinaryishExpressions(path, print, options, 
            /* isNested */ false, isInsideParenthesis);
            //   if (
            //     this.hasPlugin("dynamicImports") && this.lookahead().type === tt.parenLeft
            //   ) {
            //
            // looks super weird, we want to break the children if the parent breaks
            //
            //   if (
            //     this.hasPlugin("dynamicImports") &&
            //     this.lookahead().type === tt.parenLeft
            //   ) {
            if (isInsideParenthesis) {
                return concat$2(parts);
            }
            if (parent.type === "UnaryExpression") {
                return group$1(concat$2([indent$2(concat$2([softline$1, concat$2(parts)])), softline$1]));
            }
            // Avoid indenting sub-expressions in assignment/return/etc statements.
            if (parent.type === "AssignmentExpression" ||
                parent.type === "VariableDeclarator" ||
                shouldInlineLogicalExpression(n) ||
                parent.type === "ReturnStatement" ||
                (parent.type === "JSXExpressionContainer" &&
                    parentParent.type === "JSXAttribute") ||
                (n === parent.body && parent.type === "ArrowFunctionExpression") ||
                (n !== parent.body && parent.type === "ForStatement") ||
                parent.type === "ObjectProperty" ||
                parent.type === "Property" ||
                parent.type === "ConditionalExpression") {
                return group$1(concat$2(parts));
            }
            const rest = concat$2(parts.slice(1));
            return group$1(concat$2([
                // Don't include the initial expression in the indentation
                // level. The first item is guaranteed to be the first
                // left-most expression.
                parts.length > 0 ? parts[0] : "",
                indent$2(rest)
            ]));
        }
        case "AssignmentPattern":
            return concat$2([
                path.call(print, "left"),
                " = ",
                path.call(print, "right")
            ]);
        case "TSTypeAssertionExpression":
            return concat$2([
                "<",
                path.call(print, "typeAnnotation"),
                ">",
                path.call(print, "expression")
            ]);
        case "MemberExpression": {
            const parent = path.getParentNode();
            let firstNonMemberParent;
            let i = 0;
            do {
                firstNonMemberParent = path.getParentNode(i);
                i++;
            } while (firstNonMemberParent && firstNonMemberParent.type === "MemberExpression");
            const shouldInline = (firstNonMemberParent &&
                ((firstNonMemberParent.type === "VariableDeclarator" &&
                    firstNonMemberParent.id.type !== "Identifier") ||
                    (firstNonMemberParent.type === "AssignmentExpression" &&
                        firstNonMemberParent.left.type !== "Identifier"))) ||
                n.computed ||
                (n.object.type === "Identifier" &&
                    n.property.type === "Identifier" &&
                    parent.type !== "MemberExpression");
            return concat$2([
                path.call(print, "object"),
                shouldInline
                    ? printMemberLookup(path, options, print)
                    : group$1(indent$2(concat$2([softline$1, printMemberLookup(path, options, print)])))
            ]);
        }
        case "MetaProperty":
            return concat$2([
                path.call(print, "meta"),
                ".",
                path.call(print, "property")
            ]);
        case "BindExpression":
            if (n.object) {
                parts.push(path.call(print, "object"));
            }
            parts.push(printBindExpressionCallee(path, options, print));
            return concat$2(parts);
        case "Identifier": {
            const parentNode = path.getParentNode();
            const isFunctionDeclarationIdentifier = parentNode.type === "DeclareFunction" && parentNode.id === n;
            return concat$2([
                n.name,
                n.optional ? "?" : "",
                n.typeAnnotation && !isFunctionDeclarationIdentifier ? ": " : "",
                path.call(print, "typeAnnotation")
            ]);
        }
        case "SpreadElement":
        case "SpreadElementPattern":
        case "RestProperty":
        case "ExperimentalRestProperty":
        case "ExperimentalSpreadProperty":
        case "SpreadProperty":
        case "SpreadPropertyPattern":
        case "RestElement":
        case "ObjectTypeSpreadProperty":
            return concat$2([
                "...",
                path.call(print, "argument"),
                n.typeAnnotation ? ": " : "",
                path.call(print, "typeAnnotation")
            ]);
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "TSNamespaceFunctionDeclaration":
            if (isNodeStartingWithDeclare(n, options)) {
                parts.push("declare ");
            }
            parts.push(printFunctionDeclaration(path, print, options));
            if (!n.body) {
                parts.push(semi);
            }
            return concat$2(parts);
        case "ArrowFunctionExpression": {
            if (n.async) {
                parts.push("async ");
            }
            //parts.push(printFunctionTypeParameters(path, options, print));
            if (canPrintParamsWithoutParens(n, options)) {
                parts.push(path.call(print, "params", 0));
            }
            else {
                parts.push(group$1(concat$2([
                    printFunctionParams(path, print, options, 
                    /* expandLast */ args &&
                        (args.expandLastArg || args.expandFirstArg), 
                    /* printTypeParams */ true),
                    printReturnType(path, print)
                ])));
            }
            parts.push(" =>");
            const body = path.call(bodyPath => print(bodyPath, args), "body");
            // We want to always keep these types of nodes on the same line
            // as the arrow.
            if (!hasLeadingOwnLineComment(options.originalText, n.body) &&
                (n.body.type === "ArrayExpression" ||
                    n.body.type === "ObjectExpression" ||
                    n.body.type === "BlockStatement" ||
                    n.body.type === "JSXElement" ||
                    isTemplateOnItsOwnLine(n.body, options.originalText) ||
                    n.body.type === "ArrowFunctionExpression")) {
                return group$1(concat$2([concat$2(parts), " ", body]));
            }
            // We handle sequence expressions as the body of arrows specially,
            // so that the required parentheses end up on their own lines.
            if (n.body.type === "SequenceExpression") {
                return group$1(concat$2([
                    concat$2(parts),
                    group$1(concat$2([" (", indent$2(concat$2([softline$1, body])), softline$1, ")"]))
                ]));
            }
            // if the arrow function is expanded as last argument, we are adding a
            // level of indentation and need to add a softline to align the closing )
            // with the opening (.
            const shouldAddSoftLine = args && args.expandLastArg;
            // In order to avoid confusion between
            // a => a ? a : a
            // a <= a ? a : a
            const shouldAddParens = n.body.type === "ConditionalExpression" &&
                !util$5.startsWithNoLookaheadToken(n.body, 
                /* forbidFunctionAndClass */ false);
            return group$1(concat$2([
                concat$2(parts),
                group$1(concat$2([
                    indent$2(concat$2([
                        line$1,
                        shouldAddParens ? ifBreak$1("", "(") : "",
                        body,
                        shouldAddParens ? ifBreak$1("", ")") : ""
                    ])),
                    shouldAddSoftLine
                        ? concat$2([
                            ifBreak$1(shouldPrintComma(options, "arguments") ? "," : ""),
                            softline$1
                        ])
                        : ""
                ]))
            ]));
        }
        case "MethodDefinition":
        case "TSAbstractMethodDefinition":
            if (n.accessibility) {
                parts.push(n.accessibility + " ");
            }
            if (n.static) {
                parts.push("static ");
            }
            if (n.type === "TSAbstractMethodDefinition") {
                parts.push("abstract ");
            }
            parts.push(printMethod(path, options, print));
            return concat$2(parts);
        case "YieldExpression":
            parts.push("yield");
            if (n.delegate) {
                parts.push("*");
            }
            if (n.argument) {
                parts.push(" ", path.call(print, "argument"));
            }
            return concat$2(parts);
        case "AwaitExpression":
            return concat$2(["await ", path.call(print, "argument")]);
        case "ImportSpecifier":
            if (n.importKind) {
                parts.push(path.call(print, "importKind"), " ");
            }
            parts.push(path.call(print, "imported"));
            if (n.local && n.local.name !== n.imported.name) {
                parts.push(" as ", path.call(print, "local"));
            }
            return concat$2(parts);
        case "ExportSpecifier":
            parts.push(path.call(print, "local"));
            if (n.exported && n.exported.name !== n.local.name) {
                parts.push(" as ", path.call(print, "exported"));
            }
            return concat$2(parts);
        case "ImportNamespaceSpecifier":
            parts.push("* as ");
            if (n.local) {
                parts.push(path.call(print, "local"));
            }
            else if (n.id) {
                parts.push(path.call(print, "id"));
            }
            return concat$2(parts);
        case "ImportDefaultSpecifier":
            if (n.local) {
                return path.call(print, "local");
            }
            return path.call(print, "id");
        case "TSExportAssigment":
            return concat$2(["export = ", path.call(print, "expression"), semi]);
        case "ExportDefaultDeclaration":
        case "ExportNamedDeclaration":
            return printExportDeclaration(path, options, print);
        case "ExportAllDeclaration":
            return concat$2(["export * from ", path.call(print, "source"), semi]);
        case "ExportNamespaceSpecifier":
        case "ExportDefaultSpecifier":
            return path.call(print, "exported");
        case "ImportDeclaration": {
            parts.push("import ");
            if (n.importKind && n.importKind !== "value") {
                parts.push(n.importKind + " ");
            }
            const standalones = [];
            const grouped = [];
            if (n.specifiers && n.specifiers.length > 0) {
                path.each(specifierPath => {
                    const value = specifierPath.getValue();
                    if (value.type === "ImportDefaultSpecifier" ||
                        value.type === "ImportNamespaceSpecifier") {
                        standalones.push(print(specifierPath));
                    }
                    else {
                        grouped.push(print(specifierPath));
                    }
                }, "specifiers");
                if (standalones.length > 0) {
                    parts.push(join$2(", ", standalones));
                }
                if (standalones.length > 0 && grouped.length > 0) {
                    parts.push(", ");
                }
                if (grouped.length === 1 &&
                    standalones.length === 0 &&
                    n.specifiers &&
                    !n.specifiers.some(node => node.comments)) {
                    parts.push(concat$2([
                        "{",
                        options.bracesSpacing ? " " : "",
                        concat$2(grouped),
                        options.bracesSpacing ? " " : "",
                        "}"
                    ]));
                }
                else if (grouped.length >= 1) {
                    parts.push(group$1(concat$2([
                        "{",
                        indent$2(concat$2([
                            options.bracesSpacing ? line$1 : softline$1,
                            join$2(concat$2([",", line$1]), grouped)
                        ])),
                        ifBreak$1(shouldPrintComma(options, "import") ? "," : ""),
                        options.bracesSpacing ? line$1 : softline$1,
                        "}"
                    ])));
                }
                parts.push(" from ");
            }
            else if ((n.importKind && n.importKind === "type") ||
                // import {} from 'x'
                /{\s*}/.test(options.originalText.slice(util$5.locStart(n), util$5.locStart(n.source)))) {
                parts.push("{} from ");
            }
            parts.push(path.call(print, "source"), semi);
            return concat$2(parts);
        }
        case "Import":
            return "import";
        case "BlockStatement": {
            const naked = path.call(bodyPath => {
                return printStatementSequence(bodyPath, options, print);
            }, "body");
            const hasContent = n.body.find(node => node.type !== "EmptyStatement");
            const hasDirectives = n.directives && n.directives.length > 0;
            const parent = path.getParentNode();
            const parentParent = path.getParentNode(1);
            if (!hasContent &&
                !hasDirectives &&
                !n.comments &&
                (parent.type === "ArrowFunctionExpression" ||
                    parent.type === "FunctionExpression" ||
                    parent.type === "FunctionDeclaration" ||
                    parent.type === "ObjectMethod" ||
                    parent.type === "ClassMethod" ||
                    parent.type === "ForStatement" ||
                    parent.type === "WhileStatement" ||
                    parent.type === "DoWhileStatement" ||
                    (parent.type === "CatchClause" && !parentParent.finalizer))) {
                return "{}";
            }
            parts.push("{");
            // Babel 6
            if (hasDirectives) {
                path.each(childPath => {
                    parts.push(indent$2(concat$2([hardline$2, print(childPath), semi])));
                    if (util$5.isNextLineEmpty(options.originalText, childPath.getValue())) {
                        parts.push(hardline$2);
                    }
                }, "directives");
            }
            if (hasContent) {
                parts.push(indent$2(concat$2([hardline$2, naked])));
            }
            parts.push(comments$3.printDanglingComments(path, options));
            parts.push(hardline$2, "}");
            return concat$2(parts);
        }
        case "ReturnStatement":
            parts.push("return");
            if (n.argument) {
                if (returnArgumentHasLeadingComment(options, n.argument)) {
                    parts.push(concat$2([
                        " (",
                        indent$2(concat$2([softline$1, path.call(print, "argument")])),
                        line$1,
                        ")"
                    ]));
                }
                else if (n.argument.type === "LogicalExpression" ||
                    n.argument.type === "BinaryExpression" ||
                    n.argument.type === "SequenceExpression") {
                    parts.push(group$1(concat$2([
                        ifBreak$1(" (", " "),
                        indent$2(concat$2([softline$1, path.call(print, "argument")])),
                        softline$1,
                        ifBreak$1(")")
                    ])));
                }
                else {
                    parts.push(" ", path.call(print, "argument"));
                }
            }
            if (hasDanglingComments(n)) {
                parts.push(" ", comments$3.printDanglingComments(path, options, /* sameIndent */ true));
            }
            parts.push(semi);
            return concat$2(parts);
        case "NewExpression":
        case "CallExpression": {
            const isNew = n.type === "NewExpression";
            if (
            // We want to keep require calls as a unit
            (!isNew &&
                n.callee.type === "Identifier" &&
                n.callee.name === "require") ||
                n.callee.type === "Import" ||
                // Template literals as single arguments
                (n.arguments.length === 1 &&
                    isTemplateOnItsOwnLine(n.arguments[0], options.originalText)) ||
                // Keep test declarations on a single line
                // e.g. `it('long name', () => {`
                (!isNew &&
                    n.callee.type === "Identifier" &&
                    (n.callee.name === "it" ||
                        n.callee.name === "test" ||
                        n.callee.name === "describe") &&
                    n.arguments.length === 2 &&
                    (n.arguments[0].type === "StringLiteral" ||
                        n.arguments[0].type === "TemplateLiteral" ||
                        (n.arguments[0].type === "Literal" &&
                            typeof n.arguments[0].value === "string")) &&
                    (n.arguments[1].type === "FunctionExpression" ||
                        n.arguments[1].type === "ArrowFunctionExpression") &&
                    n.arguments[1].params.length <= 1)) {
                return concat$2([
                    isNew ? "new " : "",
                    path.call(print, "callee"),
                    path.call(print, "typeParameters"),
                    concat$2(["(", join$2(", ", path.map(print, "arguments")), ")"])
                ]);
            }
            // We detect calls on member lookups and possibly print them in a
            // special chain format. See `printMemberChain` for more info.
            if (!isNew && isMemberish(n.callee)) {
                return printMemberChain(path, options, print);
            }
            return concat$2([
                isNew ? "new " : "",
                path.call(print, "callee"),
                printFunctionTypeParameters(path, options, print),
                printArgumentsList(path, options, print)
            ]);
        }
        case "TSInterfaceDeclaration":
            parts.push(n.abstract ? "abstract " : "", printTypeScriptModifiers(path, options, print), "interface ", path.call(print, "id"), n.typeParameters ? path.call(print, "typeParameters") : "", " ");
            if (n.heritage.length) {
                parts.push(group$1(indent$2(concat$2([
                    softline$1,
                    "extends ",
                    indent$2(join$2(concat$2([",", line$1]), path.map(print, "heritage"))),
                    " "
                ]))));
            }
            parts.push(path.call(print, "body"));
            return concat$2(parts);
        case "ObjectExpression":
        case "ObjectPattern":
        case "ObjectTypeAnnotation":
        case "TSInterfaceBody":
        case "TSTypeLiteral": {
            const isTypeAnnotation = n.type === "ObjectTypeAnnotation";
            const shouldBreak = n.type === "TSInterfaceBody" ||
                (n.type !== "ObjectPattern" &&
                    util$5.hasNewlineInRange(options.originalText, util$5.locStart(n), util$5.locEnd(n)));
            const separator = n.type === "TSInterfaceBody" || n.type === "TSTypeLiteral"
                ? ifBreak$1(semi, ";")
                : ",";
            const fields = [];
            const leftBrace = n.exact ? "{|" : "{";
            const rightBrace = n.exact ? "|}" : "}";
            const parent = path.getParentNode(0);
            let propertiesField;
            if (n.type === "TSTypeLiteral") {
                propertiesField = "members";
            }
            else if (n.type === "TSInterfaceBody") {
                propertiesField = "body";
            }
            else {
                propertiesField = "properties";
            }
            if (isTypeAnnotation) {
                fields.push("indexers", "callProperties");
            }
            fields.push(propertiesField);
            // Unfortunately, things are grouped together in the ast can be
            // interleaved in the source code. So we need to reorder them before
            // printing them.
            const propsAndLoc = [];
            fields.forEach(field => {
                path.each(childPath => {
                    const node = childPath.getValue();
                    propsAndLoc.push({
                        node: node,
                        printed: print(childPath),
                        loc: util$5.locStart(node)
                    });
                }, field);
            });
            let separatorParts = [];
            const props = propsAndLoc.sort((a, b) => a.loc - b.loc).map(prop => {
                const result = concat$2(separatorParts.concat(group$1(prop.printed)));
                separatorParts = [separator, line$1];
                if (util$5.isNextLineEmpty(options.originalText, prop.node)) {
                    separatorParts.push(hardline$2);
                }
                return result;
            });
            const lastElem = util$5.getLast(n[propertiesField]);
            const canHaveTrailingSeparator = !(lastElem &&
                (lastElem.type === "RestProperty" || lastElem.type === "RestElement"));
            let content;
            if (props.length === 0 && !n.typeAnnotation) {
                if (!hasDanglingComments(n)) {
                    return concat$2([leftBrace, rightBrace]);
                }
                content = group$1(concat$2([
                    leftBrace,
                    comments$3.printDanglingComments(path, options),
                    softline$1,
                    rightBrace,
                    n.optional ? "?" : ""
                ]));
            }
            else {
                content = concat$2([
                    leftBrace,
                    indent$2(concat$2([options.bracesSpacing ? line$1 : softline$1, concat$2(props)])),
                    ifBreak$1(canHaveTrailingSeparator &&
                        (separator !== "," || shouldPrintComma(options, "object"))
                        ? separator
                        : ""),
                    concat$2([options.bracesSpacing ? line$1 : softline$1, rightBrace]),
                    n.optional ? "?" : "",
                    n.typeAnnotation ? ": " : "",
                    path.call(print, "typeAnnotation")
                ]);
            }
            // If we inline the object as first argument of the parent, we don't want
            // to create another group so that the object breaks before the return
            // type
            const parentParentParent = path.getParentNode(2);
            if ((n.type === "ObjectPattern" &&
                parent &&
                shouldHugArguments(parent) &&
                parent.params[0] === n) ||
                (shouldHugType(n) &&
                    parentParentParent &&
                    shouldHugArguments(parentParentParent) &&
                    parentParentParent.params[0].typeAnnotation.typeAnnotation === n)) {
                return content;
            }
            return group$1(content, { shouldBreak });
        }
        // Babel 6
        case "ObjectProperty": // Non-standard AST node type.
        case "Property":
            if (n.method || n.kind === "get" || n.kind === "set") {
                return printMethod(path, options, print);
            }
            if (n.shorthand) {
                parts.push(path.call(print, "value"));
            }
            else {
                let printedLeft;
                const propertyPadding = path.call(getPropertyPadding.bind(null, options), "key");
                if (n.computed) {
                    printedLeft = concat$2([
                        "[",
                        path.call(print, "key"),
                        "]",
                        propertyPadding.slice(2)
                    ]);
                }
                else {
                    printedLeft = concat$2([
                        printPropertyKey(path, options, print),
                        propertyPadding
                    ]);
                }
                parts.push(printAssignment(n.key, printedLeft, ":", n.value, path.call(print, "value"), options, n.type));
            }
            return concat$2(parts); // Babel 6
        case "ClassMethod":
            if (n.static) {
                parts.push("static ");
            }
            parts = parts.concat(printObjectMethod(path, options, print));
            return concat$2(parts); // Babel 6
        case "ObjectMethod":
            return printObjectMethod(path, options, print);
        case "Decorator":
            return concat$2(["@", path.call(print, "expression")]);
        case "ArrayExpression":
        case "ArrayPattern":
            if (n.elements.length === 0) {
                if (!hasDanglingComments(n)) {
                    parts.push("[]");
                }
                else {
                    parts.push(group$1(concat$2([
                        "[",
                        comments$3.printDanglingComments(path, options),
                        softline$1,
                        "]"
                    ])));
                }
            }
            else {
                const lastElem = util$5.getLast(n.elements);
                const canHaveTrailingComma = !(lastElem && lastElem.type === "RestElement");
                // JavaScript allows you to have empty elements in an array which
                // changes its length based on the number of commas. The algorithm
                // is that if the last argument is null, we need to force insert
                // a comma to ensure JavaScript recognizes it.
                //   [,].length === 1
                //   [1,].length === 1
                //   [1,,].length === 2
                //
                // Note that util.getLast returns null if the array is empty, but
                // we already check for an empty array just above so we are safe
                const needsForcedTrailingComma = canHaveTrailingComma && lastElem === null;
                const printedElements = [];
                let separatorParts = [];
                path.each(childPath => {
                    printedElements.push(concat$2(separatorParts));
                    printedElements.push(group$1(print(childPath)));
                    separatorParts = [",", options.arrayExpand ? hardline$2 : line$1];
                    if (childPath.getValue() &&
                        util$5.isNextLineEmpty(options.originalText, childPath.getValue())) {
                        separatorParts.push(softline$1);
                    }
                }, "elements");
                parts.push(group$1(concat$2([
                    "[",
                    indent$2(concat$2([
                        options.bracketSpacing ? line$1 : softline$1,
                        printArrayItems(path, options, "elements", print)
                    ])),
                    needsForcedTrailingComma ? "," : "",
                    ifBreak$1(canHaveTrailingComma &&
                        !needsForcedTrailingComma &&
                        shouldPrintComma(options, "array")
                        ? ","
                        : ""),
                    comments$3.printDanglingComments(path, options, 
                    /* sameIndent */ true),
                    options.arrayExpand
                        ? hardline$2
                        : options.bracketSpacing ? line$1 : softline$1,
                    "]"
                ])));
            }
            if (n.optional) {
                parts.push("?");
            }
            if (n.typeAnnotation) {
                parts.push(": ", path.call(print, "typeAnnotation"));
            }
            return concat$2(parts);
        case "SequenceExpression": {
            const parent = path.getParentNode(0);
            if (parent.type === "ExpressionStatement" ||
                parent.type === "ForStatement") {
                // For ExpressionStatements and for-loop heads, which are among
                // the few places a SequenceExpression appears unparenthesized, we want
                // to indent expressions after the first.
                const parts = [];
                path.each(p => {
                    if (p.getName() === 0) {
                        parts.push(print(p));
                    }
                    else {
                        parts.push(",", indent$2(concat$2([line$1, print(p)])));
                    }
                }, "expressions");
                return group$1(concat$2(parts));
            }
            return group$1(concat$2([join$2(concat$2([",", line$1]), path.map(print, "expressions"))]));
        }
        case "ThisExpression":
            return "this";
        case "Super":
            return "super";
        case "NullLiteral":
            return "null";
        case "RegExpLiteral":
            return printRegex(n);
        case "NumericLiteral":
            return printNumber(n.extra.raw);
        case "BooleanLiteral": // Babel 6 Literal split
        case "StringLiteral": // Babel 6 Literal split
        case "Literal": {
            if (n.regex) {
                return printRegex(n.regex);
            }
            if (typeof n.value === "number") {
                return printNumber(n.raw);
            }
            if (typeof n.value !== "string") {
                return "" + n.value;
            }
            // TypeScript workaround for eslint/typescript-eslint-parser#267
            // See corresponding workaround in fast-path.js needsParens()
            const grandParent = path.getParentNode(1);
            const isTypeScriptDirective = options.parser === "typescript" &&
                typeof n.value === "string" &&
                grandParent &&
                (grandParent.type === "Program" ||
                    grandParent.type === "BlockStatement");
            return nodeStr(n, options, isTypeScriptDirective);
        }
        case "Directive":
            return path.call(print, "value"); // Babel 6
        case "DirectiveLiteral":
            return nodeStr(n, options);
        case "UnaryExpression":
            parts.push(n.operator);
            if (/[a-z]$/.test(n.operator)) {
                parts.push(" ");
            }
            parts.push(path.call(print, "argument"));
            return concat$2(parts);
        case "UpdateExpression":
            parts.push(path.call(print, "argument"), n.operator);
            if (n.prefix) {
                parts.reverse();
            }
            return concat$2(parts);
        case "ConditionalExpression": {
            // We print a ConditionalExpression in either "JSX mode" or "normal mode".
            // See tests/jsx/conditional-expression.js for more info.
            let jsxMode = false;
            const parent = path.getParentNode();
            let forceNoIndent = parent.type === "ConditionalExpression";
            // Find the outermost non-ConditionalExpression parent, and the outermost
            // ConditionalExpression parent. We'll use these to determine if we should
            // print in JSX mode.
            let currentParent;
            let previousParent;
            let i = 0;
            do {
                previousParent = currentParent || n;
                currentParent = path.getParentNode(i);
                i++;
            } while (currentParent && currentParent.type === "ConditionalExpression");
            const firstNonConditionalParent = currentParent || parent;
            const lastConditionalParent = previousParent;
            /**/
            if (options.flattenTernaries) {
                const subTernary = parent.type === n.type;
                const parts = [
                    path.call(print, "test"),
                    " ? ",
                    path.call(print, "consequent"),
                    " :",
                    hardline$2,
                    path.call(print, "alternate")
                ];
                return group$1(subTernary ? concat$2(parts) : indent$2(concat$2([softline$1].concat(parts))));
            }
            /**/
            if (n.test.type === "JSXElement" ||
                n.consequent.type === "JSXElement" ||
                n.alternate.type === "JSXElement" ||
                parent.type === "JSXExpressionContainer" ||
                firstNonConditionalParent.type === "JSXExpressionContainer" ||
                conditionalExpressionChainContainsJSX(lastConditionalParent)) {
                jsxMode = true;
                forceNoIndent = true;
                // Even though they don't need parens, we wrap (almost) everything in
                // parens when using ?: within JSX, because the parens are analagous to
                // curly braces in an if statement.
                const wrap = doc => concat$2([
                    ifBreak$1("(", ""),
                    indent$2(concat$2([softline$1, doc])),
                    softline$1,
                    ifBreak$1(")", "")
                ]);
                // The only things we don't wrap are:
                // * Nested conditional expressions
                // * null
                const shouldNotWrap = node => node.type === "ConditionalExpression" ||
                    node.type === "NullLiteral" ||
                    (node.type === "Literal" && node.value === null);
                parts.push(" ? ", shouldNotWrap(n.consequent)
                    ? path.call(print, "consequent")
                    : wrap(path.call(print, "consequent")), " : ", shouldNotWrap(n.alternate)
                    ? path.call(print, "alternate")
                    : wrap(path.call(print, "alternate")));
            }
            else {
                // normal mode
                parts.push(line$1, "? ", n.consequent.type === "ConditionalExpression" ? ifBreak$1("", "(") : "", align$1(2, path.call(print, "consequent")), n.consequent.type === "ConditionalExpression" ? ifBreak$1("", ")") : "", line$1, ": ", align$1(2, path.call(print, "alternate")));
            }
            // In JSX mode, we want a whole chain of ConditionalExpressions to all
            // break if any of them break. That means we should only group around the
            // outer-most ConditionalExpression.
            const maybeGroup = doc => jsxMode
                ? parent === firstNonConditionalParent ? group$1(doc) : doc
                : group$1(doc); // Always group in normal mode.
            return maybeGroup(concat$2([
                path.call(print, "test"),
                forceNoIndent ? concat$2(parts) : indent$2(concat$2(parts))
            ]));
        }
        case "VariableDeclaration": {
            const printed = path.map(childPath => {
                return print(childPath);
            }, "declarations");
            // We generally want to terminate all variable declarations with a
            // semicolon, except when they in the () part of for loops.
            const parentNode = path.getParentNode();
            const isParentForLoop = parentNode.type === "ForStatement" ||
                parentNode.type === "ForInStatement" ||
                parentNode.type === "ForOfStatement" ||
                parentNode.type === "ForAwaitStatement";
            const hasValue = n.declarations.some(decl => decl.init);
            let firstVariable;
            if (printed.length === 1) {
                firstVariable = printed[0];
            }
            else if (printed.length > 1) {
                // Indent first var to comply with eslint one-var rule
                firstVariable = indent$2(printed[0]);
            }
            parts = [
                isNodeStartingWithDeclare(n, options) ? "declare " : "",
                n.kind,
                firstVariable ? concat$2([" ", firstVariable]) : "",
                indent$2(concat$2(printed
                    .slice(1)
                    .map(p => concat$2([",", hasValue && !isParentForLoop ? hardline$2 : line$1, p]))))
            ];
            if (!(isParentForLoop && parentNode.body !== n)) {
                parts.push(semi);
            }
            return group$1(concat$2(parts));
        }
        case "VariableDeclarator":
            return printAssignment(n.id, concat$2([path.call(print, "id"), path.call(print, "typeParameters")]), " =", n.init, n.init && path.call(print, "init"), options, n.type);
        case "WithStatement":
            return group$1(concat$2([
                "with (",
                path.call(print, "object"),
                ")",
                adjustClause(n.body, path.call(print, "body"))
            ]));
        case "IfStatement": {
            const con = adjustClause(n.consequent, path.call(print, "consequent"));
            const opening = group$1(concat$2([
                "if (",
                group$1(concat$2([
                    indent$2(concat$2([softline$1, path.call(print, "test")])),
                    softline$1
                ])),
                ")",
                con
            ]));
            parts.push(opening);
            if (n.alternate) {
                if (n.consequent.type === "BlockStatement") {
                    if (options.breakBeforeElse) {
                        parts.push(hardline$2, "else");
                    }
                    else {
                        parts.push(" ", "else");
                    }
                }
                else {
                    parts.push(hardline$2, "else");
                }
                parts.push(group$1(adjustClause(n.alternate, path.call(print, "alternate"), n.alternate.type === "IfStatement")));
            }
            return concat$2(parts);
        }
        case "ForStatement": {
            const body = adjustClause(n.body, path.call(print, "body"));
            // We want to keep dangling comments above the loop to stay consistent.
            // Any comment positioned between the for statement and the parentheses
            // is going to be printed before the statement.
            const dangling = comments$3.printDanglingComments(path, options, 
            /* sameLine */ true);
            const printedComments = dangling ? concat$2([dangling, softline$1]) : "";
            if (!n.init && !n.test && !n.update) {
                return concat$2([printedComments, group$1(concat$2(["for (;;)", body]))]);
            }
            return concat$2([
                printedComments,
                group$1(concat$2([
                    "for (",
                    group$1(concat$2([
                        indent$2(concat$2([
                            softline$1,
                            path.call(print, "init"),
                            ";",
                            line$1,
                            path.call(print, "test"),
                            ";",
                            line$1,
                            path.call(print, "update")
                        ])),
                        softline$1
                    ])),
                    ")",
                    body
                ]))
            ]);
        }
        case "WhileStatement":
            return group$1(concat$2([
                "while (",
                group$1(concat$2([
                    indent$2(concat$2([softline$1, path.call(print, "test")])),
                    softline$1
                ])),
                ")",
                adjustClause(n.body, path.call(print, "body"))
            ]));
        case "ForInStatement":
            // Note: esprima can't actually parse "for each (".
            return group$1(concat$2([
                n.each ? "for each (" : "for (",
                path.call(print, "left"),
                " in ",
                path.call(print, "right"),
                ")",
                adjustClause(n.body, path.call(print, "body"))
            ]));
        case "ForOfStatement":
        case "ForAwaitStatement": {
            // Babylon 7 removed ForAwaitStatement in favor of ForOfStatement
            // with `"await": true`:
            // https://github.com/estree/estree/pull/138
            const isAwait = n.type === "ForAwaitStatement" || n.await;
            return group$1(concat$2([
                "for",
                isAwait ? " await" : "",
                " (",
                path.call(print, "left"),
                " of ",
                path.call(print, "right"),
                ")",
                adjustClause(n.body, path.call(print, "body"))
            ]));
        }
        case "DoWhileStatement": {
            const clause = adjustClause(n.body, path.call(print, "body"));
            const doBody = group$1(concat$2(["do", clause]));
            parts = [doBody];
            if (n.body.type === "BlockStatement") {
                parts.push(" ");
            }
            else {
                parts.push(hardline$2);
            }
            parts.push("while (");
            parts.push(group$1(concat$2([
                indent$2(concat$2([softline$1, path.call(print, "test")])),
                softline$1
            ])), ")", semi);
            return concat$2(parts);
        }
        case "DoExpression":
            return concat$2(["do ", path.call(print, "body")]);
        case "BreakStatement":
            parts.push("break");
            if (n.label) {
                parts.push(" ", path.call(print, "label"));
            }
            parts.push(semi);
            return concat$2(parts);
        case "ContinueStatement":
            parts.push("continue");
            if (n.label) {
                parts.push(" ", path.call(print, "label"));
            }
            parts.push(semi);
            return concat$2(parts);
        case "LabeledStatement":
            if (n.body.type === "EmptyStatement") {
                return concat$2([path.call(print, "label"), ":;"]);
            }
            return concat$2([
                path.call(print, "label"),
                ": ",
                path.call(print, "body")
            ]);
        case "TryStatement":
            return concat$2([
                "try ",
                path.call(print, "block"),
                n.handler ? concat$2([" ", path.call(print, "handler")]) : "",
                n.finalizer ? concat$2([" finally ", path.call(print, "finalizer")]) : ""
            ]);
        case "CatchClause":
            return concat$2([
                "catch (",
                path.call(print, "param"),
                ") ",
                path.call(print, "body")
            ]);
        case "ThrowStatement":
            return concat$2(["throw ", path.call(print, "argument"), semi]);
        // Note: ignoring n.lexical because it has no printing consequences.
        case "SwitchStatement":
            return concat$2([
                "switch (",
                path.call(print, "discriminant"),
                ") {",
                n.cases.length > 0
                    ? indent$2(concat$2([
                        hardline$2,
                        join$2(hardline$2, path.map(casePath => {
                            const caseNode = casePath.getValue();
                            return concat$2([
                                casePath.call(print),
                                n.cases.indexOf(caseNode) !== n.cases.length - 1 &&
                                    util$5.isNextLineEmpty(options.originalText, caseNode)
                                    ? hardline$2
                                    : ""
                            ]);
                        }, "cases"))
                    ]))
                    : "",
                hardline$2,
                "}"
            ]);
        case "SwitchCase": {
            if (n.test) {
                parts.push("case ", path.call(print, "test"), ":");
            }
            else {
                parts.push("default:");
            }
            const consequent = n.consequent.filter(node => node.type !== "EmptyStatement");
            if (consequent.length > 0) {
                const cons = path.call(consequentPath => {
                    return printStatementSequence(consequentPath, options, print);
                }, "consequent");
                parts.push(consequent.length === 1 && consequent[0].type === "BlockStatement"
                    ? concat$2([" ", cons])
                    : indent$2(concat$2([hardline$2, cons])));
            }
            return concat$2(parts);
        }
        // JSX extensions below.
        case "DebuggerStatement":
            return concat$2(["debugger", semi]);
        case "JSXAttribute":
            parts.push(path.call(print, "name"));
            if (n.value) {
                let res;
                if (isStringLiteral(n.value)) {
                    const value = rawText(n.value);
                    if (options.jsxSingleQuote) {
                        res = "'" + value.slice(1, -1).replace(/'/g, "&#39;") + "'";
                    }
                    else {
                        res = '"' + value.slice(1, -1).replace(/"/g, "&quot;") + '"';
                    }
                }
                else {
                    res = path.call(print, "value");
                }
                parts.push("=", res);
            }
            return concat$2(parts);
        case "JSXIdentifier":
            // Can be removed when this is fixed:
            // https://github.com/eslint/typescript-eslint-parser/issues/337
            if (!n.name) {
                return "this";
            }
            return "" + n.name;
        case "JSXNamespacedName":
            return join$2(":", [
                path.call(print, "namespace"),
                path.call(print, "name")
            ]);
        case "JSXMemberExpression":
            return join$2(".", [
                path.call(print, "object"),
                path.call(print, "property")
            ]);
        case "TSQualifiedName":
            return join$2(".", [path.call(print, "left"), path.call(print, "right")]);
        case "JSXSpreadAttribute":
            return concat$2(["{...", path.call(print, "argument"), "}"]);
        case "JSXExpressionContainer": {
            const parent = path.getParentNode(0);
            const shouldInline = n.expression.type === "ArrayExpression" ||
                n.expression.type === "ObjectExpression" ||
                n.expression.type === "ArrowFunctionExpression" ||
                n.expression.type === "CallExpression" ||
                n.expression.type === "FunctionExpression" ||
                n.expression.type === "JSXEmptyExpression" ||
                n.expression.type === "TemplateLiteral" ||
                n.expression.type === "TaggedTemplateExpression" ||
                (parent.type === "JSXElement" &&
                    (n.expression.type === "ConditionalExpression" ||
                        isBinaryish(n.expression)));
            if (shouldInline) {
                return group$1(concat$2(["{", path.call(print, "expression"), lineSuffixBoundary$1, "}"]));
            }
            return group$1(concat$2([
                "{",
                indent$2(concat$2([softline$1, path.call(print, "expression")])),
                softline$1,
                lineSuffixBoundary$1,
                "}"
            ]));
        }
        case "JSXElement": {
            const elem = comments$3.printComments(path, () => printJSXElement(path, options, print), options);
            return maybeWrapJSXElementInParens(path, elem);
        }
        case "JSXOpeningElement": {
            const n = path.getValue();
            // don't break up opening elements with a single long text attribute
            if (n.attributes.length === 1 &&
                n.attributes[0].value &&
                isStringLiteral(n.attributes[0].value)) {
                return group$1(concat$2([
                    "<",
                    path.call(print, "name"),
                    " ",
                    concat$2(path.map(print, "attributes")),
                    n.selfClosing ? " />" : ">"
                ]));
            }
            return group$1(concat$2([
                "<",
                path.call(print, "name"),
                concat$2([
                    indent$2(concat$2(path.map(attr => concat$2([line$1, print(attr)]), "attributes"))),
                    n.selfClosing ? line$1 : options.jsxBracketSameLine ? ">" : softline$1
                ]),
                n.selfClosing ? "/>" : options.jsxBracketSameLine ? "" : ">"
            ]));
        }
        case "JSXClosingElement":
            return concat$2(["</", path.call(print, "name"), ">"]);
        case "JSXText":
            /* istanbul ignore next */
            throw new Error("JSXTest should be handled by JSXElement");
        case "JSXEmptyExpression": {
            const requiresHardline = n.comments && !n.comments.every(util$5.isBlockComment);
            return concat$2([
                comments$3.printDanglingComments(path, options, 
                /* sameIndent */ !requiresHardline),
                requiresHardline ? hardline$2 : ""
            ]);
        }
        case "ClassBody":
            if (!n.comments && n.body.length === 0) {
                return "{}";
            }
            return concat$2([
                "{",
                n.body.length > 0
                    ? indent$2(concat$2([
                        hardline$2,
                        path.call(bodyPath => {
                            return printStatementSequence(bodyPath, options, print);
                        }, "body")
                    ]))
                    : comments$3.printDanglingComments(path, options),
                hardline$2,
                "}"
            ]);
        case "ClassProperty":
        case "TSAbstractClassProperty": {
            if (n.accessibility) {
                parts.push(n.accessibility + " ");
            }
            if (n.static) {
                parts.push("static ");
            }
            if (n.type === "TSAbstractClassProperty") {
                parts.push("abstract ");
            }
            if (n.readonly) {
                parts.push("readonly ");
            }
            const variance = getFlowVariance(n);
            if (variance) {
                parts.push(variance);
            }
            if (n.computed) {
                parts.push("[", path.call(print, "key"), "]");
            }
            else {
                parts.push(printPropertyKey(path, options, print));
            }
            if (n.typeAnnotation) {
                parts.push(": ", path.call(print, "typeAnnotation"));
            }
            if (n.value) {
                parts.push(" =", printAssignmentRight(n.value, path.call(print, "value"), false, // canBreak
                options));
            }
            parts.push(semi);
            return concat$2(parts);
        }
        case "ClassDeclaration":
        case "ClassExpression":
        case "TSAbstractClassDeclaration":
            if (isNodeStartingWithDeclare(n, options)) {
                parts.push("declare ");
            }
            parts.push(concat$2(printClass(path, options, print)));
            return concat$2(parts);
        case "TSInterfaceHeritage":
            parts.push(path.call(print, "id"));
            if (n.typeParameters) {
                parts.push(path.call(print, "typeParameters"));
            }
            return concat$2(parts);
        case "TemplateElement":
            return join$2(literalline$1, n.value.raw.split(/\r?\n/g));
        case "TemplateLiteral": {
            const expressions = path.map(print, "expressions");
            parts.push("`");
            path.each(childPath => {
                const i = childPath.getName();
                parts.push(print(childPath));
                if (i < expressions.length) {
                    // For a template literal of the following form:
                    //   `someQuery {
                    //     ${call({
                    //       a,
                    //       b,
                    //     })}
                    //   }`
                    // the expression is on its own line (there is a \n in the previous
                    // quasi literal), therefore we want to indent the JavaScript
                    // expression inside at the beginning of ${ instead of the beginning
                    // of the `.
                    let size = 0;
                    const value = childPath.getValue().value.raw;
                    const index = value.lastIndexOf("\n");
                    const tabWidth = options.tabWidth;
                    if (index !== -1) {
                        size = util$5.getAlignmentSize(
                        // All the leading whitespaces
                        value.slice(index + 1).match(/^[ \t]*/)[0], tabWidth);
                    }
                    const aligned = addAlignmentToDoc$1(expressions[i], size, tabWidth);
                    parts.push("${", aligned, lineSuffixBoundary$1, "}");
                }
            }, "quasis");
            parts.push("`");
            return concat$2(parts);
        }
        // These types are unprintable because they serve as abstract
        // supertypes for other (printable) types.
        case "TaggedTemplateExpression":
            return concat$2([path.call(print, "tag"), path.call(print, "quasi")]);
        case "Node":
        case "Printable":
        case "SourceLocation":
        case "Position":
        case "Statement":
        case "Function":
        case "Pattern":
        case "Expression":
        case "Declaration":
        case "Specifier":
        case "NamedSpecifier":
        case "Comment":
        case "MemberTypeAnnotation": // Flow
        case "Type":
            /* istanbul ignore next */
            throw new Error("unprintable type: " + JSON.stringify(n.type));
        // Type Annotations for Facebook Flow, typically stripped out or
        // transformed away before printing.
        case "TypeAnnotation":
            if (n.typeAnnotation) {
                return path.call(print, "typeAnnotation");
            }
            /* istanbul ignore next */
            return "";
        case "TSTupleType":
        case "TupleTypeAnnotation": {
            const typesField = n.type === "TSTupleType" ? "elementTypes" : "types";
            return group$1(concat$2([
                "[",
                indent$2(concat$2([
                    softline$1,
                    printArrayItems(path, options, typesField, print)
                ])),
                // TypeScript doesn't support trailing commas in tuple types
                n.type === "TSTupleType"
                    ? ""
                    : ifBreak$1(shouldPrintComma(options, "array") ? "," : ""),
                comments$3.printDanglingComments(path, options, /* sameIndent */ true),
                softline$1,
                "]"
            ]));
        }
        case "ExistsTypeAnnotation":
            return "*";
        case "EmptyTypeAnnotation":
            return "empty";
        case "AnyTypeAnnotation":
            return "any";
        case "MixedTypeAnnotation":
            return "mixed";
        case "ArrayTypeAnnotation":
            return concat$2([path.call(print, "elementType"), "[]"]);
        case "BooleanTypeAnnotation":
            return "boolean";
        case "BooleanLiteralTypeAnnotation":
            return "" + n.value;
        case "DeclareClass":
            return printFlowDeclaration(path, printClass(path, options, print));
        case "DeclareFunction":
            // For TypeScript the DeclareFunction node shares the AST
            // structure with FunctionDeclaration
            if (n.params) {
                return concat$2([
                    "declare ",
                    printFunctionDeclaration(path, print, options)
                ]);
            }
            return printFlowDeclaration(path, [
                "function ",
                path.call(print, "id"),
                n.predicate ? " " : "",
                path.call(print, "predicate"),
                semi
            ]);
        case "DeclareModule":
            return printFlowDeclaration(path, [
                "module ",
                path.call(print, "id"),
                " ",
                path.call(print, "body")
            ]);
        case "DeclareModuleExports":
            return printFlowDeclaration(path, [
                "module.exports",
                ": ",
                path.call(print, "typeAnnotation"),
                semi
            ]);
        case "DeclareVariable":
            return printFlowDeclaration(path, ["var ", path.call(print, "id"), semi]);
        case "DeclareExportAllDeclaration":
            return concat$2(["declare export * from ", path.call(print, "source")]);
        case "DeclareExportDeclaration":
            return concat$2(["declare ", printExportDeclaration(path, options, print)]);
        case "FunctionTypeAnnotation":
        case "TSFunctionType": {
            // FunctionTypeAnnotation is ambiguous:
            // declare function foo(a: B): void; OR
            // var A: (a: B) => void;
            const parent = path.getParentNode(0);
            const parentParent = path.getParentNode(1);
            const parentParentParent = path.getParentNode(2);
            let isArrowFunctionTypeAnnotation = n.type === "TSFunctionType" ||
                !((parent.type === "ObjectTypeProperty" &&
                    !getFlowVariance(parent) &&
                    !parent.optional &&
                    util$5.locStart(parent) === util$5.locStart(n)) ||
                    parent.type === "ObjectTypeCallProperty" ||
                    (parentParentParent && parentParentParent.type === "DeclareFunction"));
            let needsColon = isArrowFunctionTypeAnnotation && parent.type === "TypeAnnotation";
            // Sadly we can't put it inside of FastPath::needsColon because we are
            // printing ":" as part of the expression and it would put parenthesis
            // around :(
            const needsParens = needsColon &&
                isArrowFunctionTypeAnnotation &&
                parent.type === "TypeAnnotation" &&
                parentParent.type === "ArrowFunctionExpression";
            if (isObjectTypePropertyAFunction(parent)) {
                isArrowFunctionTypeAnnotation = true;
                needsColon = true;
            }
            if (needsParens) {
                parts.push("(");
            }
            parts.push(printFunctionParams(path, print, options, 
            /* expandArg */ false, 
            /* printTypeParams */ true));
            // The returnType is not wrapped in a TypeAnnotation, so the colon
            // needs to be added separately.
            if (n.returnType || n.predicate || n.typeAnnotation) {
                parts.push(isArrowFunctionTypeAnnotation ? " => " : ": ", path.call(print, "returnType"), path.call(print, "predicate"), path.call(print, "typeAnnotation"));
            }
            if (needsParens) {
                parts.push(")");
            }
            return group$1(concat$2(parts));
        }
        case "FunctionTypeParam":
            return concat$2([
                path.call(print, "name"),
                n.optional ? "?" : "",
                n.name ? ": " : "",
                path.call(print, "typeAnnotation")
            ]);
        case "GenericTypeAnnotation":
            return concat$2([
                path.call(print, "id"),
                path.call(print, "typeParameters")
            ]);
        case "DeclareInterface":
        case "InterfaceDeclaration": {
            if (n.type === "DeclareInterface" ||
                isNodeStartingWithDeclare(n, options)) {
                parts.push("declare ");
            }
            parts.push("interface ", path.call(print, "id"), path.call(print, "typeParameters"));
            if (n["extends"].length > 0) {
                parts.push(group$1(indent$2(concat$2([line$1, "extends ", join$2(", ", path.map(print, "extends"))]))));
            }
            parts.push(" ");
            parts.push(path.call(print, "body"));
            return group$1(concat$2(parts));
        }
        case "ClassImplements":
        case "InterfaceExtends":
            return concat$2([
                path.call(print, "id"),
                path.call(print, "typeParameters")
            ]);
        case "TSIntersectionType":
        case "IntersectionTypeAnnotation": {
            const types = path.map(print, "types");
            const result = [];
            for (let i = 0; i < types.length; ++i) {
                if (i === 0) {
                    result.push(types[i]);
                }
                else if (!isObjectType(n.types[i - 1]) && !isObjectType(n.types[i])) {
                    // If no object is involved, go to the next line if it breaks
                    result.push(indent$2(concat$2([" &", line$1, types[i]])));
                }
                else {
                    // If you go from object to non-object or vis-versa, then inline it
                    result.push(" & ", i > 1 ? indent$2(types[i]) : types[i]);
                }
            }
            return group$1(concat$2(result));
        }
        case "TSUnionType":
        case "UnionTypeAnnotation": {
            // single-line variation
            // A | B | C
            // multi-line variation
            // | A
            // | B
            // | C
            const parent = path.getParentNode();
            // If there's a leading comment, the parent is doing the indentation
            const shouldIndent = parent.type !== "TypeParameterInstantiation" &&
                parent.type !== "GenericTypeAnnotation" &&
                !((parent.type === "TypeAlias" ||
                    parent.type === "VariableDeclarator") &&
                    hasLeadingOwnLineComment(options.originalText, n));
            // {
            //   a: string
            // } | null | void
            // should be inlined and not be printed in the multi-line variant
            const shouldHug = shouldHugType(n);
            // We want to align the children but without its comment, so it looks like
            // | child1
            // // comment
            // | child2
            const printed = path.map(typePath => {
                let printedType = typePath.call(print);
                if (!shouldHug && shouldIndent) {
                    printedType = align$1(2, printedType);
                }
                return comments$3.printComments(typePath, () => printedType, options);
            }, "types");
            if (shouldHug) {
                return join$2(" | ", printed);
            }
            const code = concat$2([
                ifBreak$1(concat$2([shouldIndent ? line$1 : "", "| "])),
                join$2(concat$2([line$1, "| "]), printed)
            ]);
            return group$1(shouldIndent ? indent$2(code) : code);
        }
        case "NullableTypeAnnotation":
            return concat$2(["?", path.call(print, "typeAnnotation")]);
        case "TSNullKeyword":
        case "NullLiteralTypeAnnotation":
            return "null";
        case "ThisTypeAnnotation":
            return "this";
        case "NumberTypeAnnotation":
            return "number";
        case "ObjectTypeCallProperty":
            if (n.static) {
                parts.push("static ");
            }
            parts.push(path.call(print, "value"));
            return concat$2(parts);
        case "ObjectTypeIndexer": {
            const variance = getFlowVariance(n);
            return concat$2([
                variance || "",
                "[",
                path.call(print, "id"),
                n.id ? ": " : "",
                path.call(print, "key"),
                "]: ",
                path.call(print, "value")
            ]);
        }
        case "ObjectTypeProperty": {
            const variance = getFlowVariance(n);
            return concat$2([
                n.static ? "static " : "",
                isGetterOrSetter(n) ? n.kind + " " : "",
                variance || "",
                path.call(print, "key"),
                n.optional ? "?" : "",
                isFunctionNotation(n) ? "" : ": ",
                path.call(print, "value")
            ]);
        }
        case "QualifiedTypeIdentifier":
            return concat$2([
                path.call(print, "qualification"),
                ".",
                path.call(print, "id")
            ]);
        case "StringLiteralTypeAnnotation":
            return nodeStr(n, options);
        case "NumberLiteralTypeAnnotation":
            assert$1.strictEqual(typeof n.value, "number");
            if (n.extra != null) {
                return printNumber(n.extra.raw);
            }
            return printNumber(n.raw);
        case "StringTypeAnnotation":
            return "string";
        case "DeclareTypeAlias":
        case "TypeAlias": {
            if (n.type === "DeclareTypeAlias" ||
                isNodeStartingWithDeclare(n, options)) {
                parts.push("declare ");
            }
            const canBreak = n.right.type === "StringLiteralTypeAnnotation";
            const printed = printAssignmentRight(n.right, path.call(print, "right"), canBreak, options);
            parts.push("type ", path.call(print, "id"), path.call(print, "typeParameters"), " =", printed, semi);
            return group$1(concat$2(parts));
        }
        case "TypeCastExpression":
            return concat$2([
                "(",
                path.call(print, "expression"),
                ": ",
                path.call(print, "typeAnnotation"),
                ")"
            ]);
        case "TypeParameterDeclaration":
        case "TypeParameterInstantiation":
            return printTypeParameters(path, options, print, "params");
        case "TypeParameter": {
            const variance = getFlowVariance(n);
            if (variance) {
                parts.push(variance);
            }
            parts.push(path.call(print, "name"));
            if (n.bound) {
                parts.push(": ");
                parts.push(path.call(print, "bound"));
            }
            if (n.constraint) {
                parts.push(" extends ", path.call(print, "constraint"));
            }
            if (n["default"]) {
                parts.push(" = ", path.call(print, "default"));
            }
            return concat$2(parts);
        }
        case "TypeofTypeAnnotation":
            return concat$2(["typeof ", path.call(print, "argument")]);
        case "VoidTypeAnnotation":
            return "void";
        case "InferredPredicate":
            return "%checks";
        // Unhandled types below. If encountered, nodes of these types should
        // be either left alone or desugared into AST types that are fully
        // supported by the pretty-printer.
        case "DeclaredPredicate":
            return concat$2(["%checks(", path.call(print, "value"), ")"]);
        case "TSAbstractKeyword":
            return "abstract";
        case "TSAnyKeyword":
            return "any";
        case "TSAsyncKeyword":
            return "async";
        case "TSBooleanKeyword":
            return "boolean";
        case "TSConstKeyword":
            return "const";
        case "TSDeclareKeyword":
            return "declare";
        case "TSExportKeyword":
            return "export";
        case "TSNeverKeyword":
            return "never";
        case "TSNumberKeyword":
            return "number";
        case "TSObjectKeyword":
            return "object";
        case "TSProtectedKeyword":
            return "protected";
        case "TSPrivateKeyword":
            return "private";
        case "TSPublicKeyword":
            return "public";
        case "TSReadonlyKeyword":
            return "readonly";
        case "TSSymbolKeyword":
            return "symbol";
        case "TSStaticKeyword":
            return "static";
        case "TSStringKeyword":
            return "string";
        case "TSUndefinedKeyword":
            return "undefined";
        case "TSVoidKeyword":
            return "void";
        case "TSAsExpression":
            return concat$2([
                path.call(print, "expression"),
                " as ",
                path.call(print, "typeAnnotation")
            ]);
        case "TSArrayType":
            return concat$2([path.call(print, "elementType"), "[]"]);
        case "TSPropertySignature": {
            if (n.export) {
                parts.push("export ");
            }
            if (n.accessibility) {
                parts.push(n.accessibility + " ");
            }
            if (n.static) {
                parts.push("static ");
            }
            if (n.readonly) {
                parts.push("readonly ");
            }
            if (n.computed) {
                parts.push("[");
            }
            parts.push(path.call(print, "key"));
            if (n.computed) {
                parts.push("]");
            }
            if (n.optional) {
                parts.push("?");
            }
            if (n.typeAnnotation) {
                parts.push(": ");
                parts.push(path.call(print, "typeAnnotation"));
            }
            // This isn't valid semantically, but it's in the AST so we can print it.
            if (n.initializer) {
                parts.push(" = ", path.call(print, "initializer"));
            }
            return concat$2(parts);
        }
        case "TSParameterProperty":
            if (n.accessibility) {
                parts.push(n.accessibility + " ");
            }
            if (n.export) {
                parts.push("export ");
            }
            if (n.static) {
                parts.push("static ");
            }
            if (n.readonly) {
                parts.push("readonly ");
            }
            parts.push(path.call(print, "parameter"));
            return concat$2(parts);
        case "TSTypeReference":
            return concat$2([
                path.call(print, "typeName"),
                printTypeParameters(path, options, print, "typeParameters")
            ]);
        case "TSTypeQuery":
            return concat$2(["typeof ", path.call(print, "exprName")]);
        case "TSParenthesizedType": {
            return path.call(print, "typeAnnotation");
        }
        case "TSIndexSignature": {
            const parent = path.getParentNode();
            return concat$2([
                n.export ? "export " : "",
                n.accessibility ? concat$2([n.accessibility, " "]) : "",
                n.static ? "static " : "",
                n.readonly ? "readonly " : "",
                "[",
                path.call(print, "index"),
                "]: ",
                path.call(print, "typeAnnotation"),
                parent.type === "ClassBody" ? semi : ""
            ]);
        }
        case "TSTypePredicate":
            return concat$2([
                path.call(print, "parameterName"),
                " is ",
                path.call(print, "typeAnnotation")
            ]);
        case "TSNonNullExpression":
            return concat$2([path.call(print, "expression"), "!"]);
        case "TSThisType":
            return "this";
        case "TSLastTypeNode":
            return path.call(print, "literal");
        case "TSIndexedAccessType":
            return concat$2([
                path.call(print, "objectType"),
                "[",
                path.call(print, "indexType"),
                "]"
            ]);
        case "TSConstructSignature":
        case "TSConstructorType":
        case "TSCallSignature": {
            if (n.type !== "TSCallSignature") {
                parts.push("new ");
            }
            parts.push(group$1(printFunctionParams(path, print, options, 
            /* expandArg */ false, 
            /* printTypeParams */ true)));
            if (n.typeAnnotation) {
                const isType = n.type === "TSConstructorType";
                parts.push(isType ? " => " : ": ", path.call(print, "typeAnnotation"));
            }
            return concat$2(parts);
        }
        case "TSTypeOperator":
            return concat$2(["keyof ", path.call(print, "typeAnnotation")]);
        case "TSMappedType":
            return group$1(concat$2([
                "{",
                indent$2(concat$2([
                    options.bracesSpacing ? line$1 : softline$1,
                    n.readonlyToken
                        ? concat$2([path.call(print, "readonlyToken"), " "])
                        : "",
                    printTypeScriptModifiers(path, options, print),
                    "[",
                    path.call(print, "typeParameter"),
                    "]",
                    n.questionToken ? "?" : "",
                    ": ",
                    path.call(print, "typeAnnotation")
                ])),
                comments$3.printDanglingComments(path, options, /* sameIndent */ true),
                options.bracesSpacing ? line$1 : softline$1,
                "}"
            ]));
        case "TSTypeParameter":
            parts.push(path.call(print, "name"));
            if (n.constraint) {
                parts.push(" in ", path.call(print, "constraint"));
            }
            return concat$2(parts);
        case "TSMethodSignature":
            parts.push(n.accessibility ? concat$2([n.accessibility, " "]) : "", n.export ? "export " : "", n.static ? "static " : "", n.readonly ? "readonly " : "", n.computed ? "[" : "", path.call(print, "key"), n.computed ? "]" : "", n.optional ? "?" : "", printFunctionParams(path, print, options, 
            /* expandArg */ false, 
            /* printTypeParams */ true));
            if (n.typeAnnotation) {
                parts.push(": ", path.call(print, "typeAnnotation"));
            }
            return group$1(concat$2(parts));
        case "TSNamespaceExportDeclaration":
            parts.push("export as namespace ", path.call(print, "name"));
            if (options.semi) {
                parts.push(";");
            }
            return group$1(concat$2(parts));
        case "TSEnumDeclaration":
            if (n.modifiers) {
                parts.push(printTypeScriptModifiers(path, options, print));
            }
            parts.push("enum ", path.call(print, "name"), " ");
            if (n.members.length === 0) {
                parts.push(group$1(concat$2([
                    "{",
                    comments$3.printDanglingComments(path, options),
                    softline$1,
                    "}"
                ])));
            }
            else {
                parts.push(group$1(concat$2([
                    "{",
                    indent$2(concat$2([
                        hardline$2,
                        printArrayItems(path, options, "members", print),
                        shouldPrintComma(options, "object") ? "," : ""
                    ])),
                    comments$3.printDanglingComments(path, options, 
                    /* sameIndent */ true),
                    hardline$2,
                    "}"
                ])));
            }
            return concat$2(parts);
        case "TSEnumMember":
            parts.push(path.call(print, "name"));
            if (n.initializer) {
                parts.push(" = ", path.call(print, "initializer"));
            }
            return concat$2(parts);
        case "TSImportEqualsDeclaration":
            parts.push(printTypeScriptModifiers(path, options, print), "import ", path.call(print, "name"), " = ", path.call(print, "moduleReference"));
            if (options.semi) {
                parts.push(";");
            }
            return group$1(concat$2(parts));
        case "TSExternalModuleReference":
            return concat$2(["require(", path.call(print, "expression"), ")"]);
        case "TSModuleDeclaration": {
            const parent = path.getParentNode();
            const isExternalModule = isLiteral(n.name);
            const parentIsDeclaration = parent.type === "TSModuleDeclaration";
            const bodyIsDeclaration = n.body && n.body.type === "TSModuleDeclaration";
            if (parentIsDeclaration) {
                parts.push(".");
            }
            else {
                parts.push(printTypeScriptModifiers(path, options, print));
                // Global declaration looks like this:
                // (declare)? global { ... }
                const isGlobalDeclaration = n.name.type === "Identifier" &&
                    n.name.name === "global" &&
                    !/namespace|module/.test(options.originalText.slice(util$5.locStart(n), util$5.locStart(n.name)));
                if (!isGlobalDeclaration) {
                    parts.push(isExternalModule ? "module " : "namespace ");
                }
            }
            parts.push(path.call(print, "name"));
            if (bodyIsDeclaration) {
                parts.push(path.call(print, "body"));
            }
            else if (n.body) {
                parts.push(" {", indent$2(concat$2([
                    line$1,
                    path.call(bodyPath => comments$3.printDanglingComments(bodyPath, options, true), "body"),
                    group$1(path.call(print, "body"))
                ])), line$1, "}");
            }
            else {
                parts.push(semi);
            }
            return concat$2(parts);
        }
        case "TSModuleBlock":
            return path.call(bodyPath => {
                return printStatementSequence(bodyPath, options, print);
            }, "body");
        case "json-identifier":
            return '"' + n.value + '"';
        default:
            /* istanbul ignore next */
            throw new Error("unknown type: " + JSON.stringify(n.type));
    }
}
function printStatementSequence(path, options, print) {
    const printed = [];
    const bodyNode = path.getNode();
    const isClass = bodyNode.type === "ClassBody";
    path.map((stmtPath, i) => {
        const stmt = stmtPath.getValue();
        // Just in case the AST has been modified to contain falsy
        // "statements," it's safer simply to skip them.
        /* istanbul ignore if */
        if (!stmt) {
            return;
        }
        // Skip printing EmptyStatement nodes to avoid leaving stray
        // semicolons lying around.
        if (stmt.type === "EmptyStatement") {
            return;
        }
        const stmtPrinted = print(stmtPath);
        const text = options.originalText;
        const parts = [];
        // in no-semi mode, prepend statement with semicolon if it might break ASI
        if (!options.semi &&
            !isClass &&
            stmtNeedsASIProtection(stmtPath, options)) {
            if (stmt.comments && stmt.comments.some(comment => comment.leading)) {
                // Note: stmtNeedsASIProtection requires stmtPath to already be printed
                // as it reads needsParens which is mutated on the instance
                parts.push(print(stmtPath, { needsSemi: true }));
            }
            else {
                parts.push(";", stmtPrinted);
            }
        }
        else {
            parts.push(stmtPrinted);
        }
        if (!options.semi && isClass) {
            if (classPropMayCauseASIProblems(stmtPath)) {
                parts.push(";");
            }
            else if (stmt.type === "ClassProperty") {
                const nextChild = bodyNode.body[i + 1];
                if (classChildNeedsASIProtection(nextChild)) {
                    parts.push(";");
                }
            }
        }
        if (util$5.isNextLineEmpty(text, stmt) && !isLastStatement(stmtPath)) {
            parts.push(hardline$2);
        }
        printed.push(concat$2(parts));
    });
    return join$2(hardline$2, printed);
}
function printPropertyKey(path, options, print) {
    const node = path.getNode();
    const key = node.key;
    if (isStringLiteral(key) && isIdentifierName(key.value) && !node.computed) {
        // 'a' -> a
        return path.call(keyPath => comments$3.printComments(keyPath, () => key.value, options), "key");
    }
    return path.call(print, "key");
}
function printMethod(path, options, print) {
    const node = path.getNode();
    const semi = options.semi ? ";" : "";
    const kind = node.kind;
    const parts = [];
    if (node.type === "ObjectMethod" || node.type === "ClassMethod") {
        node.value = node;
    }
    if (node.value.async) {
        parts.push("async ");
    }
    if (!kind || kind === "init" || kind === "method" || kind === "constructor") {
        if (node.value.generator) {
            parts.push("*");
        }
    }
    else {
        assert$1.ok(kind === "get" || kind === "set");
        parts.push(kind, " ");
    }
    let key = printPropertyKey(path, options, print);
    if (node.computed) {
        key = concat$2(["[", key, "]"]);
    }
    parts.push(key, concat$2(path.call(valuePath => [
        printFunctionTypeParameters(valuePath, options, print),
        group$1(concat$2([
            options.spaceBeforeFunctionParen ? " " : "",
            printFunctionParams(valuePath, print, options),
            printReturnType(valuePath, print)
        ]))
    ], "value")));
    if (!node.value.body || node.value.body.length === 0) {
        parts.push(semi);
    }
    else {
        parts.push(" ", path.call(print, "value", "body"));
    }
    return concat$2(parts);
}
function couldGroupArg(arg) {
    return ((arg.type === "ObjectExpression" && arg.properties.length > 0) ||
        (arg.type === "ArrayExpression" && arg.elements.length > 0) ||
        arg.type === "TSTypeAssertionExpression" ||
        arg.type === "TSAsExpression" ||
        arg.type === "FunctionExpression" ||
        (arg.type === "ArrowFunctionExpression" &&
            (arg.body.type === "BlockStatement" ||
                arg.body.type === "ArrowFunctionExpression" ||
                arg.body.type === "ObjectExpression" ||
                arg.body.type === "ArrayExpression" ||
                arg.body.type === "CallExpression" ||
                arg.body.type === "JSXElement")));
}
function shouldGroupLastArg(args) {
    const lastArg = util$5.getLast(args);
    const penultimateArg = util$5.getPenultimate(args);
    return ((!lastArg.comments || !lastArg.comments.length) &&
        couldGroupArg(lastArg) &&
        // If the last two arguments are of the same type,
        // disable last element expansion.
        (!penultimateArg || penultimateArg.type !== lastArg.type));
}
function shouldGroupFirstArg(args) {
    if (args.length !== 2) {
        return false;
    }
    const firstArg = args[0];
    const secondArg = args[1];
    return ((!firstArg.comments || !firstArg.comments.length) &&
        (firstArg.type === "FunctionExpression" ||
            (firstArg.type === "ArrowFunctionExpression" &&
                firstArg.body.type === "BlockStatement")) &&
        !couldGroupArg(secondArg));
}
function printArgumentsList(path, options, print) {
    const printed = path.map(print, "arguments");
    if (printed.length === 0) {
        return concat$2([
            "(",
            comments$3.printDanglingComments(path, options, /* sameIndent */ true),
            ")"
        ]);
    }
    const args = path.getValue().arguments;
    // This is just an optimization; I think we could return the
    // conditional group for all function calls, but it's more expensive
    // so only do it for specific forms.
    const shouldGroupFirst = shouldGroupFirstArg(args);
    const shouldGroupLast = shouldGroupLastArg(args);
    if (shouldGroupFirst || shouldGroupLast) {
        const shouldBreak = shouldGroupFirst
            ? printed.slice(1).some(willBreak)
            : printed.slice(0, -1).some(willBreak);
        // We want to print the last argument with a special flag
        let printedExpanded;
        let i = 0;
        path.each(argPath => {
            if (shouldGroupFirst && i === 0) {
                printedExpanded = [
                    argPath.call(p => print(p, { expandFirstArg: true }))
                ].concat(printed.slice(1));
            }
            if (shouldGroupLast && i === args.length - 1) {
                printedExpanded = printed
                    .slice(0, -1)
                    .concat(argPath.call(p => print(p, { expandLastArg: true })));
            }
            i++;
        }, "arguments");
        return concat$2([
            printed.some(willBreak) ? breakParent$2 : "",
            conditionalGroup$1([
                concat$2(["(", join$2(concat$2([", "]), printedExpanded), ")"]),
                shouldGroupFirst
                    ? concat$2([
                        "(",
                        group$1(printedExpanded[0], { shouldBreak: true }),
                        printed.length > 1 ? ", " : "",
                        join$2(concat$2([",", line$1]), printed.slice(1)),
                        ")"
                    ])
                    : concat$2([
                        "(",
                        join$2(concat$2([",", line$1]), printed.slice(0, -1)),
                        printed.length > 1 ? ", " : "",
                        group$1(util$5.getLast(printedExpanded), {
                            shouldBreak: true
                        }),
                        ")"
                    ]),
                group$1(concat$2([
                    "(",
                    indent$2(concat$2([line$1, join$2(concat$2([",", line$1]), printed)])),
                    shouldPrintComma(options, "arguments") ? "," : "",
                    line$1,
                    ")"
                ]), { shouldBreak: true })
            ], { shouldBreak })
        ]);
    }
    return group$1(concat$2([
        "(",
        indent$2(concat$2([softline$1, join$2(concat$2([",", line$1]), printed)])),
        ifBreak$1(shouldPrintComma(options, "arguments") ? "," : ""),
        softline$1,
        ")"
    ]), { shouldBreak: printed.some(willBreak) });
}
function printFunctionTypeParameters(path, options, print) {
    const fun = path.getValue();
    if (fun.typeParameters) {
        return path.call(print, "typeParameters");
    }
    return "";
}
function printFunctionParams(path, print, options, expandArg, printTypeParams) {
    const fun = path.getValue();
    const paramsField = fun.parameters ? "parameters" : "params";
    const typeParams = printTypeParams
        ? printFunctionTypeParameters(path, options, print)
        : "";
    let printed = [];
    if (fun[paramsField]) {
        printed = path.map(print, paramsField);
    }
    if (fun.rest) {
        printed.push(concat$2(["...", path.call(print, "rest")]));
    }
    if (printed.length === 0) {
        return concat$2([
            typeParams,
            "(",
            comments$3.printDanglingComments(path, options, /* sameIndent */ true),
            ")"
        ]);
    }
    const lastParam = util$5.getLast(fun[paramsField]);
    // If the parent is a call with the first/last argument expansion and this is the
    // params of the first/last argument, we dont want the arguments to break and instead
    // want the whole expression to be on a new line.
    //
    // Good:                 Bad:
    //   verylongcall(         verylongcall((
    //     (a, b) => {           a,
    //     }                     b,
    //   })                    ) => {
    //                         })
    if (expandArg &&
        !(fun[paramsField] && fun[paramsField].some(n => n.comments))) {
        return group$1(concat$2([
            docUtils.removeLines(typeParams),
            "(",
            join$2(", ", printed.map(docUtils.removeLines)),
            ")"
        ]));
    }
    // Single object destructuring should hug
    //
    // function({
    //   a,
    //   b,
    //   c
    // }) {}
    if (shouldHugArguments(fun)) {
        return concat$2([typeParams, "(", join$2(", ", printed), ")"]);
    }
    const parent = path.getParentNode();
    const flowTypeAnnotations = [
        "AnyTypeAnnotation",
        "NullLiteralTypeAnnotation",
        "GenericTypeAnnotation",
        "ThisTypeAnnotation",
        "NumberTypeAnnotation",
        "VoidTypeAnnotation",
        "EmptyTypeAnnotation",
        "MixedTypeAnnotation",
        "BooleanTypeAnnotation",
        "BooleanLiteralTypeAnnotation",
        "StringTypeAnnotation"
    ];
    const isFlowShorthandWithOneArg = (isObjectTypePropertyAFunction(parent) ||
        isTypeAnnotationAFunction(parent) ||
        parent.type === "TypeAlias" ||
        parent.type === "UnionTypeAnnotation" ||
        parent.type === "TSUnionType" ||
        parent.type === "IntersectionTypeAnnotation" ||
        (parent.type === "FunctionTypeAnnotation" &&
            parent.returnType === fun)) &&
        fun[paramsField].length === 1 &&
        fun[paramsField][0].name === null &&
        fun[paramsField][0].typeAnnotation &&
        fun.typeParameters === null &&
        flowTypeAnnotations.indexOf(fun[paramsField][0].typeAnnotation.type) !==
            -1 &&
        !(fun[paramsField][0].typeAnnotation.type === "GenericTypeAnnotation" &&
            fun[paramsField][0].typeAnnotation.typeParameters) &&
        !fun.rest;
    if (isFlowShorthandWithOneArg) {
        return concat$2(printed);
    }
    const canHaveTrailingComma = !(lastParam && lastParam.type === "RestElement") && !fun.rest;
    return concat$2([
        typeParams,
        "(",
        indent$2(concat$2([softline$1, join$2(concat$2([",", line$1]), printed)])),
        ifBreak$1(canHaveTrailingComma && shouldPrintComma(options, "arguments") ? "," : ""),
        softline$1,
        ")"
    ]);
}
function canPrintParamsWithoutParens(node, options) {
    return (node.params.length === 1 &&
        !node.rest &&
        !node.typeParameters &&
        node.params[0].type === "Identifier" &&
        !node.params[0].typeAnnotation &&
        !node.params[0].comments &&
        !node.params[0].optional &&
        !node.predicate &&
        !node.returnType &&
        !options.arrowParens);
}
function printFunctionDeclaration(path, print, options) {
    const n = path.getValue();
    const parts = [];
    if (n.async) {
        parts.push("async ");
    }
    parts.push("function");
    if (n.generator) {
        parts.push("*");
    }
    if (n.id) {
        parts.push(" ", path.call(print, "id"));
    }
    parts.push(printFunctionTypeParameters(path, options, print), group$1(concat$2([
        options.spaceBeforeFunctionParen ? " " : "",
        printFunctionParams(path, print, options),
        printReturnType(path, print)
    ])), options.noSpaceEmptyFn ? "" : n.body ? " " : "", 
    //options.noSpaceEmptyFn ? "" : " ",
    path.call(print, "body"));
    return concat$2(parts);
}
function printObjectMethod(path, options, print) {
    const objMethod = path.getValue();
    const parts = [];
    if (objMethod.async) {
        parts.push("async ");
    }
    if (objMethod.generator) {
        parts.push("*");
    }
    if (objMethod.method ||
        objMethod.kind === "get" ||
        objMethod.kind === "set") {
        return printMethod(path, options, print);
    }
    const key = printPropertyKey(path, options, print);
    if (objMethod.computed) {
        parts.push("[", key, "]");
    }
    else {
        parts.push(key);
    }
    parts.push(printFunctionTypeParameters(path, options, print), group$1(concat$2([
        options.spaceBeforeFunctionParen ? " " : "",
        printFunctionParams(path, print, options),
        printReturnType(path, print)
    ])), " ", path.call(print, "body"));
    return concat$2(parts);
}
function printReturnType(path, print) {
    const n = path.getValue();
    const parts = [path.call(print, "returnType")];
    // prepend colon to TypeScript type annotation
    if (n.returnType && n.returnType.typeAnnotation) {
        parts.unshift(": ");
    }
    if (n.predicate) {
        // The return type will already add the colon, but otherwise we
        // need to do it ourselves
        parts.push(n.returnType ? " " : ": ", path.call(print, "predicate"));
    }
    return concat$2(parts);
}
function printExportDeclaration(path, options, print) {
    const decl = path.getValue();
    const semi = options.semi ? ";" : "";
    const parts = ["export "];
    if (decl["default"] || decl.type === "ExportDefaultDeclaration") {
        parts.push("default ");
    }
    parts.push(comments$3.printDanglingComments(path, options, /* sameIndent */ true));
    if (decl.declaration) {
        parts.push(path.call(print, "declaration"));
        if (decl.type === "ExportDefaultDeclaration" &&
            (decl.declaration.type !== "ClassDeclaration" &&
                decl.declaration.type !== "FunctionDeclaration" &&
                decl.declaration.type !== "TSAbstractClassDeclaration" &&
                decl.declaration.type !== "TSNamespaceFunctionDeclaration")) {
            parts.push(semi);
        }
    }
    else {
        if (decl.specifiers && decl.specifiers.length > 0) {
            const specifiers = [];
            const defaultSpecifiers = [];
            const namespaceSpecifiers = [];
            path.each(specifierPath => {
                const specifierType = path.getValue().type;
                if (specifierType === "ExportSpecifier") {
                    specifiers.push(print(specifierPath));
                }
                else if (specifierType === "ExportDefaultSpecifier") {
                    defaultSpecifiers.push(print(specifierPath));
                }
                else if (specifierType === "ExportNamespaceSpecifier") {
                    namespaceSpecifiers.push(concat$2(["* as ", print(specifierPath)]));
                }
            }, "specifiers");
            const isNamespaceFollowed = namespaceSpecifiers.length !== 0 &&
                (specifiers.length !== 0 || defaultSpecifiers.length !== 0);
            const isDefaultFollowed = defaultSpecifiers.length !== 0 && specifiers.length !== 0;
            parts.push(decl.exportKind === "type" ? "type " : "", concat$2(namespaceSpecifiers), concat$2([isNamespaceFollowed ? ", " : ""]), concat$2(defaultSpecifiers), concat$2([isDefaultFollowed ? ", " : ""]), specifiers.length !== 0
                ? group$1(concat$2([
                    "{",
                    indent$2(concat$2([
                        options.bracesSpacing ? line$1 : softline$1,
                        join$2(concat$2([",", line$1]), specifiers)
                    ])),
                    ifBreak$1(shouldPrintComma(options, "export") ? "," : ""),
                    options.bracesSpacing ? line$1 : softline$1,
                    "}"
                ]))
                : "");
        }
        else {
            parts.push("{}");
        }
        if (decl.source) {
            parts.push(" from ", path.call(print, "source"));
        }
        parts.push(semi);
    }
    return concat$2(parts);
}
function printFlowDeclaration(path, parts) {
    const parentExportDecl = util$5.getParentExportDeclaration(path);
    if (parentExportDecl) {
        assert$1.strictEqual(parentExportDecl.type, "DeclareExportDeclaration");
    }
    else {
        // If the parent node has type DeclareExportDeclaration, then it
        // will be responsible for printing the "declare" token. Otherwise
        // it needs to be printed with this non-exported declaration node.
        parts.unshift("declare ");
    }
    return concat$2(parts);
}
function getFlowVariance(path) {
    if (!path.variance) {
        return null;
    }
    // Babylon 7.0 currently uses variance node type, and flow should
    // follow suit soon:
    // https://github.com/babel/babel/issues/4722
    const variance = path.variance.kind || path.variance;
    switch (variance) {
        case "plus":
            return "+";
        case "minus":
            return "-";
        default:
            /* istanbul ignore next */
            return variance;
    }
}
function printTypeScriptModifiers(path, options, print) {
    const n = path.getValue();
    if (!n.modifiers || !n.modifiers.length) {
        return "";
    }
    return concat$2([join$2(" ", path.map(print, "modifiers")), " "]);
}
function printTypeParameters(path, options, print, paramsKey) {
    const n = path.getValue();
    if (!n[paramsKey]) {
        return "";
    }
    // for TypeParameterDeclaration typeParameters is a single node
    if (!Array.isArray(n[paramsKey])) {
        return path.call(print, paramsKey);
    }
    const shouldInline = n[paramsKey].length === 1 &&
        (shouldHugType(n[paramsKey][0]) ||
            (n[paramsKey][0].type === "GenericTypeAnnotation" &&
                shouldHugType(n[paramsKey][0].id)) ||
            n[paramsKey][0].type === "NullableTypeAnnotation");
    if (shouldInline) {
        return concat$2(["<", join$2(", ", path.map(print, paramsKey)), ">"]);
    }
    return group$1(concat$2([
        "<",
        indent$2(concat$2([
            softline$1,
            join$2(concat$2([",", line$1]), path.map(print, paramsKey))
        ])),
        ifBreak$1(options.parser !== "typescript" &&
            shouldPrintComma(options, "arguments")
            ? ","
            : ""),
        softline$1,
        ">"
    ]));
}
function printClass(path, options, print) {
    const n = path.getValue();
    const parts = [];
    if (n.type === "TSAbstractClassDeclaration") {
        parts.push("abstract ");
    }
    parts.push("class");
    if (n.id) {
        parts.push(" ", path.call(print, "id"));
    }
    parts.push(path.call(print, "typeParameters"));
    const partsGroup = [];
    if (n.superClass) {
        parts.push(" extends ", path.call(print, "superClass"), path.call(print, "superTypeParameters"));
    }
    else if (n.extends && n.extends.length > 0) {
        parts.push(" extends ", join$2(", ", path.map(print, "extends")));
    }
    if (n["implements"] && n["implements"].length > 0) {
        partsGroup.push(line$1, "implements ", group$1(indent$2(join$2(concat$2([",", line$1]), path.map(print, "implements")))));
    }
    if (partsGroup.length > 0) {
        parts.push(group$1(indent$2(concat$2(partsGroup))));
    }
    parts.push(" ", path.call(print, "body"));
    return parts;
}
function printMemberLookup(path, options, print) {
    const property = path.call(print, "property");
    const n = path.getValue();
    if (!n.computed) {
        return concat$2([".", property]);
    }
    if (!n.property ||
        (n.property.type === "Literal" && typeof n.property.value === "number") ||
        n.property.type === "NumericLiteral") {
        return concat$2(["[", property, "]"]);
    }
    return group$1(concat$2(["[", indent$2(concat$2([softline$1, property])), softline$1, "]"]));
}
function printBindExpressionCallee(path, options, print) {
    return concat$2(["::", path.call(print, "callee")]);
}
// We detect calls on member expressions specially to format a
// common pattern better. The pattern we are looking for is this:
//
// arr
//   .map(x => x + 1)
//   .filter(x => x > 10)
//   .some(x => x % 2)
//
// The way it is structured in the AST is via a nested sequence of
// MemberExpression and CallExpression. We need to traverse the AST
// and make groups out of it to print it in the desired way.
function printMemberChain(path, options, print) {
    // The first phase is to linearize the AST by traversing it down.
    //
    //   a().b()
    // has the following AST structure:
    //   CallExpression(MemberExpression(CallExpression(Identifier)))
    // and we transform it into
    //   [Identifier, CallExpression, MemberExpression, CallExpression]
    const printedNodes = [];
    function rec(path) {
        const node = path.getValue();
        if (node.type === "CallExpression" && isMemberish(node.callee)) {
            printedNodes.unshift({
                node: node,
                printed: comments$3.printComments(path, () => concat$2([
                    printFunctionTypeParameters(path, options, print),
                    printArgumentsList(path, options, print)
                ]), options)
            });
            path.call(callee => rec(callee), "callee");
        }
        else if (isMemberish(node)) {
            printedNodes.unshift({
                node: node,
                printed: comments$3.printComments(path, () => node.type === "MemberExpression"
                    ? printMemberLookup(path, options, print)
                    : printBindExpressionCallee(path, options, print), options)
            });
            path.call(object => rec(object), "object");
        }
        else {
            printedNodes.unshift({
                node: node,
                printed: path.call(print)
            });
        }
    }
    // Note: the comments of the root node have already been printed, so we
    // need to extract this first call without printing them as they would
    // if handled inside of the recursive call.
    printedNodes.unshift({
        node: path.getValue(),
        printed: concat$2([
            printFunctionTypeParameters(path, options, print),
            printArgumentsList(path, options, print)
        ])
    });
    path.call(callee => rec(callee), "callee");
    // Once we have a linear list of printed nodes, we want to create groups out
    // of it.
    //
    //   a().b.c().d().e
    // will be grouped as
    //   [
    //     [Identifier, CallExpression],
    //     [MemberExpression, MemberExpression, CallExpression],
    //     [MemberExpression, CallExpression],
    //     [MemberExpression],
    //   ]
    // so that we can print it as
    //   a()
    //     .b.c()
    //     .d()
    //     .e
    // The first group is the first node followed by
    //   - as many CallExpression as possible
    //       < fn()()() >.something()
    //   - then, as many MemberExpression as possible but the last one
    //       < this.items >.something()
    const groups = [];
    let currentGroup = [printedNodes[0]];
    let i = 1;
    for (; i < printedNodes.length; ++i) {
        if (printedNodes[i].node.type === "CallExpression") {
            currentGroup.push(printedNodes[i]);
        }
        else {
            break;
        }
    }
    for (; i + 1 < printedNodes.length; ++i) {
        if (isMemberish(printedNodes[i].node) &&
            isMemberish(printedNodes[i + 1].node)) {
            currentGroup.push(printedNodes[i]);
        }
        else {
            break;
        }
    }
    groups.push(currentGroup);
    currentGroup = [];
    // Then, each following group is a sequence of MemberExpression followed by
    // a sequence of CallExpression. To compute it, we keep adding things to the
    // group until we has seen a CallExpression in the past and reach a
    // MemberExpression
    let hasSeenCallExpression = false;
    for (; i < printedNodes.length; ++i) {
        if (hasSeenCallExpression && isMemberish(printedNodes[i].node)) {
            // [0] should be appended at the end of the group instead of the
            // beginning of the next one
            if (printedNodes[i].node.computed &&
                isLiteral(printedNodes[i].node.property)) {
                currentGroup.push(printedNodes[i]);
                continue;
            }
            groups.push(currentGroup);
            currentGroup = [];
            hasSeenCallExpression = false;
        }
        if (printedNodes[i].node.type === "CallExpression") {
            hasSeenCallExpression = true;
        }
        currentGroup.push(printedNodes[i]);
        if (printedNodes[i].node.comments &&
            printedNodes[i].node.comments.some(comment => comment.trailing)) {
            groups.push(currentGroup);
            currentGroup = [];
            hasSeenCallExpression = false;
        }
    }
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    // There are cases like Object.keys(), Observable.of(), _.values() where
    // they are the subject of all the chained calls and therefore should
    // be kept on the same line:
    //
    //   Object.keys(items)
    //     .filter(x => x)
    //     .map(x => x)
    //
    // In order to detect those cases, we use an heuristic: if the first
    // node is just an identifier with the name starting with a capital
    // letter, just a sequence of _$ or this. The rationale is that they are
    // likely to be factories.
    const shouldMerge = groups.length >= 2 &&
        !groups[1][0].node.comments &&
        groups[0].length === 1 &&
        (groups[0][0].node.type === "ThisExpression" ||
            (groups[0][0].node.type === "Identifier" &&
                groups[0][0].node.name.match(/(^[A-Z])|^[_$]+$/)));
    function printGroup(printedGroup) {
        return concat$2(printedGroup.map(tuple => tuple.printed));
    }
    function printIndentedGroup(groups) {
        if (groups.length === 0) {
            return "";
        }
        return indent$2(group$1(concat$2([hardline$2, join$2(hardline$2, groups.map(printGroup))])));
    }
    const printedGroups = groups.map(printGroup);
    const oneLine = concat$2(printedGroups);
    const cutoff = shouldMerge ? 3 : 2;
    const flatGroups = groups
        .slice(0, cutoff)
        .reduce((res, group) => res.concat(group), []);
    const hasComment = flatGroups.slice(1, -1).some(node => hasLeadingComment(node.node)) ||
        flatGroups.slice(0, -1).some(node => hasTrailingComment(node.node)) ||
        (groups[cutoff] && hasLeadingComment(groups[cutoff][0].node));
    // If we only have a single `.`, we shouldn't do anything fancy and just
    // render everything concatenated together.
    if (groups.length <= cutoff &&
        !hasComment &&
        // (a || b).map() should be break before .map() instead of ||
        groups[0][0].node.type !== "LogicalExpression") {
        return group$1(oneLine);
    }
    const expanded = concat$2([
        printGroup(groups[0]),
        shouldMerge ? concat$2(groups.slice(1, 2).map(printGroup)) : "",
        printIndentedGroup(groups.slice(shouldMerge ? 2 : 1))
    ]);
    // If there's a comment, we don't want to print in one line.
    if (hasComment) {
        return group$1(expanded);
    }
    // If any group but the last one has a hard line, we want to force expand
    // it. If the last group is a function it's okay to inline if it fits.
    if (printedGroups.slice(0, -1).some(willBreak)) {
        return group$1(expanded);
    }
    return concat$2([
        // We only need to check `oneLine` because if `expanded` is chosen
        // that means that the parent group has already been broken
        // naturally
        willBreak(oneLine) ? breakParent$2 : "",
        conditionalGroup$1([oneLine, expanded])
    ]);
}
function isEmptyJSXElement(node) {
    if (node.children.length === 0) {
        return true;
    }
    if (node.children.length > 1) {
        return false;
    }
    // if there is one text child and does not contain any meaningful text
    // we can treat the element as empty.
    const child = node.children[0];
    return isLiteral(child) && !isMeaningfulJSXText(child);
}
// Only space, newline, carriage return, and tab are treated as whitespace
// inside JSX.
const jsxWhitespaceChars = " \n\r\t";
const containsNonJsxWhitespaceRegex = new RegExp("[^" + jsxWhitespaceChars + "]");
const matchJsxWhitespaceRegex = new RegExp("([" + jsxWhitespaceChars + "]+)");
// Meaningful if it contains non-whitespace characters,
// or it contains whitespace without a new line.
function isMeaningfulJSXText(node) {
    return (isLiteral(node) &&
        (containsNonJsxWhitespaceRegex.test(rawText(node)) ||
            !/\n/.test(rawText(node))));
}
function conditionalExpressionChainContainsJSX(node) {
    return Boolean(getConditionalChainContents(node).find(child => child.type === "JSXElement"));
}
// If we have nested conditional expressions, we want to print them in JSX mode
// if there's at least one JSXElement somewhere in the tree.
//
// A conditional expression chain like this should be printed in normal mode,
// because there aren't JSXElements anywhere in it:
//
// isA ? "A" : isB ? "B" : isC ? "C" : "Unknown";
//
// But a conditional expression chain like this should be printed in JSX mode,
// because there is a JSXElement in the last ConditionalExpression:
//
// isA ? "A" : isB ? "B" : isC ? "C" : <span className="warning">Unknown</span>;
//
// This type of ConditionalExpression chain is structured like this in the AST:
//
// ConditionalExpression {
//   test: ...,
//   consequent: ...,
//   alternate: ConditionalExpression {
//     test: ...,
//     consequent: ...,
//     alternate: ConditionalExpression {
//       test: ...,
//       consequent: ...,
//       alternate: ...,
//     }
//   }
// }
//
// We want to traverse over that shape and convert it into a flat structure so
// that we can find if there's a JSXElement somewhere inside.
function getConditionalChainContents(node) {
    // Given this code:
    //
    // // Using a ConditionalExpression as the consequent is uncommon, but should
    // // be handled.
    // A ? B : C ? D : E ? F ? G : H : I
    //
    // which has this AST:
    //
    // ConditionalExpression {
    //   test: Identifier(A),
    //   consequent: Identifier(B),
    //   alternate: ConditionalExpression {
    //     test: Identifier(C),
    //     consequent: Identifier(D),
    //     alternate: ConditionalExpression {
    //       test: Identifier(E),
    //       consequent: ConditionalExpression {
    //         test: Identifier(F),
    //         consequent: Identifier(G),
    //         alternate: Identifier(H),
    //       },
    //       alternate: Identifier(I),
    //     }
    //   }
    // }
    //
    // we should return this Array:
    //
    // [
    //   Identifier(A),
    //   Identifier(B),
    //   Identifier(C),
    //   Identifier(D),
    //   Identifier(E),
    //   Identifier(F),
    //   Identifier(G),
    //   Identifier(H),
    //   Identifier(I)
    // ];
    //
    // This loses the information about whether each node was the test,
    // consequent, or alternate, but we don't care about that here- we are only
    // flattening this structure to find if there's any JSXElements inside.
    const nonConditionalExpressions = [];
    function recurse(node) {
        if (node.type === "ConditionalExpression") {
            recurse(node.test);
            recurse(node.consequent);
            recurse(node.alternate);
        }
        else {
            nonConditionalExpressions.push(node);
        }
    }
    recurse(node);
    return nonConditionalExpressions;
}
// Detect an expression node representing `{" "}`
function isJSXWhitespaceExpression(node) {
    return (node.type === "JSXExpressionContainer" &&
        isLiteral(node.expression) &&
        node.expression.value === " " &&
        !node.expression.comments);
}
// JSX Children are strange, mostly for two reasons:
// 1. JSX reads newlines into string values, instead of skipping them like JS
// 2. up to one whitespace between elements within a line is significant,
//    but not between lines.
//
// Leading, trailing, and lone whitespace all need to
// turn themselves into the rather ugly `{' '}` when breaking.
//
// We print JSX using the `fill` doc primitive.
// This requires that we give it an array of alternating
// content and whitespace elements.
// To ensure this we add dummy `""` content elements as needed.
function printJSXChildren(path, options, print, jsxWhitespace) {
    const n = path.getValue();
    const children = [];
    // using `map` instead of `each` because it provides `i`
    path.map((childPath, i) => {
        const child = childPath.getValue();
        if (isLiteral(child)) {
            const text = rawText(child);
            // Contains a non-whitespace character
            if (isMeaningfulJSXText(child)) {
                const words = text.split(matchJsxWhitespaceRegex);
                // Starts with whitespace
                if (words[0] === "") {
                    children.push("");
                    words.shift();
                    if (/\n/.test(words[0])) {
                        children.push(hardline$2);
                    }
                    else {
                        children.push(jsxWhitespace);
                    }
                    words.shift();
                }
                let endWhitespace;
                // Ends with whitespace
                if (util$5.getLast(words) === "") {
                    words.pop();
                    endWhitespace = words.pop();
                }
                // This was whitespace only without a new line.
                if (words.length === 0) {
                    return;
                }
                words.forEach((word, i) => {
                    if (i % 2 === 1) {
                        children.push(line$1);
                    }
                    else {
                        children.push(word);
                    }
                });
                if (endWhitespace !== undefined) {
                    if (/\n/.test(endWhitespace)) {
                        children.push(hardline$2);
                    }
                    else {
                        children.push(jsxWhitespace);
                    }
                }
                else {
                    // Ideally this would be a `hardline` to allow a break between
                    // tags and text.
                    // Unfortunately Facebook have a custom translation pipeline
                    // (https://github.com/prettier/prettier/issues/1581#issuecomment-300975032)
                    // that uses the JSX syntax, but does not follow the React whitespace
                    // rules.
                    // Ensuring that we never have a break between tags and text in JSX
                    // will allow Facebook to adopt Prettier without too much of an
                    // adverse effect on formatting algorithm.
                    children.push("");
                }
            }
            else if (/\n/.test(text)) {
                // Keep (up to one) blank line between tags/expressions/text.
                // Note: We don't keep blank lines between text elements.
                if (text.match(/\n/g).length > 1) {
                    children.push("");
                    children.push(hardline$2);
                }
            }
            else {
                children.push("");
                children.push(jsxWhitespace);
            }
        }
        else {
            const printedChild = print(childPath);
            children.push(printedChild);
            const next = n.children[i + 1];
            const directlyFollowedByMeaningfulText = next && isMeaningfulJSXText(next) && !/^[ \n\r\t]/.test(rawText(next));
            if (directlyFollowedByMeaningfulText) {
                // Potentially this could be a hardline as well.
                // See the comment above about the Facebook translation pipeline as
                // to why this is an empty string.
                children.push("");
            }
            else {
                children.push(hardline$2);
            }
        }
    }, "children");
    return children;
}
// JSX expands children from the inside-out, instead of the outside-in.
// This is both to break children before attributes,
// and to ensure that when children break, their parents do as well.
//
// Any element that is written without any newlines and fits on a single line
// is left that way.
// Not only that, any user-written-line containing multiple JSX siblings
// should also be kept on one line if possible,
// so each user-written-line is wrapped in its own group.
//
// Elements that contain newlines or don't fit on a single line (recursively)
// are fully-split, using hardline and shouldBreak: true.
//
// To support that case properly, all leading and trailing spaces
// are stripped from the list of children, and replaced with a single hardline.
function printJSXElement(path, options, print) {
    const n = path.getValue();
    // Turn <div></div> into <div />
    if (isEmptyJSXElement(n)) {
        n.openingElement.selfClosing = true;
        delete n.closingElement;
    }
    const openingLines = path.call(print, "openingElement");
    const closingLines = path.call(print, "closingElement");
    if (n.children.length === 1 &&
        n.children[0].type === "JSXExpressionContainer" &&
        (n.children[0].expression.type === "TemplateLiteral" ||
            n.children[0].expression.type === "TaggedTemplateExpression")) {
        return concat$2([
            openingLines,
            concat$2(path.map(print, "children")),
            closingLines
        ]);
    }
    // If no children, just print the opening element
    if (n.openingElement.selfClosing) {
        assert$1.ok(!n.closingElement);
        return openingLines;
    }
    // Convert `{" "}` to text nodes containing a space.
    // This makes it easy to turn them into `jsxWhitespace` which
    // can then print as either a space or `{" "}` when breaking.
    n.children = n.children.map(child => {
        if (isJSXWhitespaceExpression(child)) {
            return {
                type: "JSXText",
                value: " ",
                raw: " "
            };
        }
        return child;
    });
    const containsTag = n.children.filter(child => child.type === "JSXElement").length > 0;
    const containsMultipleExpressions = n.children.filter(child => child.type === "JSXExpressionContainer").length >
        1;
    const containsMultipleAttributes = n.openingElement.attributes.length > 1;
    // Record any breaks. Should never go from true to false, only false to true.
    let forcedBreak = willBreak(openingLines) ||
        containsTag ||
        containsMultipleAttributes ||
        containsMultipleExpressions;
    const rawJsxWhitespace = options.singleQuote ? "{' '}" : '{" "}';
    const jsxWhitespace = ifBreak$1(concat$2([rawJsxWhitespace, softline$1]), " ");
    const children = printJSXChildren(path, options, print, jsxWhitespace);
    const containsText = n.children.filter(child => isMeaningfulJSXText(child)).length > 0;
    // We can end up we multiple whitespace elements with empty string
    // content between them.
    // We need to remove empty whitespace and softlines before JSX whitespace
    // to get the correct output.
    for (let i = children.length - 2; i >= 0; i--) {
        const isPairOfEmptyStrings = children[i] === "" && children[i + 1] === "";
        const isPairOfHardlines = children[i] === hardline$2 &&
            children[i + 1] === "" &&
            children[i + 2] === hardline$2;
        const isLineFollowedByJSXWhitespace = (children[i] === softline$1 || children[i] === hardline$2) &&
            children[i + 1] === "" &&
            children[i + 2] === jsxWhitespace;
        const isJSXWhitespaceFollowedByLine = children[i] === jsxWhitespace &&
            children[i + 1] === "" &&
            (children[i + 2] === softline$1 || children[i + 2] === hardline$2);
        if ((isPairOfHardlines && containsText) ||
            isPairOfEmptyStrings ||
            isLineFollowedByJSXWhitespace) {
            children.splice(i, 2);
        }
        else if (isJSXWhitespaceFollowedByLine) {
            children.splice(i + 1, 2);
        }
    }
    // Trim trailing lines (or empty strings)
    while (children.length &&
        (isLineNext(util$5.getLast(children)) || isEmpty(util$5.getLast(children)))) {
        children.pop();
    }
    // Trim leading lines (or empty strings)
    while (children.length &&
        (isLineNext(children[0]) || isEmpty(children[0])) &&
        (isLineNext(children[1]) || isEmpty(children[1]))) {
        children.shift();
        children.shift();
    }
    // Tweak how we format children if outputting this element over multiple lines.
    // Also detect whether we will force this element to output over multiple lines.
    const multilineChildren = [];
    children.forEach((child, i) => {
        // There are a number of situations where we need to ensure we display
        // whitespace as `{" "}` when outputting this element over multiple lines.
        if (child === jsxWhitespace) {
            if (i === 1 && children[i - 1] === "") {
                if (children.length === 2) {
                    // Solitary whitespace
                    multilineChildren.push(rawJsxWhitespace);
                    return;
                }
                // Leading whitespace
                multilineChildren.push(concat$2([rawJsxWhitespace, hardline$2]));
                return;
            }
            else if (i === children.length - 1) {
                // Trailing whitespace
                multilineChildren.push(rawJsxWhitespace);
                return;
            }
            else if (children[i - 1] === "" && children[i - 2] === hardline$2) {
                // Whitespace after line break
                multilineChildren.push(rawJsxWhitespace);
                return;
            }
        }
        multilineChildren.push(child);
        if (willBreak(child)) {
            forcedBreak = true;
        }
    });
    // If there is text we use `fill` to fit as much onto each line as possible.
    // When there is no text (just tags and expressions) we use `group`
    // to output each on a separate line.
    const content = containsText
        ? fill$1(multilineChildren)
        : group$1(concat$2(multilineChildren), { shouldBreak: true });
    const multiLineElem = group$1(concat$2([
        openingLines,
        indent$2(concat$2([hardline$2, content])),
        hardline$2,
        closingLines
    ]));
    if (forcedBreak) {
        return multiLineElem;
    }
    return conditionalGroup$1([
        group$1(concat$2([openingLines, concat$2(children), closingLines])),
        multiLineElem
    ]);
}
function maybeWrapJSXElementInParens(path, elem) {
    const parent = path.getParentNode();
    if (!parent) {
        return elem;
    }
    const NO_WRAP_PARENTS = {
        ArrayExpression: true,
        JSXElement: true,
        JSXExpressionContainer: true,
        ExpressionStatement: true,
        CallExpression: true,
        ConditionalExpression: true
    };
    if (NO_WRAP_PARENTS[parent.type]) {
        return elem;
    }
    return group$1(concat$2([
        ifBreak$1("("),
        indent$2(concat$2([softline$1, elem])),
        softline$1,
        ifBreak$1(")")
    ]));
}
function isBinaryish(node) {
    return node.type === "BinaryExpression" || node.type === "LogicalExpression";
}
function isMemberish(node) {
    return (node.type === "MemberExpression" ||
        (node.type === "BindExpression" && node.object));
}
function shouldInlineLogicalExpression(node) {
    if (node.type !== "LogicalExpression") {
        return false;
    }
    if (node.right.type === "ObjectExpression" &&
        node.right.properties.length !== 0) {
        return true;
    }
    if (node.right.type === "ArrayExpression" &&
        node.right.elements.length !== 0) {
        return true;
    }
    if (node.right.type === "JSXElement") {
        return true;
    }
    return false;
}
// For binary expressions to be consistent, we need to group
// subsequent operators with the same precedence level under a single
// group. Otherwise they will be nested such that some of them break
// onto new lines but not all. Operators with the same precedence
// level should either all break or not. Because we group them by
// precedence level and the AST is structured based on precedence
// level, things are naturally broken up correctly, i.e. `&&` is
// broken before `+`.
function printBinaryishExpressions(path, print, options, isNested, isInsideParenthesis) {
    let parts = [];
    const node = path.getValue();
    // We treat BinaryExpression and LogicalExpression nodes the same.
    if (isBinaryish(node)) {
        // Put all operators with the same precedence level in the same
        // group. The reason we only need to do this with the `left`
        // expression is because given an expression like `1 + 2 - 3`, it
        // is always parsed like `((1 + 2) - 3)`, meaning the `left` side
        // is where the rest of the expression will exist. Binary
        // expressions on the right side mean they have a difference
        // precedence level and should be treated as a separate group, so
        // print them normally. (This doesn't hold for the `**` operator,
        // which is unique in that it is right-associative.)
        if (util$5.shouldFlatten(node.operator, node.left.operator)) {
            // Flatten them out by recursively calling this function.
            parts = parts.concat(path.call(left => printBinaryishExpressions(left, print, options, 
            /* isNested */ true, isInsideParenthesis), "left"));
        }
        else {
            parts.push(path.call(print, "left"));
        }
        const right = concat$2([
            node.operator,
            shouldInlineLogicalExpression(node) ? " " : line$1,
            path.call(print, "right")
        ]);
        // If there's only a single binary expression, we want to create a group
        // in order to avoid having a small right part like -1 be on its own line.
        const parent = path.getParentNode();
        const shouldGroup = !(isInsideParenthesis && node.type === "LogicalExpression") &&
            parent.type !== node.type &&
            node.left.type !== node.type &&
            node.right.type !== node.type;
        parts.push(" ", shouldGroup ? group$1(right) : right);
        // The root comments are already printed, but we need to manually print
        // the other ones since we don't call the normal print on BinaryExpression,
        // only for the left and right parts
        if (isNested && node.comments) {
            parts = comments$3.printComments(path, () => concat$2(parts), options);
        }
    }
    else {
        // Our stopping case. Simply print the node normally.
        parts.push(path.call(print));
    }
    return parts;
}
function printAssignmentRight(rightNode, printedRight, canBreak, options) {
    if (hasLeadingOwnLineComment(options.originalText, rightNode)) {
        return indent$2(concat$2([hardline$2, printedRight]));
    }
    if (canBreak) {
        return indent$2(concat$2([line$1, printedRight]));
    }
    return concat$2([" ", printedRight]);
}
function printAssignment(leftNode, printedLeft, operator, rightNode, printedRight, options, type) {
    if (!rightNode) {
        return printedLeft;
    }
    const canBreak = (options.breakProperty && type === "Property") ||
        (isBinaryish(rightNode) && !shouldInlineLogicalExpression(rightNode)) ||
        (rightNode.type === "ConditionalExpression" &&
            isBinaryish(rightNode.test) &&
            !shouldInlineLogicalExpression(rightNode.test)) ||
        ((leftNode.type === "Identifier" ||
            isStringLiteral(leftNode) ||
            leftNode.type === "MemberExpression") &&
            (isStringLiteral(rightNode) || isMemberExpressionChain(rightNode)));
    const printed = printAssignmentRight(rightNode, printedRight, canBreak, options);
    return group$1(concat$2([printedLeft, operator, printed]));
}
function adjustClause(node, clause, forceSpace) {
    if (node.type === "EmptyStatement") {
        return ";";
    }
    if (node.type === "BlockStatement" || forceSpace) {
        return concat$2([" ", clause]);
    }
    return indent$2(concat$2([line$1, clause]));
}
function nodeStr(node, options, isFlowOrTypeScriptDirectiveLiteral) {
    const raw = rawText(node);
    // `rawContent` is the string exactly like it appeared in the input source
    // code, with its enclosing quote.
    const rawContent = raw.slice(1, -1);
    const double = { quote: '"', regex: /"/g };
    const single = { quote: "'", regex: /'/g };
    const preferred = options.singleQuote ? single : double;
    const alternate = preferred === single ? double : single;
    let shouldUseAlternateQuote = false;
    const isDirectiveLiteral = isFlowOrTypeScriptDirectiveLiteral || node.type === "DirectiveLiteral";
    let canChangeDirectiveQuotes = false;
    // If `rawContent` contains at least one of the quote preferred for enclosing
    // the string, we might want to enclose with the alternate quote instead, to
    // minimize the number of escaped quotes.
    // Also check for the alternate quote, to determine if we're allowed to swap
    // the quotes on a DirectiveLiteral.
    if (rawContent.includes(preferred.quote) ||
        rawContent.includes(alternate.quote)) {
        const numPreferredQuotes = (rawContent.match(preferred.regex) || []).length;
        const numAlternateQuotes = (rawContent.match(alternate.regex) || []).length;
        shouldUseAlternateQuote = numPreferredQuotes > numAlternateQuotes;
    }
    else {
        canChangeDirectiveQuotes = true;
    }
    const enclosingQuote = options.parser === "json"
        ? double.quote
        : shouldUseAlternateQuote ? alternate.quote : preferred.quote;
    // Directives are exact code unit sequences, which means that you can't
    // change the escape sequences they use.
    // See https://github.com/prettier/prettier/issues/1555
    // and https://tc39.github.io/ecma262/#directive-prologue
    if (isDirectiveLiteral) {
        if (canChangeDirectiveQuotes) {
            return enclosingQuote + rawContent + enclosingQuote;
        }
        return raw;
    }
    // It might sound unnecessary to use `makeString` even if `node.raw` already
    // is enclosed with `enclosingQuote`, but it isn't. `node.raw` could contain
    // unnecessary escapes (such as in `"\'"`). Always using `makeString` makes
    // sure that we consistently output the minimum amount of escaped quotes.
    return makeString(rawContent, enclosingQuote);
}
function makeString(rawContent, enclosingQuote) {
    const otherQuote = enclosingQuote === '"' ? "'" : '"';
    // Matches _any_ escape and unescaped quotes (both single and double).
    const regex = /\\([\s\S])|(['"])/g;
    // Escape and unescape single and double quotes as needed to be able to
    // enclose `rawContent` with `enclosingQuote`.
    const newContent = rawContent.replace(regex, (match, escaped, quote) => {
        // If we matched an escape, and the escaped character is a quote of the
        // other type than we intend to enclose the string with, there's no need for
        // it to be escaped, so return it _without_ the backslash.
        if (escaped === otherQuote) {
            return escaped;
        }
        // If we matched an unescaped quote and it is of the _same_ type as we
        // intend to enclose the string with, it must be escaped, so return it with
        // a backslash.
        if (quote === enclosingQuote) {
            return "\\" + quote;
        }
        if (quote) {
            return quote;
        }
        // Unescape any unnecessarily escaped character.
        // Adapted from https://github.com/eslint/eslint/blob/de0b4ad7bd820ade41b1f606008bea68683dc11a/lib/rules/no-useless-escape.js#L27
        return /^[^\\nrvtbfux\r\n\u2028\u2029"'0-7]$/.test(escaped)
            ? escaped
            : "\\" + escaped;
    });
    return enclosingQuote + newContent + enclosingQuote;
}
function printRegex(node) {
    const flags = node.flags.split("").sort().join("");
    return `/${node.pattern}/${flags}`;
}
function printNumber(rawNumber) {
    return (rawNumber
        .toLowerCase()
        .replace(/^([\d.]+e)(?:\+|(-))?0*(\d)/, "$1$2$3")
        .replace(/^([\d.]+)e[+-]?0+$/, "$1")
        .replace(/^\./, "0.")
        .replace(/(\.\d+?)0+(?=e|$)/, "$1")
        .replace(/\.(?=e|$)/, ""));
}
function isLastStatement(path) {
    const parent = path.getParentNode();
    if (!parent) {
        return true;
    }
    const node = path.getValue();
    const body = (parent.body || parent.consequent)
        .filter(stmt => stmt.type !== "EmptyStatement");
    return body && body[body.length - 1] === node;
}
function hasLeadingComment(node) {
    return node.comments && node.comments.some(comment => comment.leading);
}
function hasTrailingComment(node) {
    return node.comments && node.comments.some(comment => comment.trailing);
}
function hasLeadingOwnLineComment(text, node) {
    if (node.type === "JSXElement") {
        return false;
    }
    const res = node.comments &&
        node.comments.some(comment => comment.leading && util$5.hasNewline(text, util$5.locEnd(comment)));
    return res;
}
function hasNakedLeftSide(node) {
    return (node.type === "AssignmentExpression" ||
        node.type === "BinaryExpression" ||
        node.type === "LogicalExpression" ||
        node.type === "ConditionalExpression" ||
        node.type === "CallExpression" ||
        node.type === "MemberExpression" ||
        node.type === "SequenceExpression" ||
        node.type === "TaggedTemplateExpression" ||
        (node.type === "BindExpression" && !node.object) ||
        (node.type === "UpdateExpression" && !node.prefix));
}
function getLeftSide(node) {
    if (node.expressions) {
        return node.expressions[0];
    }
    return (node.left ||
        node.test ||
        node.callee ||
        node.object ||
        node.tag ||
        node.argument ||
        node.expression);
}
function exprNeedsASIProtection(node, options) {
    // HACK: node.needsParens is added in `genericPrint()` for the sole purpose
    // of being used here. It'd be preferable to find a cleaner way to do this.
    const maybeASIProblem = node.needsParens ||
        node.type === "ParenthesizedExpression" ||
        node.type === "TypeCastExpression" ||
        (node.type === "ArrowFunctionExpression" &&
            !canPrintParamsWithoutParens(node, options)) ||
        node.type === "ArrayExpression" ||
        node.type === "ArrayPattern" ||
        (node.type === "UnaryExpression" &&
            node.prefix &&
            (node.operator === "+" || node.operator === "-")) ||
        node.type === "TemplateLiteral" ||
        node.type === "TemplateElement" ||
        node.type === "JSXElement" ||
        node.type === "BindExpression" ||
        node.type === "RegExpLiteral" ||
        (node.type === "Literal" && node.pattern) ||
        (node.type === "Literal" && node.regex);
    if (maybeASIProblem) {
        return true;
    }
    if (!hasNakedLeftSide(node)) {
        return false;
    }
    return exprNeedsASIProtection(getLeftSide(node), options);
}
function stmtNeedsASIProtection(path, options) {
    const node = path.getNode();
    if (node.type !== "ExpressionStatement") {
        return false;
    }
    return exprNeedsASIProtection(node.expression, options);
}
function classPropMayCauseASIProblems(path) {
    const node = path.getNode();
    if (node.type !== "ClassProperty") {
        return false;
    }
    const name = node.key && node.key.name;
    // this isn't actually possible yet with most parsers available today
    // so isn't properly tested yet.
    if ((name === "static" || name === "get" || name === "set") &&
        !node.typeAnnotation) {
        return true;
    }
}
function classChildNeedsASIProtection(node) {
    if (!node) {
        return;
    }
    if (!node.computed) {
        const name = node.key && node.key.name;
        if (name === "in" || name === "instanceof") {
            return true;
        }
    }
    switch (node.type) {
        case "ClassProperty":
        case "TSAbstractClassProperty":
            return node.computed;
        case "MethodDefinition": // Flow
        case "TSAbstractMethodDefinition": // TypeScript
        case "ClassMethod": {
            // Babylon
            const isAsync = node.value ? node.value.async : node.async;
            const isGenerator = node.value ? node.value.generator : node.generator;
            if (isAsync ||
                node.static ||
                node.kind === "get" ||
                node.kind === "set") {
                return false;
            }
            if (node.computed || isGenerator) {
                return true;
            }
            return false;
        }
        default:
            /* istanbul ignore next */
            return false;
    }
}
// This recurses the return argument, looking for the first token
// (the leftmost leaf node) and, if it (or its parents) has any
// leadingComments, returns true (so it can be wrapped in parens).
function returnArgumentHasLeadingComment(options, argument) {
    if (hasLeadingOwnLineComment(options.originalText, argument)) {
        return true;
    }
    if (hasNakedLeftSide(argument)) {
        let leftMost = argument;
        let newLeftMost;
        while ((newLeftMost = getLeftSide(leftMost))) {
            leftMost = newLeftMost;
            if (hasLeadingOwnLineComment(options.originalText, leftMost)) {
                return true;
            }
        }
    }
    return false;
}
function isMemberExpressionChain(node) {
    if (node.type !== "MemberExpression") {
        return false;
    }
    if (node.object.type === "Identifier") {
        return true;
    }
    return isMemberExpressionChain(node.object);
}
// Hack to differentiate between the following two which have the same ast
// type T = { method: () => void };
// type T = { method(): void };
function isObjectTypePropertyAFunction(node) {
    return (node.type === "ObjectTypeProperty" &&
        node.value.type === "FunctionTypeAnnotation" &&
        !node.static &&
        !isFunctionNotation(node));
}
// TODO: This is a bad hack and we need a better way to distinguish between
// arrow functions and otherwise
function isFunctionNotation(node) {
    return isGetterOrSetter(node) || sameLocStart(node, node.value);
}
function isGetterOrSetter(node) {
    return node.kind === "get" || node.kind === "set";
}
function sameLocStart(nodeA, nodeB) {
    return util$5.locStart(nodeA) === util$5.locStart(nodeB);
}
// Hack to differentiate between the following two which have the same ast
// declare function f(a): void;
// var f: (a) => void;
function isTypeAnnotationAFunction(node) {
    return (node.type === "TypeAnnotation" &&
        node.typeAnnotation.type === "FunctionTypeAnnotation" &&
        !node.static &&
        !sameLocStart(node, node.typeAnnotation));
}
function isNodeStartingWithDeclare(node, options) {
    if (!(options.parser === "flow" || options.parser === "typescript")) {
        return false;
    }
    return (options.originalText.slice(0, util$5.locStart(node)).match(/declare\s*$/) ||
        options.originalText
            .slice(node.range[0], node.range[1])
            .startsWith("declare "));
}
function shouldHugType(node) {
    if (isObjectType(node)) {
        return true;
    }
    if (node.type === "UnionTypeAnnotation" || node.type === "TSUnionType") {
        const voidCount = node.types.filter(n => n.type === "VoidTypeAnnotation" ||
            n.type === "TSVoidKeyword" ||
            n.type === "NullLiteralTypeAnnotation" ||
            n.type === "TSNullKeyword").length;
        const objectCount = node.types.filter(n => n.type === "ObjectTypeAnnotation" ||
            n.type === "TSTypeLiteral" ||
            // This is a bit aggressive but captures Array<{x}>
            n.type === "GenericTypeAnnotation" ||
            n.type === "TSTypeReference").length;
        if (node.types.length - 1 === voidCount && objectCount > 0) {
            return true;
        }
    }
    return false;
}
function shouldHugArguments(fun) {
    return (fun &&
        fun.params &&
        fun.params.length === 1 &&
        !fun.params[0].comments &&
        (fun.params[0].type === "ObjectPattern" ||
            (fun.params[0].type === "Identifier" &&
                fun.params[0].typeAnnotation &&
                fun.params[0].typeAnnotation.type === "TypeAnnotation" &&
                isObjectType(fun.params[0].typeAnnotation.typeAnnotation)) ||
            (fun.params[0].type === "FunctionTypeParam" &&
                isObjectType(fun.params[0].typeAnnotation))) &&
        !fun.rest);
}
function templateLiteralHasNewLines(template) {
    return template.quasis.some(quasi => quasi.value.raw.includes("\n"));
}
function isTemplateOnItsOwnLine(n, text) {
    return (((n.type === "TemplateLiteral" && templateLiteralHasNewLines(n)) ||
        (n.type === "TaggedTemplateExpression" &&
            templateLiteralHasNewLines(n.quasi))) &&
        !util$5.hasNewline(text, util$5.locStart(n), { backwards: true }));
}
function printArrayItems(path, options, printPath, print) {
    const printedElements = [];
    let separatorParts = [];
    path.each(childPath => {
        printedElements.push(concat$2(separatorParts));
        printedElements.push(group$1(print(childPath)));
        separatorParts = [",", line$1];
        if (childPath.getValue() &&
            util$5.isNextLineEmpty(options.originalText, childPath.getValue())) {
            separatorParts.push(softline$1);
        }
    }, printPath);
    return concat$2(printedElements);
}
function hasDanglingComments(node) {
    return (node.comments &&
        node.comments.some(comment => !comment.leading && !comment.trailing));
}
function isLiteral(node) {
    return (node.type === "BooleanLiteral" ||
        node.type === "DirectiveLiteral" ||
        node.type === "Literal" ||
        node.type === "NullLiteral" ||
        node.type === "NumericLiteral" ||
        node.type === "RegExpLiteral" ||
        node.type === "StringLiteral" ||
        node.type === "TemplateLiteral" ||
        node.type === "TSTypeLiteral" ||
        node.type === "JSXText");
}
function isStringLiteral(node) {
    return (node.type === "StringLiteral" ||
        (node.type === "Literal" && typeof node.value === "string"));
}
function isObjectType(n) {
    return n.type === "ObjectTypeAnnotation" || n.type === "TSTypeLiteral";
}
function printAstToDoc$1(ast, options, addAlignmentSize) {
    addAlignmentSize = addAlignmentSize || 0;
    const cache = new Map();
    function printGenerically(path, args) {
        const node = path.getValue();
        const shouldCache = node && typeof node === "object" && args === undefined;
        if (shouldCache && cache.has(node)) {
            return cache.get(node);
        }
        const parent = path.getParentNode(0);
        // We let JSXElement print its comments itself because it adds () around
        // UnionTypeAnnotation has to align the child without the comments
        let res;
        if ((node && node.type === "JSXElement") ||
            (parent &&
                (parent.type === "UnionTypeAnnotation" ||
                    parent.type === "TSUnionType"))) {
            res = genericPrint(path, options, printGenerically, args);
        }
        else {
            res = comments$3.printComments(path, p => genericPrint(p, options, printGenerically, args), options, args && args.needsSemi);
        }
        if (shouldCache) {
            cache.set(node, res);
        }
        return res;
    }
    let doc = printGenerically(new FastPath(ast));
    if (addAlignmentSize > 0) {
        // Add a hardline to make the indents take effect
        // It should be removed in index.js format()
        doc = addAlignmentToDoc$1(docUtils.removeLines(concat$2([hardline$2, doc])), addAlignmentSize, options.tabWidth);
    }
    docUtils.propagateBreaks(doc);
    if (options.parser === "json") {
        doc = concat$2([doc, hardline$2]);
    }
    return doc;
}
var printer = { printAstToDoc: printAstToDoc$1 };
const docBuilders$8 = docBuilders$1;
const concat$7 = docBuilders$8.concat;
const fill$3 = docBuilders$8.fill;
const cursor$2 = docBuilders$8.cursor;
const MODE_BREAK = 1;
const MODE_FLAT = 2;
function rootIndent() {
    return {
        indent: 0,
        align: {
            spaces: 0,
            tabs: 0
        }
    };
}
function makeIndent(ind) {
    return {
        indent: ind.indent + 1,
        align: ind.align
    };
}
function makeAlign(ind, n) {
    if (n === -Infinity) {
        return {
            indent: 0,
            align: {
                spaces: 0,
                tabs: 0
            }
        };
    }
    return {
        indent: ind.indent,
        align: {
            spaces: ind.align.spaces + n,
            tabs: ind.align.tabs + (n ? 1 : 0)
        }
    };
}
function fits(next, restCommands, width, mustBeFlat) {
    let restIdx = restCommands.length;
    const cmds = [next];
    while (width >= 0) {
        if (cmds.length === 0) {
            if (restIdx === 0) {
                return true;
            }
            cmds.push(restCommands[restIdx - 1]);
            restIdx--;
            continue;
        }
        const x = cmds.pop();
        const ind = x[0];
        const mode = x[1];
        const doc = x[2];
        const align = x[3];
        if (typeof doc === "string") {
            width -= doc.length;
        }
        else {
            switch (doc.type) {
                case "concat":
                    for (let i = doc.parts.length - 1; i >= 0; i--) {
                        cmds.push([ind, mode, doc.parts[i]]);
                    }
                    break;
                case "indent":
                    cmds.push([makeIndent(ind), mode, doc.contents]);
                    break;
                case "align":
                    cmds.push([makeAlign(ind, doc.n), mode, doc.contents]);
                    break;
                case "group":
                    if (mustBeFlat && doc.break) {
                        return false;
                    }
                    cmds.push([ind, doc.break ? MODE_BREAK : mode, doc.contents]);
                    break;
                case "fill":
                    for (let i = doc.parts.length - 1; i >= 0; i--) {
                        cmds.push([ind, mode, doc.parts[i]]);
                    }
                    break;
                case "if-break":
                    if (mode === MODE_BREAK) {
                        if (doc.breakContents) {
                            cmds.push([ind, mode, doc.breakContents, align]);
                        }
                    }
                    if (mode === MODE_FLAT) {
                        if (doc.flatContents) {
                            cmds.push([ind, mode, doc.flatContents, align]);
                        }
                    }
                    break;
                case "line":
                    switch (mode) {
                        // fallthrough
                        case MODE_FLAT:
                            if (!doc.hard) {
                                if (!doc.soft) {
                                    width -= 1;
                                }
                                break;
                            }
                            return true;
                        case MODE_BREAK:
                            return true;
                    }
                    break;
            }
        }
    }
    return false;
}
function printDocToString$1(doc, options) {
    const width = options.printWidth;
    const newLine = options.newLine || "\n";
    let pos = 0;
    // cmds is basically a stack. We've turned a recursive call into a
    // while loop which is much faster. The while loop below adds new
    // cmds to the array instead of recursively calling `print`.
    const cmds = [[rootIndent(), MODE_BREAK, doc]];
    const out = [];
    let shouldRemeasure = false;
    let lineSuffix = [];
    while (cmds.length !== 0) {
        const x = cmds.pop();
        const ind = x[0];
        const mode = x[1];
        const doc = x[2];
        const align = x[3];
        if (typeof doc === "string") {
            out.push(doc);
            pos += doc.length;
        }
        else {
            switch (doc.type) {
                case "cursor":
                    out.push(cursor$2.placeholder);
                    break;
                case "concat":
                    for (let i = doc.parts.length - 1; i >= 0; i--) {
                        cmds.push([ind, mode, doc.parts[i]]);
                    }
                    break;
                case "indent":
                    cmds.push([makeIndent(ind), mode, doc.contents]);
                    break;
                case "align":
                    cmds.push([makeAlign(ind, doc.n), mode, doc.contents]);
                    break;
                case "group":
                    switch (mode) {
                        case MODE_FLAT:
                            if (!shouldRemeasure) {
                                cmds.push([
                                    ind,
                                    doc.break ? MODE_BREAK : MODE_FLAT,
                                    doc.contents,
                                    align
                                ]);
                                break;
                            }
                        // fallthrough
                        case MODE_BREAK: {
                            shouldRemeasure = false;
                            const next = [ind, MODE_FLAT, doc.contents];
                            const rem = width - pos;
                            if (!doc.break && fits(next, cmds, rem)) {
                                cmds.push(next);
                            }
                            else {
                                // Expanded states are a rare case where a document
                                // can manually provide multiple representations of
                                // itself. It provides an array of documents
                                // going from the least expanded (most flattened)
                                // representation first to the most expanded. If a
                                // group has these, we need to manually go through
                                // these states and find the first one that fits.
                                if (doc.expandedStates) {
                                    const mostExpanded = doc.expandedStates[doc.expandedStates.length - 1];
                                    if (doc.break) {
                                        cmds.push([ind, MODE_BREAK, mostExpanded, align]);
                                        break;
                                    }
                                    else {
                                        for (let i = 1; i < doc.expandedStates.length + 1; i++) {
                                            if (i >= doc.expandedStates.length) {
                                                cmds.push([ind, MODE_BREAK, mostExpanded, align]);
                                                break;
                                            }
                                            else {
                                                const state = doc.expandedStates[i];
                                                const cmd = [ind, MODE_FLAT, state, align];
                                                if (fits(cmd, cmds, rem)) {
                                                    cmds.push(cmd);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                                else {
                                    cmds.push([ind, MODE_BREAK, doc.contents, align]);
                                }
                            }
                            break;
                        }
                    }
                    break;
                // Fills each line with as much code as possible before moving to a new
                // line with the same indentation.
                //
                // Expects doc.parts to be an array of alternating content and
                // whitespace. The whitespace contains the linebreaks.
                //
                // For example:
                //   ["I", line, "love", line, "monkeys"]
                // or
                //   [{ type: group, ... }, softline, { type: group, ... }]
                //
                // It uses this parts structure to handle three main layout cases:
                // * The first two content items fit on the same line without
                //   breaking
                //   -> output the first content item and the whitespace "flat".
                // * Only the first content item fits on the line without breaking
                //   -> output the first content item "flat" and the whitespace with
                //   "break".
                // * Neither content item fits on the line without breaking
                //   -> output the first content item and the whitespace with "break".
                case "fill": {
                    const rem = width - pos;
                    const parts = doc.parts;
                    if (parts.length === 0) {
                        break;
                    }
                    const content = parts[0];
                    const contentFlatCmd = [ind, MODE_FLAT, content];
                    const contentBreakCmd = [ind, MODE_BREAK, content];
                    const contentFits = fits(contentFlatCmd, [], width - rem, true);
                    if (parts.length === 1) {
                        if (contentFits) {
                            cmds.push(contentFlatCmd);
                        }
                        else {
                            cmds.push(contentBreakCmd);
                        }
                        break;
                    }
                    const whitespace = parts[1];
                    const whitespaceFlatCmd = [ind, MODE_FLAT, whitespace];
                    const whitespaceBreakCmd = [ind, MODE_BREAK, whitespace];
                    if (parts.length === 2) {
                        if (contentFits) {
                            cmds.push(whitespaceFlatCmd);
                            cmds.push(contentFlatCmd);
                        }
                        else {
                            cmds.push(whitespaceBreakCmd);
                            cmds.push(contentBreakCmd);
                        }
                        break;
                    }
                    const remaining = parts.slice(2);
                    const remainingCmd = [ind, mode, fill$3(remaining)];
                    const secondContent = parts[2];
                    const firstAndSecondContentFlatCmd = [
                        ind,
                        MODE_FLAT,
                        concat$7([content, whitespace, secondContent])
                    ];
                    const firstAndSecondContentFits = fits(firstAndSecondContentFlatCmd, [], rem, true);
                    if (firstAndSecondContentFits) {
                        cmds.push(remainingCmd);
                        cmds.push(whitespaceFlatCmd);
                        cmds.push(contentFlatCmd);
                    }
                    else if (contentFits) {
                        cmds.push(remainingCmd);
                        cmds.push(whitespaceBreakCmd);
                        cmds.push(contentFlatCmd);
                    }
                    else {
                        cmds.push(remainingCmd);
                        cmds.push(whitespaceBreakCmd);
                        cmds.push(contentBreakCmd);
                    }
                    break;
                }
                case "if-break":
                    if (mode === MODE_BREAK) {
                        if (doc.breakContents) {
                            cmds.push([ind, mode, doc.breakContents, align]);
                        }
                    }
                    if (mode === MODE_FLAT) {
                        if (doc.flatContents) {
                            cmds.push([ind, mode, doc.flatContents, align]);
                        }
                    }
                    break;
                case "line-suffix":
                    lineSuffix.push([ind, mode, doc.contents, align]);
                    break;
                case "line-suffix-boundary":
                    if (lineSuffix.length > 0) {
                        cmds.push([ind, mode, { type: "line", hard: true }]);
                    }
                    break;
                case "line":
                    switch (mode) {
                        case MODE_FLAT:
                            if (!doc.hard) {
                                if (!doc.soft) {
                                    out.push(" ");
                                    pos += 1;
                                }
                                break;
                            }
                            else {
                                // This line was forced into the output even if we
                                // were in flattened mode, so we need to tell the next
                                // group that no matter what, it needs to remeasure
                                // because the previous measurement didn't accurately
                                // capture the entire expression (this is necessary
                                // for nested groups)
                                shouldRemeasure = true;
                            }
                        // fallthrough
                        case MODE_BREAK:
                            if (lineSuffix.length) {
                                cmds.push([ind, mode, doc, align]);
                                [].push.apply(cmds, lineSuffix.reverse());
                                lineSuffix = [];
                                break;
                            }
                            if (doc.literal) {
                                out.push(newLine);
                                pos = 0;
                            }
                            else {
                                if (out.length > 0) {
                                    // Trim whitespace at the end of line
                                    while (out.length > 0 &&
                                        out[out.length - 1].match(/^[^\S\n]*$/)) {
                                        out.pop();
                                    }
                                    if (out.length) {
                                        out[out.length - 1] = out[out.length - 1].replace(/[^\S\n]*$/, "");
                                    }
                                }
                                const length = ind.indent * options.tabWidth + ind.align.spaces;
                                const indentString = options.useTabs
                                    ? "\t".repeat(ind.indent + ind.align.tabs)
                                    : " ".repeat(length);
                                out.push(newLine + indentString);
                                pos = length;
                            }
                            break;
                    }
                    break;
                default:
            }
        }
    }
    const cursorPlaceholderIndex = out.indexOf(cursor$2.placeholder);
    if (cursorPlaceholderIndex !== -1) {
        const beforeCursor = out.slice(0, cursorPlaceholderIndex).join("");
        const afterCursor = out.slice(cursorPlaceholderIndex + 1).join("");
        return {
            formatted: beforeCursor + afterCursor,
            cursor: beforeCursor.length
        };
    }
    return { formatted: out.join("") };
}
var docPrinter = { printDocToString: printDocToString$1 };
var index$26 = createCommonjsModule(function (module) {
    'use strict';
    function assembleStyles() {
        var styles = {
            modifiers: {
                reset: [0, 0],
                bold: [1, 22],
                dim: [2, 22],
                italic: [3, 23],
                underline: [4, 24],
                inverse: [7, 27],
                hidden: [8, 28],
                strikethrough: [9, 29]
            },
            colors: {
                black: [30, 39],
                red: [31, 39],
                green: [32, 39],
                yellow: [33, 39],
                blue: [34, 39],
                magenta: [35, 39],
                cyan: [36, 39],
                white: [37, 39],
                gray: [90, 39]
            },
            bgColors: {
                bgBlack: [40, 49],
                bgRed: [41, 49],
                bgGreen: [42, 49],
                bgYellow: [43, 49],
                bgBlue: [44, 49],
                bgMagenta: [45, 49],
                bgCyan: [46, 49],
                bgWhite: [47, 49]
            }
        };
        // fix humans
        styles.colors.grey = styles.colors.gray;
        Object.keys(styles).forEach(function (groupName) {
            var group = styles[groupName];
            Object.keys(group).forEach(function (styleName) {
                var style = group[styleName];
                styles[styleName] = group[styleName] = {
                    open: '\u001b[' + style[0] + 'm',
                    close: '\u001b[' + style[1] + 'm'
                };
            });
            Object.defineProperty(styles, groupName, {
                value: group,
                enumerable: false
            });
        });
        return styles;
    }
    Object.defineProperty(module, 'exports', {
        enumerable: true,
        get: assembleStyles
    });
});
var argv$1 = process.argv;
var terminator$1 = argv$1.indexOf('--');
var hasFlag$1 = function (flag) {
    flag = '--' + flag;
    var pos = argv$1.indexOf(flag);
    return pos !== -1 && (terminator$1 !== -1 ? pos < terminator$1 : true);
};
var index$28 = (function () {
    if ('FORCE_COLOR' in process.env) {
        return true;
    }
    if (hasFlag$1('no-color') ||
        hasFlag$1('no-colors') ||
        hasFlag$1('color=false')) {
        return false;
    }
    if (hasFlag$1('color') ||
        hasFlag$1('colors') ||
        hasFlag$1('color=true') ||
        hasFlag$1('color=always')) {
        return true;
    }
    if (process.stdout && !process.stdout.isTTY) {
        return false;
    }
    if (process.platform === 'win32') {
        return true;
    }
    if ('COLORTERM' in process.env) {
        return true;
    }
    if (process.env.TERM === 'dumb') {
        return false;
    }
    if (/^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM)) {
        return true;
    }
    return false;
})();
var escapeStringRegexp$1 = index$10;
var ansiStyles$1 = index$26;
var stripAnsi$1 = index$14;
var hasAnsi$1 = index$18;
var supportsColor$1 = index$28;
var defineProps$1 = Object.defineProperties;
var isSimpleWindowsTerm$1 = process.platform === 'win32' && !/^xterm/i.test(process.env.TERM);
function Chalk$1(options) {
    // detect mode if not set manually
    this.enabled = !options || options.enabled === undefined ? supportsColor$1 : options.enabled;
}
// use bright blue on Windows as the normal blue color is illegible
if (isSimpleWindowsTerm$1) {
    ansiStyles$1.blue.open = '\u001b[94m';
}
var styles$1 = (function () {
    var ret = {};
    Object.keys(ansiStyles$1).forEach(function (key) {
        ansiStyles$1[key].closeRe = new RegExp(escapeStringRegexp$1(ansiStyles$1[key].close), 'g');
        ret[key] = {
            get: function () {
                return build$1.call(this, this._styles.concat(key));
            }
        };
    });
    return ret;
})();
var proto$1 = defineProps$1(function chalk() { }, styles$1);
function build$1(_styles) {
    var builder = function () {
        return applyStyle$1.apply(builder, arguments);
    };
    builder._styles = _styles;
    builder.enabled = this.enabled;
    // __proto__ is used because we must return a function, but there is
    // no way to create a function with a different prototype.
    /* eslint-disable no-proto */
    builder.__proto__ = proto$1;
    return builder;
}
function applyStyle$1() {
    // support varags, but simply cast to string in case there's only one arg
    var args = arguments;
    var argsLen = args.length;
    var str = argsLen !== 0 && String(arguments[0]);
    if (argsLen > 1) {
        // don't slice `arguments`, it prevents v8 optimizations
        for (var a = 1; a < argsLen; a++) {
            str += ' ' + args[a];
        }
    }
    if (!this.enabled || !str) {
        return str;
    }
    var nestedStyles = this._styles;
    var i = nestedStyles.length;
    // Turns out that on Windows dimmed gray text becomes invisible in cmd.exe,
    // see https://github.com/chalk/chalk/issues/58
    // If we're on Windows and we're dealing with a gray color, temporarily make 'dim' a noop.
    var originalDim = ansiStyles$1.dim.open;
    if (isSimpleWindowsTerm$1 && (nestedStyles.indexOf('gray') !== -1 || nestedStyles.indexOf('grey') !== -1)) {
        ansiStyles$1.dim.open = '';
    }
    while (i--) {
        var code = ansiStyles$1[nestedStyles[i]];
        // Replace any instances already present with a re-opening code
        // otherwise only the part of the string until said closing code
        // will be colored, and the rest will simply be 'plain'.
        str = code.open + str.replace(code.closeRe, code.open) + code.close;
    }
    // Reset the original 'dim' if we changed it to work around the Windows dimmed gray issue.
    ansiStyles$1.dim.open = originalDim;
    return str;
}
function init$1() {
    var ret = {};
    Object.keys(styles$1).forEach(function (name) {
        ret[name] = {
            get: function () {
                return build$1.call(this, [name]);
            }
        };
    });
    return ret;
}
defineProps$1(Chalk$1.prototype, init$1());
var index$24 = new Chalk$1();
var styles_1$1 = ansiStyles$1;
var hasColor$1 = hasAnsi$1;
var stripColor$1 = stripAnsi$1;
var supportsColor_1$1 = supportsColor$1;
index$24.styles = styles_1$1;
index$24.hasColor = hasColor$1;
index$24.stripColor = stripColor$1;
index$24.supportsColor = supportsColor_1$1;
var index$34 = createCommonjsModule(function (module) {
    'use strict';
    function assembleStyles() {
        var styles = {
            modifiers: {
                reset: [0, 0],
                bold: [1, 22],
                dim: [2, 22],
                italic: [3, 23],
                underline: [4, 24],
                inverse: [7, 27],
                hidden: [8, 28],
                strikethrough: [9, 29]
            },
            colors: {
                black: [30, 39],
                red: [31, 39],
                green: [32, 39],
                yellow: [33, 39],
                blue: [34, 39],
                magenta: [35, 39],
                cyan: [36, 39],
                white: [37, 39],
                gray: [90, 39]
            },
            bgColors: {
                bgBlack: [40, 49],
                bgRed: [41, 49],
                bgGreen: [42, 49],
                bgYellow: [43, 49],
                bgBlue: [44, 49],
                bgMagenta: [45, 49],
                bgCyan: [46, 49],
                bgWhite: [47, 49]
            }
        };
        // fix humans
        styles.colors.grey = styles.colors.gray;
        Object.keys(styles).forEach(function (groupName) {
            var group = styles[groupName];
            Object.keys(group).forEach(function (styleName) {
                var style = group[styleName];
                styles[styleName] = group[styleName] = {
                    open: '\u001b[' + style[0] + 'm',
                    close: '\u001b[' + style[1] + 'm'
                };
            });
            Object.defineProperty(styles, groupName, {
                value: group,
                enumerable: false
            });
        });
        return styles;
    }
    Object.defineProperty(module, 'exports', {
        enumerable: true,
        get: assembleStyles
    });
});
var argv$2 = process.argv;
var terminator$2 = argv$2.indexOf('--');
var hasFlag$2 = function (flag) {
    flag = '--' + flag;
    var pos = argv$2.indexOf(flag);
    return pos !== -1 && (terminator$2 !== -1 ? pos < terminator$2 : true);
};
var index$36 = (function () {
    if ('FORCE_COLOR' in process.env) {
        return true;
    }
    if (hasFlag$2('no-color') ||
        hasFlag$2('no-colors') ||
        hasFlag$2('color=false')) {
        return false;
    }
    if (hasFlag$2('color') ||
        hasFlag$2('colors') ||
        hasFlag$2('color=true') ||
        hasFlag$2('color=always')) {
        return true;
    }
    if (process.stdout && !process.stdout.isTTY) {
        return false;
    }
    if (process.platform === 'win32') {
        return true;
    }
    if ('COLORTERM' in process.env) {
        return true;
    }
    if (process.env.TERM === 'dumb') {
        return false;
    }
    if (/^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM)) {
        return true;
    }
    return false;
})();
var escapeStringRegexp$2 = index$10;
var ansiStyles$2 = index$34;
var stripAnsi$2 = index$14;
var hasAnsi$2 = index$18;
var supportsColor$2 = index$36;
var defineProps$2 = Object.defineProperties;
var isSimpleWindowsTerm$2 = process.platform === 'win32' && !/^xterm/i.test(process.env.TERM);
function Chalk$2(options) {
    // detect mode if not set manually
    this.enabled = !options || options.enabled === undefined ? supportsColor$2 : options.enabled;
}
// use bright blue on Windows as the normal blue color is illegible
if (isSimpleWindowsTerm$2) {
    ansiStyles$2.blue.open = '\u001b[94m';
}
var styles$2 = (function () {
    var ret = {};
    Object.keys(ansiStyles$2).forEach(function (key) {
        ansiStyles$2[key].closeRe = new RegExp(escapeStringRegexp$2(ansiStyles$2[key].close), 'g');
        ret[key] = {
            get: function () {
                return build$2.call(this, this._styles.concat(key));
            }
        };
    });
    return ret;
})();
var proto$2 = defineProps$2(function chalk() { }, styles$2);
function build$2(_styles) {
    var builder = function () {
        return applyStyle$2.apply(builder, arguments);
    };
    builder._styles = _styles;
    builder.enabled = this.enabled;
    // __proto__ is used because we must return a function, but there is
    // no way to create a function with a different prototype.
    /* eslint-disable no-proto */
    builder.__proto__ = proto$2;
    return builder;
}
function applyStyle$2() {
    // support varags, but simply cast to string in case there's only one arg
    var args = arguments;
    var argsLen = args.length;
    var str = argsLen !== 0 && String(arguments[0]);
    if (argsLen > 1) {
        // don't slice `arguments`, it prevents v8 optimizations
        for (var a = 1; a < argsLen; a++) {
            str += ' ' + args[a];
        }
    }
    if (!this.enabled || !str) {
        return str;
    }
    var nestedStyles = this._styles;
    var i = nestedStyles.length;
    // Turns out that on Windows dimmed gray text becomes invisible in cmd.exe,
    // see https://github.com/chalk/chalk/issues/58
    // If we're on Windows and we're dealing with a gray color, temporarily make 'dim' a noop.
    var originalDim = ansiStyles$2.dim.open;
    if (isSimpleWindowsTerm$2 && (nestedStyles.indexOf('gray') !== -1 || nestedStyles.indexOf('grey') !== -1)) {
        ansiStyles$2.dim.open = '';
    }
    while (i--) {
        var code = ansiStyles$2[nestedStyles[i]];
        // Replace any instances already present with a re-opening code
        // otherwise only the part of the string until said closing code
        // will be colored, and the rest will simply be 'plain'.
        str = code.open + str.replace(code.closeRe, code.open) + code.close;
    }
    // Reset the original 'dim' if we changed it to work around the Windows dimmed gray issue.
    ansiStyles$2.dim.open = originalDim;
    return str;
}
function init$2() {
    var ret = {};
    Object.keys(styles$2).forEach(function (name) {
        ret[name] = {
            get: function () {
                return build$2.call(this, [name]);
            }
        };
    });
    return ret;
}
defineProps$2(Chalk$2.prototype, init$2());
var index$32 = new Chalk$2();
var styles_1$2 = ansiStyles$2;
var hasColor$2 = hasAnsi$2;
var stripColor$2 = stripAnsi$2;
var supportsColor_1$2 = supportsColor$2;
index$32.styles = styles_1$2;
index$32.hasColor = hasColor$2;
index$32.stripColor = stripColor$2;
index$32.supportsColor = supportsColor_1$2;
var index$44 = {
    "aliceblue": [240, 248, 255],
    "antiquewhite": [250, 235, 215],
    "aqua": [0, 255, 255],
    "aquamarine": [127, 255, 212],
    "azure": [240, 255, 255],
    "beige": [245, 245, 220],
    "bisque": [255, 228, 196],
    "black": [0, 0, 0],
    "blanchedalmond": [255, 235, 205],
    "blue": [0, 0, 255],
    "blueviolet": [138, 43, 226],
    "brown": [165, 42, 42],
    "burlywood": [222, 184, 135],
    "cadetblue": [95, 158, 160],
    "chartreuse": [127, 255, 0],
    "chocolate": [210, 105, 30],
    "coral": [255, 127, 80],
    "cornflowerblue": [100, 149, 237],
    "cornsilk": [255, 248, 220],
    "crimson": [220, 20, 60],
    "cyan": [0, 255, 255],
    "darkblue": [0, 0, 139],
    "darkcyan": [0, 139, 139],
    "darkgoldenrod": [184, 134, 11],
    "darkgray": [169, 169, 169],
    "darkgreen": [0, 100, 0],
    "darkgrey": [169, 169, 169],
    "darkkhaki": [189, 183, 107],
    "darkmagenta": [139, 0, 139],
    "darkolivegreen": [85, 107, 47],
    "darkorange": [255, 140, 0],
    "darkorchid": [153, 50, 204],
    "darkred": [139, 0, 0],
    "darksalmon": [233, 150, 122],
    "darkseagreen": [143, 188, 143],
    "darkslateblue": [72, 61, 139],
    "darkslategray": [47, 79, 79],
    "darkslategrey": [47, 79, 79],
    "darkturquoise": [0, 206, 209],
    "darkviolet": [148, 0, 211],
    "deeppink": [255, 20, 147],
    "deepskyblue": [0, 191, 255],
    "dimgray": [105, 105, 105],
    "dimgrey": [105, 105, 105],
    "dodgerblue": [30, 144, 255],
    "firebrick": [178, 34, 34],
    "floralwhite": [255, 250, 240],
    "forestgreen": [34, 139, 34],
    "fuchsia": [255, 0, 255],
    "gainsboro": [220, 220, 220],
    "ghostwhite": [248, 248, 255],
    "gold": [255, 215, 0],
    "goldenrod": [218, 165, 32],
    "gray": [128, 128, 128],
    "green": [0, 128, 0],
    "greenyellow": [173, 255, 47],
    "grey": [128, 128, 128],
    "honeydew": [240, 255, 240],
    "hotpink": [255, 105, 180],
    "indianred": [205, 92, 92],
    "indigo": [75, 0, 130],
    "ivory": [255, 255, 240],
    "khaki": [240, 230, 140],
    "lavender": [230, 230, 250],
    "lavenderblush": [255, 240, 245],
    "lawngreen": [124, 252, 0],
    "lemonchiffon": [255, 250, 205],
    "lightblue": [173, 216, 230],
    "lightcoral": [240, 128, 128],
    "lightcyan": [224, 255, 255],
    "lightgoldenrodyellow": [250, 250, 210],
    "lightgray": [211, 211, 211],
    "lightgreen": [144, 238, 144],
    "lightgrey": [211, 211, 211],
    "lightpink": [255, 182, 193],
    "lightsalmon": [255, 160, 122],
    "lightseagreen": [32, 178, 170],
    "lightskyblue": [135, 206, 250],
    "lightslategray": [119, 136, 153],
    "lightslategrey": [119, 136, 153],
    "lightsteelblue": [176, 196, 222],
    "lightyellow": [255, 255, 224],
    "lime": [0, 255, 0],
    "limegreen": [50, 205, 50],
    "linen": [250, 240, 230],
    "magenta": [255, 0, 255],
    "maroon": [128, 0, 0],
    "mediumaquamarine": [102, 205, 170],
    "mediumblue": [0, 0, 205],
    "mediumorchid": [186, 85, 211],
    "mediumpurple": [147, 112, 219],
    "mediumseagreen": [60, 179, 113],
    "mediumslateblue": [123, 104, 238],
    "mediumspringgreen": [0, 250, 154],
    "mediumturquoise": [72, 209, 204],
    "mediumvioletred": [199, 21, 133],
    "midnightblue": [25, 25, 112],
    "mintcream": [245, 255, 250],
    "mistyrose": [255, 228, 225],
    "moccasin": [255, 228, 181],
    "navajowhite": [255, 222, 173],
    "navy": [0, 0, 128],
    "oldlace": [253, 245, 230],
    "olive": [128, 128, 0],
    "olivedrab": [107, 142, 35],
    "orange": [255, 165, 0],
    "orangered": [255, 69, 0],
    "orchid": [218, 112, 214],
    "palegoldenrod": [238, 232, 170],
    "palegreen": [152, 251, 152],
    "paleturquoise": [175, 238, 238],
    "palevioletred": [219, 112, 147],
    "papayawhip": [255, 239, 213],
    "peachpuff": [255, 218, 185],
    "peru": [205, 133, 63],
    "pink": [255, 192, 203],
    "plum": [221, 160, 221],
    "powderblue": [176, 224, 230],
    "purple": [128, 0, 128],
    "rebeccapurple": [102, 51, 153],
    "red": [255, 0, 0],
    "rosybrown": [188, 143, 143],
    "royalblue": [65, 105, 225],
    "saddlebrown": [139, 69, 19],
    "salmon": [250, 128, 114],
    "sandybrown": [244, 164, 96],
    "seagreen": [46, 139, 87],
    "seashell": [255, 245, 238],
    "sienna": [160, 82, 45],
    "silver": [192, 192, 192],
    "skyblue": [135, 206, 235],
    "slateblue": [106, 90, 205],
    "slategray": [112, 128, 144],
    "slategrey": [112, 128, 144],
    "snow": [255, 250, 250],
    "springgreen": [0, 255, 127],
    "steelblue": [70, 130, 180],
    "tan": [210, 180, 140],
    "teal": [0, 128, 128],
    "thistle": [216, 191, 216],
    "tomato": [255, 99, 71],
    "turquoise": [64, 224, 208],
    "violet": [238, 130, 238],
    "wheat": [245, 222, 179],
    "white": [255, 255, 255],
    "whitesmoke": [245, 245, 245],
    "yellow": [255, 255, 0],
    "yellowgreen": [154, 205, 50]
};
var conversions$1 = createCommonjsModule(function (module) {
    /* MIT license */
    var cssKeywords = index$44;
    // NOTE: conversions should only return primitive values (i.e. arrays, or
    //       values that give correct `typeof` results).
    //       do not use box values types (i.e. Number(), String(), etc.)
    var reverseKeywords = {};
    for (var key in cssKeywords) {
        if (cssKeywords.hasOwnProperty(key)) {
            reverseKeywords[cssKeywords[key]] = key;
        }
    }
    var convert = module.exports = {
        rgb: { channels: 3, labels: 'rgb' },
        hsl: { channels: 3, labels: 'hsl' },
        hsv: { channels: 3, labels: 'hsv' },
        hwb: { channels: 3, labels: 'hwb' },
        cmyk: { channels: 4, labels: 'cmyk' },
        xyz: { channels: 3, labels: 'xyz' },
        lab: { channels: 3, labels: 'lab' },
        lch: { channels: 3, labels: 'lch' },
        hex: { channels: 1, labels: ['hex'] },
        keyword: { channels: 1, labels: ['keyword'] },
        ansi16: { channels: 1, labels: ['ansi16'] },
        ansi256: { channels: 1, labels: ['ansi256'] },
        hcg: { channels: 3, labels: ['h', 'c', 'g'] },
        apple: { channels: 3, labels: ['r16', 'g16', 'b16'] },
        gray: { channels: 1, labels: ['gray'] }
    };
    // hide .channels and .labels properties
    for (var model in convert) {
        if (convert.hasOwnProperty(model)) {
            if (!('channels' in convert[model])) {
                throw new Error('missing channels property: ' + model);
            }
            if (!('labels' in convert[model])) {
                throw new Error('missing channel labels property: ' + model);
            }
            if (convert[model].labels.length !== convert[model].channels) {
                throw new Error('channel and label counts mismatch: ' + model);
            }
            var channels = convert[model].channels;
            var labels = convert[model].labels;
            delete convert[model].channels;
            delete convert[model].labels;
            Object.defineProperty(convert[model], 'channels', { value: channels });
            Object.defineProperty(convert[model], 'labels', { value: labels });
        }
    }
    convert.rgb.hsl = function (rgb) {
        var r = rgb[0] / 255;
        var g = rgb[1] / 255;
        var b = rgb[2] / 255;
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        var delta = max - min;
        var h;
        var s;
        var l;
        if (max === min) {
            h = 0;
        }
        else if (r === max) {
            h = (g - b) / delta;
        }
        else if (g === max) {
            h = 2 + (b - r) / delta;
        }
        else if (b === max) {
            h = 4 + (r - g) / delta;
        }
        h = Math.min(h * 60, 360);
        if (h < 0) {
            h += 360;
        }
        l = (min + max) / 2;
        if (max === min) {
            s = 0;
        }
        else if (l <= 0.5) {
            s = delta / (max + min);
        }
        else {
            s = delta / (2 - max - min);
        }
        return [h, s * 100, l * 100];
    };
    convert.rgb.hsv = function (rgb) {
        var r = rgb[0];
        var g = rgb[1];
        var b = rgb[2];
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        var delta = max - min;
        var h;
        var s;
        var v;
        if (max === 0) {
            s = 0;
        }
        else {
            s = (delta / max * 1000) / 10;
        }
        if (max === min) {
            h = 0;
        }
        else if (r === max) {
            h = (g - b) / delta;
        }
        else if (g === max) {
            h = 2 + (b - r) / delta;
        }
        else if (b === max) {
            h = 4 + (r - g) / delta;
        }
        h = Math.min(h * 60, 360);
        if (h < 0) {
            h += 360;
        }
        v = ((max / 255) * 1000) / 10;
        return [h, s, v];
    };
    convert.rgb.hwb = function (rgb) {
        var r = rgb[0];
        var g = rgb[1];
        var b = rgb[2];
        var h = convert.rgb.hsl(rgb)[0];
        var w = 1 / 255 * Math.min(r, Math.min(g, b));
        b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));
        return [h, w * 100, b * 100];
    };
    convert.rgb.cmyk = function (rgb) {
        var r = rgb[0] / 255;
        var g = rgb[1] / 255;
        var b = rgb[2] / 255;
        var c;
        var m;
        var y;
        var k;
        k = Math.min(1 - r, 1 - g, 1 - b);
        c = (1 - r - k) / (1 - k) || 0;
        m = (1 - g - k) / (1 - k) || 0;
        y = (1 - b - k) / (1 - k) || 0;
        return [c * 100, m * 100, y * 100, k * 100];
    };
    /**
     * See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
     * */
    function comparativeDistance(x, y) {
        return (Math.pow(x[0] - y[0], 2) +
            Math.pow(x[1] - y[1], 2) +
            Math.pow(x[2] - y[2], 2));
    }
    convert.rgb.keyword = function (rgb) {
        var reversed = reverseKeywords[rgb];
        if (reversed) {
            return reversed;
        }
        var currentClosestDistance = Infinity;
        var currentClosestKeyword;
        for (var keyword in cssKeywords) {
            if (cssKeywords.hasOwnProperty(keyword)) {
                var value = cssKeywords[keyword];
                // Compute comparative distance
                var distance = comparativeDistance(rgb, value);
                // Check if its less, if so set as closest
                if (distance < currentClosestDistance) {
                    currentClosestDistance = distance;
                    currentClosestKeyword = keyword;
                }
            }
        }
        return currentClosestKeyword;
    };
    convert.keyword.rgb = function (keyword) {
        return cssKeywords[keyword];
    };
    convert.rgb.xyz = function (rgb) {
        var r = rgb[0] / 255;
        var g = rgb[1] / 255;
        var b = rgb[2] / 255;
        // assume sRGB
        r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
        g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
        b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);
        var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
        var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
        var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);
        return [x * 100, y * 100, z * 100];
    };
    convert.rgb.lab = function (rgb) {
        var xyz = convert.rgb.xyz(rgb);
        var x = xyz[0];
        var y = xyz[1];
        var z = xyz[2];
        var l;
        var a;
        var b;
        x /= 95.047;
        y /= 100;
        z /= 108.883;
        x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
        y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
        z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);
        l = (116 * y) - 16;
        a = 500 * (x - y);
        b = 200 * (y - z);
        return [l, a, b];
    };
    convert.hsl.rgb = function (hsl) {
        var h = hsl[0] / 360;
        var s = hsl[1] / 100;
        var l = hsl[2] / 100;
        var t1;
        var t2;
        var t3;
        var rgb;
        var val;
        if (s === 0) {
            val = l * 255;
            return [val, val, val];
        }
        if (l < 0.5) {
            t2 = l * (1 + s);
        }
        else {
            t2 = l + s - l * s;
        }
        t1 = 2 * l - t2;
        rgb = [0, 0, 0];
        for (var i = 0; i < 3; i++) {
            t3 = h + 1 / 3 * -(i - 1);
            if (t3 < 0) {
                t3++;
            }
            if (t3 > 1) {
                t3--;
            }
            if (6 * t3 < 1) {
                val = t1 + (t2 - t1) * 6 * t3;
            }
            else if (2 * t3 < 1) {
                val = t2;
            }
            else if (3 * t3 < 2) {
                val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
            }
            else {
                val = t1;
            }
            rgb[i] = val * 255;
        }
        return rgb;
    };
    convert.hsl.hsv = function (hsl) {
        var h = hsl[0];
        var s = hsl[1] / 100;
        var l = hsl[2] / 100;
        var smin = s;
        var lmin = Math.max(l, 0.01);
        var sv;
        var v;
        l *= 2;
        s *= (l <= 1) ? l : 2 - l;
        smin *= lmin <= 1 ? lmin : 2 - lmin;
        v = (l + s) / 2;
        sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);
        return [h, sv * 100, v * 100];
    };
    convert.hsv.rgb = function (hsv) {
        var h = hsv[0] / 60;
        var s = hsv[1] / 100;
        var v = hsv[2] / 100;
        var hi = Math.floor(h) % 6;
        var f = h - Math.floor(h);
        var p = 255 * v * (1 - s);
        var q = 255 * v * (1 - (s * f));
        var t = 255 * v * (1 - (s * (1 - f)));
        v *= 255;
        switch (hi) {
            case 0:
                return [v, t, p];
            case 1:
                return [q, v, p];
            case 2:
                return [p, v, t];
            case 3:
                return [p, q, v];
            case 4:
                return [t, p, v];
            case 5:
                return [v, p, q];
        }
    };
    convert.hsv.hsl = function (hsv) {
        var h = hsv[0];
        var s = hsv[1] / 100;
        var v = hsv[2] / 100;
        var vmin = Math.max(v, 0.01);
        var lmin;
        var sl;
        var l;
        l = (2 - s) * v;
        lmin = (2 - s) * vmin;
        sl = s * vmin;
        sl /= (lmin <= 1) ? lmin : 2 - lmin;
        sl = sl || 0;
        l /= 2;
        return [h, sl * 100, l * 100];
    };
    // http://dev.w3.org/csswg/css-color/#hwb-to-rgb
    convert.hwb.rgb = function (hwb) {
        var h = hwb[0] / 360;
        var wh = hwb[1] / 100;
        var bl = hwb[2] / 100;
        var ratio = wh + bl;
        var i;
        var v;
        var f;
        var n;
        // wh + bl cant be > 1
        if (ratio > 1) {
            wh /= ratio;
            bl /= ratio;
        }
        i = Math.floor(6 * h);
        v = 1 - bl;
        f = 6 * h - i;
        if ((i & 0x01) !== 0) {
            f = 1 - f;
        }
        n = wh + f * (v - wh); // linear interpolation
        var r;
        var g;
        var b;
        switch (i) {
            default:
            case 6:
            case 0:
                r = v;
                g = n;
                b = wh;
                break;
            case 1:
                r = n;
                g = v;
                b = wh;
                break;
            case 2:
                r = wh;
                g = v;
                b = n;
                break;
            case 3:
                r = wh;
                g = n;
                b = v;
                break;
            case 4:
                r = n;
                g = wh;
                b = v;
                break;
            case 5:
                r = v;
                g = wh;
                b = n;
                break;
        }
        return [r * 255, g * 255, b * 255];
    };
    convert.cmyk.rgb = function (cmyk) {
        var c = cmyk[0] / 100;
        var m = cmyk[1] / 100;
        var y = cmyk[2] / 100;
        var k = cmyk[3] / 100;
        var r;
        var g;
        var b;
        r = 1 - Math.min(1, c * (1 - k) + k);
        g = 1 - Math.min(1, m * (1 - k) + k);
        b = 1 - Math.min(1, y * (1 - k) + k);
        return [r * 255, g * 255, b * 255];
    };
    convert.xyz.rgb = function (xyz) {
        var x = xyz[0] / 100;
        var y = xyz[1] / 100;
        var z = xyz[2] / 100;
        var r;
        var g;
        var b;
        r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
        g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
        b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);
        // assume sRGB
        r = r > 0.0031308
            ? ((1.055 * Math.pow(r, 1.0 / 2.4)) - 0.055)
            : r * 12.92;
        g = g > 0.0031308
            ? ((1.055 * Math.pow(g, 1.0 / 2.4)) - 0.055)
            : g * 12.92;
        b = b > 0.0031308
            ? ((1.055 * Math.pow(b, 1.0 / 2.4)) - 0.055)
            : b * 12.92;
        r = Math.min(Math.max(0, r), 1);
        g = Math.min(Math.max(0, g), 1);
        b = Math.min(Math.max(0, b), 1);
        return [r * 255, g * 255, b * 255];
    };
    convert.xyz.lab = function (xyz) {
        var x = xyz[0];
        var y = xyz[1];
        var z = xyz[2];
        var l;
        var a;
        var b;
        x /= 95.047;
        y /= 100;
        z /= 108.883;
        x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
        y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
        z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);
        l = (116 * y) - 16;
        a = 500 * (x - y);
        b = 200 * (y - z);
        return [l, a, b];
    };
    convert.lab.xyz = function (lab) {
        var l = lab[0];
        var a = lab[1];
        var b = lab[2];
        var x;
        var y;
        var z;
        y = (l + 16) / 116;
        x = a / 500 + y;
        z = y - b / 200;
        var y2 = Math.pow(y, 3);
        var x2 = Math.pow(x, 3);
        var z2 = Math.pow(z, 3);
        y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
        x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
        z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;
        x *= 95.047;
        y *= 100;
        z *= 108.883;
        return [x, y, z];
    };
    convert.lab.lch = function (lab) {
        var l = lab[0];
        var a = lab[1];
        var b = lab[2];
        var hr;
        var h;
        var c;
        hr = Math.atan2(b, a);
        h = hr * 360 / 2 / Math.PI;
        if (h < 0) {
            h += 360;
        }
        c = Math.sqrt(a * a + b * b);
        return [l, c, h];
    };
    convert.lch.lab = function (lch) {
        var l = lch[0];
        var c = lch[1];
        var h = lch[2];
        var a;
        var b;
        var hr;
        hr = h / 360 * 2 * Math.PI;
        a = c * Math.cos(hr);
        b = c * Math.sin(hr);
        return [l, a, b];
    };
    convert.rgb.ansi16 = function (args) {
        var r = args[0];
        var g = args[1];
        var b = args[2];
        var value = 1 in arguments ? arguments[1] : convert.rgb.hsv(args)[2]; // hsv -> ansi16 optimization
        value = Math.round(value / 50);
        if (value === 0) {
            return 30;
        }
        var ansi = 30
            + ((Math.round(b / 255) << 2)
                | (Math.round(g / 255) << 1)
                | Math.round(r / 255));
        if (value === 2) {
            ansi += 60;
        }
        return ansi;
    };
    convert.hsv.ansi16 = function (args) {
        // optimization here; we already know the value and don't need to get
        // it converted for us.
        return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
    };
    convert.rgb.ansi256 = function (args) {
        var r = args[0];
        var g = args[1];
        var b = args[2];
        // we use the extended greyscale palette here, with the exception of
        // black and white. normal palette only has 4 greyscale shades.
        if (r === g && g === b) {
            if (r < 8) {
                return 16;
            }
            if (r > 248) {
                return 231;
            }
            return Math.round(((r - 8) / 247) * 24) + 232;
        }
        var ansi = 16
            + (36 * Math.round(r / 255 * 5))
            + (6 * Math.round(g / 255 * 5))
            + Math.round(b / 255 * 5);
        return ansi;
    };
    convert.ansi16.rgb = function (args) {
        var color = args % 10;
        // handle greyscale
        if (color === 0 || color === 7) {
            if (args > 50) {
                color += 3.5;
            }
            color = color / 10.5 * 255;
            return [color, color, color];
        }
        var mult = (~~(args > 50) + 1) * 0.5;
        var r = ((color & 1) * mult) * 255;
        var g = (((color >> 1) & 1) * mult) * 255;
        var b = (((color >> 2) & 1) * mult) * 255;
        return [r, g, b];
    };
    convert.ansi256.rgb = function (args) {
        // handle greyscale
        if (args >= 232) {
            var c = (args - 232) * 10 + 8;
            return [c, c, c];
        }
        args -= 16;
        var rem;
        var r = Math.floor(args / 36) / 5 * 255;
        var g = Math.floor((rem = args % 36) / 6) / 5 * 255;
        var b = (rem % 6) / 5 * 255;
        return [r, g, b];
    };
    convert.rgb.hex = function (args) {
        var integer = ((Math.round(args[0]) & 0xFF) << 16)
            + ((Math.round(args[1]) & 0xFF) << 8)
            + (Math.round(args[2]) & 0xFF);
        var string = integer.toString(16).toUpperCase();
        return '000000'.substring(string.length) + string;
    };
    convert.hex.rgb = function (args) {
        var match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
        if (!match) {
            return [0, 0, 0];
        }
        var colorString = match[0];
        if (match[0].length === 3) {
            colorString = colorString.split('').map(function (char) {
                return char + char;
            }).join('');
        }
        var integer = parseInt(colorString, 16);
        var r = (integer >> 16) & 0xFF;
        var g = (integer >> 8) & 0xFF;
        var b = integer & 0xFF;
        return [r, g, b];
    };
    convert.rgb.hcg = function (rgb) {
        var r = rgb[0] / 255;
        var g = rgb[1] / 255;
        var b = rgb[2] / 255;
        var max = Math.max(Math.max(r, g), b);
        var min = Math.min(Math.min(r, g), b);
        var chroma = (max - min);
        var grayscale;
        var hue;
        if (chroma < 1) {
            grayscale = min / (1 - chroma);
        }
        else {
            grayscale = 0;
        }
        if (chroma <= 0) {
            hue = 0;
        }
        else if (max === r) {
            hue = ((g - b) / chroma) % 6;
        }
        else if (max === g) {
            hue = 2 + (b - r) / chroma;
        }
        else {
            hue = 4 + (r - g) / chroma + 4;
        }
        hue /= 6;
        hue %= 1;
        return [hue * 360, chroma * 100, grayscale * 100];
    };
    convert.hsl.hcg = function (hsl) {
        var s = hsl[1] / 100;
        var l = hsl[2] / 100;
        var c = 1;
        var f = 0;
        if (l < 0.5) {
            c = 2.0 * s * l;
        }
        else {
            c = 2.0 * s * (1.0 - l);
        }
        if (c < 1.0) {
            f = (l - 0.5 * c) / (1.0 - c);
        }
        return [hsl[0], c * 100, f * 100];
    };
    convert.hsv.hcg = function (hsv) {
        var s = hsv[1] / 100;
        var v = hsv[2] / 100;
        var c = s * v;
        var f = 0;
        if (c < 1.0) {
            f = (v - c) / (1 - c);
        }
        return [hsv[0], c * 100, f * 100];
    };
    convert.hcg.rgb = function (hcg) {
        var h = hcg[0] / 360;
        var c = hcg[1] / 100;
        var g = hcg[2] / 100;
        if (c === 0.0) {
            return [g * 255, g * 255, g * 255];
        }
        var pure = [0, 0, 0];
        var hi = (h % 1) * 6;
        var v = hi % 1;
        var w = 1 - v;
        var mg = 0;
        switch (Math.floor(hi)) {
            case 0:
                pure[0] = 1;
                pure[1] = v;
                pure[2] = 0;
                break;
            case 1:
                pure[0] = w;
                pure[1] = 1;
                pure[2] = 0;
                break;
            case 2:
                pure[0] = 0;
                pure[1] = 1;
                pure[2] = v;
                break;
            case 3:
                pure[0] = 0;
                pure[1] = w;
                pure[2] = 1;
                break;
            case 4:
                pure[0] = v;
                pure[1] = 0;
                pure[2] = 1;
                break;
            default:
                pure[0] = 1;
                pure[1] = 0;
                pure[2] = w;
        }
        mg = (1.0 - c) * g;
        return [
            (c * pure[0] + mg) * 255,
            (c * pure[1] + mg) * 255,
            (c * pure[2] + mg) * 255
        ];
    };
    convert.hcg.hsv = function (hcg) {
        var c = hcg[1] / 100;
        var g = hcg[2] / 100;
        var v = c + g * (1.0 - c);
        var f = 0;
        if (v > 0.0) {
            f = c / v;
        }
        return [hcg[0], f * 100, v * 100];
    };
    convert.hcg.hsl = function (hcg) {
        var c = hcg[1] / 100;
        var g = hcg[2] / 100;
        var l = g * (1.0 - c) + 0.5 * c;
        var s = 0;
        if (l > 0.0 && l < 0.5) {
            s = c / (2 * l);
        }
        else if (l >= 0.5 && l < 1.0) {
            s = c / (2 * (1 - l));
        }
        return [hcg[0], s * 100, l * 100];
    };
    convert.hcg.hwb = function (hcg) {
        var c = hcg[1] / 100;
        var g = hcg[2] / 100;
        var v = c + g * (1.0 - c);
        return [hcg[0], (v - c) * 100, (1 - v) * 100];
    };
    convert.hwb.hcg = function (hwb) {
        var w = hwb[1] / 100;
        var b = hwb[2] / 100;
        var v = 1 - b;
        var c = v - w;
        var g = 0;
        if (c < 1) {
            g = (v - c) / (1 - c);
        }
        return [hwb[0], c * 100, g * 100];
    };
    convert.apple.rgb = function (apple) {
        return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
    };
    convert.rgb.apple = function (rgb) {
        return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
    };
    convert.gray.rgb = function (args) {
        return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
    };
    convert.gray.hsl = convert.gray.hsv = function (args) {
        return [0, 0, args[0]];
    };
    convert.gray.hwb = function (gray) {
        return [0, 100, gray[0]];
    };
    convert.gray.cmyk = function (gray) {
        return [0, 0, 0, gray[0]];
    };
    convert.gray.lab = function (gray) {
        return [gray[0], 0, 0];
    };
    convert.gray.hex = function (gray) {
        var val = Math.round(gray[0] / 100 * 255) & 0xFF;
        var integer = (val << 16) + (val << 8) + val;
        var string = integer.toString(16).toUpperCase();
        return '000000'.substring(string.length) + string;
    };
    convert.rgb.gray = function (rgb) {
        var val = (rgb[0] + rgb[1] + rgb[2]) / 3;
        return [val / 255 * 100];
    };
});
var conversions$3 = conversions$1;
/*
    this function routes a model to all other models.

    all functions that are routed have a property `.conversion` attached
    to the returned synthetic function. This property is an array
    of strings, each with the steps in between the 'from' and 'to'
    color models (inclusive).

    conversions that are not possible simply are not included.
*/
// https://jsperf.com/object-keys-vs-for-in-with-closure/3
var models$1 = Object.keys(conversions$3);
function buildGraph() {
    var graph = {};
    for (var len = models$1.length, i = 0; i < len; i++) {
        graph[models$1[i]] = {
            // http://jsperf.com/1-vs-infinity
            // micro-opt, but this is simple.
            distance: -1,
            parent: null
        };
    }
    return graph;
}
// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
    var graph = buildGraph();
    var queue = [fromModel]; // unshift -> queue -> pop
    graph[fromModel].distance = 0;
    while (queue.length) {
        var current = queue.pop();
        var adjacents = Object.keys(conversions$3[current]);
        for (var len = adjacents.length, i = 0; i < len; i++) {
            var adjacent = adjacents[i];
            var node = graph[adjacent];
            if (node.distance === -1) {
                node.distance = graph[current].distance + 1;
                node.parent = current;
                queue.unshift(adjacent);
            }
        }
    }
    return graph;
}
function link(from, to) {
    return function (args) {
        return to(from(args));
    };
}
function wrapConversion(toModel, graph) {
    var path = [graph[toModel].parent, toModel];
    var fn = conversions$3[graph[toModel].parent][toModel];
    var cur = graph[toModel].parent;
    while (graph[cur].parent) {
        path.unshift(graph[cur].parent);
        fn = link(conversions$3[graph[cur].parent][cur], fn);
        cur = graph[cur].parent;
    }
    fn.conversion = path;
    return fn;
}
var route$1 = function (fromModel) {
    var graph = deriveBFS(fromModel);
    var conversion = {};
    var models = Object.keys(graph);
    for (var len = models.length, i = 0; i < len; i++) {
        var toModel = models[i];
        var node = graph[toModel];
        if (node.parent === null) {
            // no possible conversion, or this node is the source model.
            continue;
        }
        conversion[toModel] = wrapConversion(toModel, graph);
    }
    return conversion;
};
var conversions = conversions$1;
var route = route$1;
var convert = {};
var models = Object.keys(conversions);
function wrapRaw(fn) {
    var wrappedFn = function (args) {
        if (args === undefined || args === null) {
            return args;
        }
        if (arguments.length > 1) {
            args = Array.prototype.slice.call(arguments);
        }
        return fn(args);
    };
    // preserve .conversion property if there is one
    if ('conversion' in fn) {
        wrappedFn.conversion = fn.conversion;
    }
    return wrappedFn;
}
function wrapRounded(fn) {
    var wrappedFn = function (args) {
        if (args === undefined || args === null) {
            return args;
        }
        if (arguments.length > 1) {
            args = Array.prototype.slice.call(arguments);
        }
        var result = fn(args);
        // we're assuming the result is an array here.
        // see notice in conversions.js; don't use box types
        // in conversion functions.
        if (typeof result === 'object') {
            for (var len = result.length, i = 0; i < len; i++) {
                result[i] = Math.round(result[i]);
            }
        }
        return result;
    };
    // preserve .conversion property if there is one
    if ('conversion' in fn) {
        wrappedFn.conversion = fn.conversion;
    }
    return wrappedFn;
}
models.forEach(function (fromModel) {
    convert[fromModel] = {};
    Object.defineProperty(convert[fromModel], 'channels', { value: conversions[fromModel].channels });
    Object.defineProperty(convert[fromModel], 'labels', { value: conversions[fromModel].labels });
    var routes = route(fromModel);
    var routeModels = Object.keys(routes);
    routeModels.forEach(function (toModel) {
        var fn = routes[toModel];
        convert[fromModel][toModel] = wrapRounded(fn);
        convert[fromModel][toModel].raw = wrapRaw(fn);
    });
});
var index$42 = convert;
var index$40 = createCommonjsModule(function (module) {
    'use strict';
    const colorConvert = index$42;
    const wrapAnsi16 = (fn, offset) => function () {
        const code = fn.apply(colorConvert, arguments);
        return `\u001B[${code + offset}m`;
    };
    const wrapAnsi256 = (fn, offset) => function () {
        const code = fn.apply(colorConvert, arguments);
        return `\u001B[${38 + offset};5;${code}m`;
    };
    const wrapAnsi16m = (fn, offset) => function () {
        const rgb = fn.apply(colorConvert, arguments);
        return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    };
    function assembleStyles() {
        const styles = {
            modifier: {
                reset: [0, 0],
                // 21 isn't widely supported and 22 does the same thing
                bold: [1, 22],
                dim: [2, 22],
                italic: [3, 23],
                underline: [4, 24],
                inverse: [7, 27],
                hidden: [8, 28],
                strikethrough: [9, 29]
            },
            color: {
                black: [30, 39],
                red: [31, 39],
                green: [32, 39],
                yellow: [33, 39],
                blue: [34, 39],
                magenta: [35, 39],
                cyan: [36, 39],
                white: [37, 39],
                gray: [90, 39],
                // Bright color
                redBright: [91, 39],
                greenBright: [92, 39],
                yellowBright: [93, 39],
                blueBright: [94, 39],
                magentaBright: [95, 39],
                cyanBright: [96, 39],
                whiteBright: [97, 39]
            },
            bgColor: {
                bgBlack: [40, 49],
                bgRed: [41, 49],
                bgGreen: [42, 49],
                bgYellow: [43, 49],
                bgBlue: [44, 49],
                bgMagenta: [45, 49],
                bgCyan: [46, 49],
                bgWhite: [47, 49],
                // Bright color
                bgBlackBright: [100, 49],
                bgRedBright: [101, 49],
                bgGreenBright: [102, 49],
                bgYellowBright: [103, 49],
                bgBlueBright: [104, 49],
                bgMagentaBright: [105, 49],
                bgCyanBright: [106, 49],
                bgWhiteBright: [107, 49]
            }
        };
        // Fix humans
        styles.color.grey = styles.color.gray;
        Object.keys(styles).forEach(groupName => {
            const group = styles[groupName];
            Object.keys(group).forEach(styleName => {
                const style = group[styleName];
                styles[styleName] = {
                    open: `\u001B[${style[0]}m`,
                    close: `\u001B[${style[1]}m`
                };
                group[styleName] = styles[styleName];
            });
            Object.defineProperty(styles, groupName, {
                value: group,
                enumerable: false
            });
        });
        const rgb2rgb = (r, g, b) => [r, g, b];
        styles.color.close = '\u001B[39m';
        styles.bgColor.close = '\u001B[49m';
        styles.color.ansi = {};
        styles.color.ansi256 = {};
        styles.color.ansi16m = {
            rgb: wrapAnsi16m(rgb2rgb, 0)
        };
        styles.bgColor.ansi = {};
        styles.bgColor.ansi256 = {};
        styles.bgColor.ansi16m = {
            rgb: wrapAnsi16m(rgb2rgb, 10)
        };
        for (const key of Object.keys(colorConvert)) {
            if (typeof colorConvert[key] !== 'object') {
                continue;
            }
            const suite = colorConvert[key];
            if ('ansi16' in suite) {
                styles.color.ansi[key] = wrapAnsi16(suite.ansi16, 0);
                styles.bgColor.ansi[key] = wrapAnsi16(suite.ansi16, 10);
            }
            if ('ansi256' in suite) {
                styles.color.ansi256[key] = wrapAnsi256(suite.ansi256, 0);
                styles.bgColor.ansi256[key] = wrapAnsi256(suite.ansi256, 10);
            }
            if ('rgb' in suite) {
                styles.color.ansi16m[key] = wrapAnsi16m(suite.rgb, 0);
                styles.bgColor.ansi16m[key] = wrapAnsi16m(suite.rgb, 10);
            }
        }
        return styles;
    }
    Object.defineProperty(module, 'exports', {
        enumerable: true,
        get: assembleStyles
    });
});
const asymmetricMatcher = Symbol.for('jest.asymmetricMatcher'); /**
                                                                 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                                 *
                                                                 * This source code is licensed under the BSD-style license found in the
                                                                 * LICENSE file in the root directory of this source tree. An additional grant
                                                                 * of patent rights can be found in the PATENTS file in the same directory.
                                                                 *
                                                                 *
                                                                 */
const SPACE = ' ';
class ArrayContaining extends Array {
}
class ObjectContaining extends Object {
}
const print$1 = (val, print, indent, opts, colors) => {
    const stringedValue = val.toString();
    if (stringedValue === 'ArrayContaining') {
        const array = ArrayContaining.from(val.sample);
        return opts.spacing === SPACE ?
            stringedValue + SPACE + print(array) :
            print(array);
    }
    if (stringedValue === 'ObjectContaining') {
        const object = Object.assign(new ObjectContaining(), val.sample);
        return opts.spacing === SPACE ?
            stringedValue + SPACE + print(object) :
            print(object);
    }
    if (stringedValue === 'StringMatching') {
        return stringedValue + SPACE + print(val.sample);
    }
    if (stringedValue === 'StringContaining') {
        return stringedValue + SPACE + print(val.sample);
    }
    return val.toAsymmetricMatcher();
};
const test = object => object && object.$$typeof === asymmetricMatcher;
var AsymmetricMatcher$1 = { print: print$1, test };
const ansiRegex$2 = index$16; /**
                                          * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                          *
                                          * This source code is licensed under the BSD-style license found in the
                                          * LICENSE file in the root directory of this source tree. An additional grant
                                          * of patent rights can be found in the PATENTS file in the same directory.
                                          *
                                          *
                                          */
const toHumanReadableAnsi = text => {
    const style = index$40;
    return text.replace(ansiRegex$2(), (match, offset, string) => {
        switch (match) {
            case style.red.close:
            case style.green.close:
            case style.reset.open:
            case style.reset.close:
                return '</>';
            case style.red.open:
                return '<red>';
            case style.green.open:
                return '<green>';
            case style.dim.open:
                return '<dim>';
            case style.bold.open:
                return '<bold>';
            default:
                return '';
        }
    });
};
const test$1 = value => typeof value === 'string' && value.match(ansiRegex$2());
const print$2 = (val, print, indent, opts, colors) => print(toHumanReadableAnsi(val));
var ConvertAnsi = { print: print$2, test: test$1 };
function escapeHTML$1(str) {
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
var escapeHTML_1 = escapeHTML$1;
const escapeHTML = escapeHTML_1; /**
                                                 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                 *
                                                 * This source code is licensed under the BSD-style license found in the
                                                 * LICENSE file in the root directory of this source tree. An additional grant
                                                 * of patent rights can be found in the PATENTS file in the same directory.
                                                 *
                                                 *
                                                 */
const HTML_ELEMENT_REGEXP = /(HTML\w*?Element)|Text|Comment/;
const test$2 = isHTMLElement;
function isHTMLElement(value) {
    return (value !== undefined &&
        value !== null && (value.nodeType === 1 || value.nodeType === 3 || value.nodeType === 8) &&
        value.constructor !== undefined &&
        value.constructor.name !== undefined &&
        HTML_ELEMENT_REGEXP.test(value.constructor.name));
}
function printChildren$1(flatChildren, print, indent, colors, opts) {
    return flatChildren.
        map(node => {
        if (typeof node === 'object') {
            return print(node, print, indent, colors, opts);
        }
        else if (typeof node === 'string') {
            return colors.content.open + escapeHTML(node) + colors.content.close;
        }
        else {
            return print(node);
        }
    }).
        filter(value => value.trim().length).
        join(opts.edgeSpacing);
}
function printAttributes$1(attributes, indent, colors, opts) {
    return attributes.
        sort().
        map(attribute => {
        return (opts.spacing +
            indent(colors.prop.open + attribute.name + colors.prop.close + '=') +
            colors.value.open +
            `"${attribute.value}"` +
            colors.value.close);
    }).
        join('');
}
const print$3 = (element, print, indent, opts, colors) => {
    if (element.nodeType === 3) {
        return element.data.
            split('\n').
            map(text => text.trimLeft()).
            filter(text => text.length).
            join(' ');
    }
    else if (element.nodeType === 8) {
        return (colors.comment.open +
            '<!-- ' +
            element.data.trim() +
            ' -->' +
            colors.comment.close);
    }
    let result = colors.tag.open + '<';
    const elementName = element.tagName.toLowerCase();
    result += elementName + colors.tag.close;
    const hasAttributes = element.attributes && element.attributes.length;
    if (hasAttributes) {
        const attributes = Array.prototype.slice.call(element.attributes);
        result += printAttributes$1(attributes, indent, colors, opts);
    }
    const flatChildren = Array.prototype.slice.call(element.childNodes);
    if (!flatChildren.length && element.textContent) {
        flatChildren.push(element.textContent);
    }
    const closeInNewLine = hasAttributes && !opts.min;
    if (flatChildren.length) {
        const children = printChildren$1(flatChildren, print, indent, colors, opts);
        result +=
            colors.tag.open + (closeInNewLine ? '\n' : '') +
                '>' +
                colors.tag.close +
                opts.edgeSpacing +
                indent(children) +
                opts.edgeSpacing +
                colors.tag.open +
                '</' +
                elementName +
                '>' +
                colors.tag.close;
    }
    else {
        result +=
            colors.tag.open + (closeInNewLine ? '\n' : ' ') + '/>' + colors.tag.close;
    }
    return result;
};
var HTMLElement$1 = { print: print$3, test: test$2 };
var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try {
    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);
        if (i && _arr.length === i)
            break;
    }
}
catch (err) {
    _d = true;
    _e = err;
}
finally {
    try {
        if (!_n && _i["return"])
            _i["return"]();
    }
    finally {
        if (_d)
            throw _e;
    }
} return _arr; } return function (arr, i) { if (Array.isArray(arr)) {
    return arr;
}
else if (Symbol.iterator in Object(arr)) {
    return sliceIterator(arr, i);
}
else {
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
} }; }();
const IMMUTABLE_NAMESPACE = 'Immutable.'; /**
                                           * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                           *
                                           * This source code is licensed under the BSD-style license found in the
                                           * LICENSE file in the root directory of this source tree. An additional grant
                                           * of patent rights can be found in the PATENTS file in the same directory.
                                           *
                                           *
                                           */
const SPACE$1 = ' ';
const addKey = (isMap, key) => isMap ? key + ': ' : '';
const addFinalEdgeSpacing = (length, edgeSpacing) => length > 0 ? edgeSpacing : '';
const printImmutable$1 = (val, print, indent, opts, colors, immutableDataStructureName, isMap) => {
    var _ref = isMap ? ['{', '}'] : ['[', ']'], _ref2 = _slicedToArray(_ref, 2);
    const openTag = _ref2[0], closeTag = _ref2[1];
    let result = IMMUTABLE_NAMESPACE +
        immutableDataStructureName +
        SPACE$1 +
        openTag +
        opts.edgeSpacing;
    const immutableArray = [];
    val.forEach((item, key) => immutableArray.push(indent(addKey(isMap, key) + print(item, print, indent, opts, colors))));
    result += immutableArray.join(',' + opts.spacing);
    if (!opts.min && immutableArray.length > 0) {
        result += ',';
    }
    return (result +
        addFinalEdgeSpacing(immutableArray.length, opts.edgeSpacing) +
        closeTag);
};
var printImmutable_1 = printImmutable$1;
const printImmutable = printImmutable_1; /**
                                                         * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                         *
                                                         * This source code is licensed under the BSD-style license found in the
                                                         * LICENSE file in the root directory of this source tree. An additional grant
                                                         * of patent rights can be found in the PATENTS file in the same directory.
                                                         *
                                                         *
                                                         */
const IS_LIST = '@@__IMMUTABLE_LIST__@@';
const test$3 = maybeList => !!(maybeList && maybeList[IS_LIST]);
const print$4 = (val, print, indent, opts, colors) => printImmutable(val, print, indent, opts, colors, 'List', false);
var ImmutableList = { print: print$4, test: test$3 };
const printImmutable$2 = printImmutable_1; /**
                                                         * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                         *
                                                         * This source code is licensed under the BSD-style license found in the
                                                         * LICENSE file in the root directory of this source tree. An additional grant
                                                         * of patent rights can be found in the PATENTS file in the same directory.
                                                         *
                                                         *
                                                         */
const IS_SET = '@@__IMMUTABLE_SET__@@';
const IS_ORDERED = '@@__IMMUTABLE_ORDERED__@@';
const test$4 = maybeSet => !!(maybeSet && maybeSet[IS_SET] && !maybeSet[IS_ORDERED]);
const print$5 = (val, print, indent, opts, colors) => printImmutable$2(val, print, indent, opts, colors, 'Set', false);
var ImmutableSet = { print: print$5, test: test$4 };
const printImmutable$3 = printImmutable_1; /**
                                                         * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                         *
                                                         * This source code is licensed under the BSD-style license found in the
                                                         * LICENSE file in the root directory of this source tree. An additional grant
                                                         * of patent rights can be found in the PATENTS file in the same directory.
                                                         *
                                                         *
                                                         */
const IS_MAP = '@@__IMMUTABLE_MAP__@@';
const IS_ORDERED$1 = '@@__IMMUTABLE_ORDERED__@@';
const test$5 = maybeMap => !!(maybeMap && maybeMap[IS_MAP] && !maybeMap[IS_ORDERED$1]);
const print$6 = (val, print, indent, opts, colors) => printImmutable$3(val, print, indent, opts, colors, 'Map', true);
var ImmutableMap = { print: print$6, test: test$5 };
const printImmutable$4 = printImmutable_1; /**
                                                         * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                         *
                                                         * This source code is licensed under the BSD-style license found in the
                                                         * LICENSE file in the root directory of this source tree. An additional grant
                                                         * of patent rights can be found in the PATENTS file in the same directory.
                                                         *
                                                         *
                                                         */
const IS_STACK = '@@__IMMUTABLE_STACK__@@';
const test$6 = maybeStack => !!(maybeStack && maybeStack[IS_STACK]);
const print$7 = (val, print, indent, opts, colors) => printImmutable$4(val, print, indent, opts, colors, 'Stack', false);
var ImmutableStack = { print: print$7, test: test$6 };
const printImmutable$5 = printImmutable_1; /**
                                                         * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                         *
                                                         * This source code is licensed under the BSD-style license found in the
                                                         * LICENSE file in the root directory of this source tree. An additional grant
                                                         * of patent rights can be found in the PATENTS file in the same directory.
                                                         *
                                                         *
                                                         */
const IS_SET$1 = '@@__IMMUTABLE_SET__@@';
const IS_ORDERED$2 = '@@__IMMUTABLE_ORDERED__@@';
const test$7 = maybeOrderedSet => maybeOrderedSet && maybeOrderedSet[IS_SET$1] && maybeOrderedSet[IS_ORDERED$2];
const print$8 = (val, print, indent, opts, colors) => printImmutable$5(val, print, indent, opts, colors, 'OrderedSet', false);
var ImmutableOrderedSet = { print: print$8, test: test$7 };
const printImmutable$6 = printImmutable_1; /**
                                                         * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                         *
                                                         * This source code is licensed under the BSD-style license found in the
                                                         * LICENSE file in the root directory of this source tree. An additional grant
                                                         * of patent rights can be found in the PATENTS file in the same directory.
                                                         *
                                                         *
                                                         */
const IS_MAP$1 = '@@__IMMUTABLE_MAP__@@';
const IS_ORDERED$3 = '@@__IMMUTABLE_ORDERED__@@';
const test$8 = maybeOrderedMap => maybeOrderedMap && maybeOrderedMap[IS_MAP$1] && maybeOrderedMap[IS_ORDERED$3];
const print$9 = (val, print, indent, opts, colors) => printImmutable$6(val, print, indent, opts, colors, 'OrderedMap', true);
var ImmutableOrderedMap = { print: print$9, test: test$8 };
var ImmutablePlugins = [
    ImmutableList,
    ImmutableSet,
    ImmutableMap,
    ImmutableStack,
    ImmutableOrderedSet,
    ImmutableOrderedMap
];
const escapeHTML$2 = escapeHTML_1; /**
                                                 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                 *
                                                 * This source code is licensed under the BSD-style license found in the
                                                 * LICENSE file in the root directory of this source tree. An additional grant
                                                 * of patent rights can be found in the PATENTS file in the same directory.
                                                 *
                                                 *
                                                 */
const reactElement = Symbol.for('react.element');
function traverseChildren(opaqueChildren, cb) {
    if (Array.isArray(opaqueChildren)) {
        opaqueChildren.forEach(child => traverseChildren(child, cb));
    }
    else if (opaqueChildren != null && opaqueChildren !== false) {
        cb(opaqueChildren);
    }
}
function printChildren$2(flatChildren, print, indent, colors, opts) {
    return flatChildren.
        map(node => {
        if (typeof node === 'object') {
            return print(node, print, indent, colors, opts);
        }
        else if (typeof node === 'string') {
            return colors.content.open + escapeHTML$2(node) + colors.content.close;
        }
        else {
            return print(node);
        }
    }).
        join(opts.edgeSpacing);
}
function printProps(props, print, indent, colors, opts) {
    return Object.keys(props).
        sort().
        map(name => {
        if (name === 'children') {
            return '';
        }
        const prop = props[name];
        let printed = print(prop);
        if (typeof prop !== 'string') {
            if (printed.indexOf('\n') !== -1) {
                printed =
                    '{' +
                        opts.edgeSpacing +
                        indent(indent(printed) + opts.edgeSpacing + '}');
            }
            else {
                printed = '{' + printed + '}';
            }
        }
        return (opts.spacing +
            indent(colors.prop.open + name + colors.prop.close + '=') +
            colors.value.open +
            printed +
            colors.value.close);
    }).
        join('');
}
const print$10 = (element, print, indent, opts, colors) => {
    let result = colors.tag.open + '<';
    let elementName;
    if (typeof element.type === 'string') {
        elementName = element.type;
    }
    else if (typeof element.type === 'function') {
        elementName = element.type.displayName || element.type.name || 'Unknown';
    }
    else {
        elementName = 'Unknown';
    }
    result += elementName + colors.tag.close;
    result += printProps(element.props, print, indent, colors, opts);
    const opaqueChildren = element.props.children;
    const hasProps = !!Object.keys(element.props).filter(propName => propName !== 'children').
        length;
    const closeInNewLine = hasProps && !opts.min;
    if (opaqueChildren) {
        const flatChildren = [];
        traverseChildren(opaqueChildren, child => {
            flatChildren.push(child);
        });
        const children = printChildren$2(flatChildren, print, indent, colors, opts);
        result +=
            colors.tag.open + (closeInNewLine ? '\n' : '') +
                '>' +
                colors.tag.close +
                opts.edgeSpacing +
                indent(children) +
                opts.edgeSpacing +
                colors.tag.open +
                '</' +
                elementName +
                '>' +
                colors.tag.close;
    }
    else {
        result +=
            colors.tag.open + (closeInNewLine ? '\n' : ' ') + '/>' + colors.tag.close;
    }
    return result;
};
const test$9 = object => object && object.$$typeof === reactElement;
var ReactElement$1 = { print: print$10, test: test$9 };
const escapeHTML$3 = escapeHTML_1; /**
                                                 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                 *
                                                 * This source code is licensed under the BSD-style license found in the
                                                 * LICENSE file in the root directory of this source tree. An additional grant
                                                 * of patent rights can be found in the PATENTS file in the same directory.
                                                 *
                                                 *
                                                 */
const reactTestInstance = Symbol.for('react.test.json');
function printChildren$3(children, print, indent, colors, opts) {
    return children.
        map(child => printInstance(child, print, indent, colors, opts)).
        join(opts.edgeSpacing);
}
function printProps$1(props, print, indent, colors, opts) {
    return Object.keys(props).
        sort().
        map(name => {
        const prop = props[name];
        let printed = print(prop);
        if (typeof prop !== 'string') {
            if (printed.indexOf('\n') !== -1) {
                printed =
                    '{' +
                        opts.edgeSpacing +
                        indent(indent(printed) + opts.edgeSpacing + '}');
            }
            else {
                printed = '{' + printed + '}';
            }
        }
        return (opts.spacing +
            indent(colors.prop.open + name + colors.prop.close + '=') +
            colors.value.open +
            printed +
            colors.value.close);
    }).
        join('');
}
function printInstance(instance, print, indent, colors, opts) {
    if (typeof instance == 'number') {
        return print(instance);
    }
    else if (typeof instance === 'string') {
        return colors.content.open + escapeHTML$3(instance) + colors.content.close;
    }
    let closeInNewLine = false;
    let result = colors.tag.open + '<' + instance.type + colors.tag.close;
    if (instance.props) {
        closeInNewLine = !!Object.keys(instance.props).length && !opts.min;
        result += printProps$1(instance.props, print, indent, colors, opts);
    }
    if (instance.children) {
        const children = printChildren$3(instance.children, print, indent, colors, opts);
        result +=
            colors.tag.open + (closeInNewLine ? '\n' : '') +
                '>' +
                colors.tag.close +
                opts.edgeSpacing +
                indent(children) +
                opts.edgeSpacing +
                colors.tag.open +
                '</' +
                instance.type +
                '>' +
                colors.tag.close;
    }
    else {
        result +=
            colors.tag.open + (closeInNewLine ? '\n' : ' ') + '/>' + colors.tag.close;
    }
    return result;
}
const print$11 = (val, print, indent, opts, colors) => printInstance(val, print, indent, colors, opts);
const test$10 = object => object && object.$$typeof === reactTestInstance;
var ReactTestComponent = { print: print$11, test: test$10 };
const style = index$40; /**
                                       * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                       *
                                       * This source code is licensed under the BSD-style license found in the
                                       * LICENSE file in the root directory of this source tree. An additional grant
                                       * of patent rights can be found in the PATENTS file in the same directory.
                                       *
                                       *
                                       */
const toString = Object.prototype.toString;
const toISOString = Date.prototype.toISOString;
const errorToString = Error.prototype.toString;
const regExpToString = RegExp.prototype.toString;
const symbolToString = Symbol.prototype.toString;
const SYMBOL_REGEXP = /^Symbol\((.*)\)(.*)$/;
const NEWLINE_REGEXP = /\n/gi;
const getSymbols = Object.getOwnPropertySymbols || (obj => []);
function isToStringedArrayType(toStringed) {
    return (toStringed === '[object Array]' ||
        toStringed === '[object ArrayBuffer]' ||
        toStringed === '[object DataView]' ||
        toStringed === '[object Float32Array]' ||
        toStringed === '[object Float64Array]' ||
        toStringed === '[object Int8Array]' ||
        toStringed === '[object Int16Array]' ||
        toStringed === '[object Int32Array]' ||
        toStringed === '[object Uint8Array]' ||
        toStringed === '[object Uint8ClampedArray]' ||
        toStringed === '[object Uint16Array]' ||
        toStringed === '[object Uint32Array]');
}
function printNumber$1(val) {
    if (val != +val) {
        return 'NaN';
    }
    const isNegativeZero = val === 0 && 1 / val < 0;
    return isNegativeZero ? '-0' : '' + val;
}
function printFunction(val, printFunctionName) {
    if (!printFunctionName) {
        return '[Function]';
    }
    else if (val.name === '') {
        return '[Function anonymous]';
    }
    else {
        return '[Function ' + val.name + ']';
    }
}
function printSymbol(val) {
    return symbolToString.call(val).replace(SYMBOL_REGEXP, 'Symbol($1)');
}
function printError(val) {
    return '[' + errorToString.call(val) + ']';
}
function printBasicValue(val, printFunctionName, escapeRegex) {
    if (val === true || val === false) {
        return '' + val;
    }
    if (val === undefined) {
        return 'undefined';
    }
    if (val === null) {
        return 'null';
    }
    const typeOf = typeof val;
    if (typeOf === 'number') {
        return printNumber$1(val);
    }
    if (typeOf === 'string') {
        return '"' + val.replace(/"|\\/g, '\\$&') + '"';
    }
    if (typeOf === 'function') {
        return printFunction(val, printFunctionName);
    }
    if (typeOf === 'symbol') {
        return printSymbol(val);
    }
    const toStringed = toString.call(val);
    if (toStringed === '[object WeakMap]') {
        return 'WeakMap {}';
    }
    if (toStringed === '[object WeakSet]') {
        return 'WeakSet {}';
    }
    if (toStringed === '[object Function]' ||
        toStringed === '[object GeneratorFunction]') {
        return printFunction(val, printFunctionName);
    }
    if (toStringed === '[object Symbol]') {
        return printSymbol(val);
    }
    if (toStringed === '[object Date]') {
        return toISOString.call(val);
    }
    if (toStringed === '[object Error]') {
        return printError(val);
    }
    if (toStringed === '[object RegExp]') {
        if (escapeRegex) {
            // https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js
            return regExpToString.call(val).replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
        }
        return regExpToString.call(val);
    }
    if (toStringed === '[object Arguments]' && val.length === 0) {
        return 'Arguments []';
    }
    if (isToStringedArrayType(toStringed) && val.length === 0) {
        return val.constructor.name + ' []';
    }
    if (val instanceof Error) {
        return printError(val);
    }
    return null;
}
function printList(list, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    let body = '';
    if (list.length) {
        body += edgeSpacing;
        const innerIndent = prevIndent + indent;
        for (let i = 0; i < list.length; i++) {
            body +=
                innerIndent +
                    print(list[i], indent, innerIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
            if (i < list.length - 1) {
                body += ',' + spacing;
            }
        }
        body += (min ? '' : ',') + edgeSpacing + prevIndent;
    }
    return '[' + body + ']';
}
function printArguments(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    return ((min ? '' : 'Arguments ') +
        printList(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors));
}
function printArray(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    return ((min ? '' : val.constructor.name + ' ') +
        printList(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors));
}
function printMap(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    let result = 'Map {';
    const iterator = val.entries();
    let current = iterator.next();
    if (!current.done) {
        result += edgeSpacing;
        const innerIndent = prevIndent + indent;
        while (!current.done) {
            const key = print(current.value[0], indent, innerIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
            const value = print(current.value[1], indent, innerIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
            result += innerIndent + key + ' => ' + value;
            current = iterator.next();
            if (!current.done) {
                result += ',' + spacing;
            }
        }
        result += (min ? '' : ',') + edgeSpacing + prevIndent;
    }
    return result + '}';
}
function printObject(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    const constructor = min ?
        '' :
        val.constructor ? val.constructor.name + ' ' : 'Object ';
    let result = constructor + '{';
    let keys = Object.keys(val).sort();
    const symbols = getSymbols(val);
    if (symbols.length) {
        keys = keys.
            filter(key => 
        // $FlowFixMe string literal `symbol`. This value is not a valid `typeof` return value
        !(typeof key === 'symbol' ||
            toString.call(key) === '[object Symbol]')).
            concat(symbols);
    }
    if (keys.length) {
        result += edgeSpacing;
        const innerIndent = prevIndent + indent;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const name = print(key, indent, innerIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
            const value = print(val[key], indent, innerIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
            result += innerIndent + name + ': ' + value;
            if (i < keys.length - 1) {
                result += ',' + spacing;
            }
        }
        result += (min ? '' : ',') + edgeSpacing + prevIndent;
    }
    return result + '}';
}
function printSet(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    let result = 'Set {';
    const iterator = val.entries();
    let current = iterator.next();
    if (!current.done) {
        result += edgeSpacing;
        const innerIndent = prevIndent + indent;
        while (!current.done) {
            result +=
                innerIndent +
                    print(current.value[1], indent, innerIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
            current = iterator.next();
            if (!current.done) {
                result += ',' + spacing;
            }
        }
        result += (min ? '' : ',') + edgeSpacing + prevIndent;
    }
    return result + '}';
}
function printComplexValue(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    refs = refs.slice();
    if (refs.indexOf(val) > -1) {
        return '[Circular]';
    }
    else {
        refs.push(val);
    }
    currentDepth++;
    const hitMaxDepth = currentDepth > maxDepth;
    if (callToJSON &&
        !hitMaxDepth &&
        val.toJSON &&
        typeof val.toJSON === 'function') {
        return print(val.toJSON(), indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
    }
    const toStringed = toString.call(val);
    if (toStringed === '[object Arguments]') {
        return hitMaxDepth ?
            '[Arguments]' :
            printArguments(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
    }
    else if (isToStringedArrayType(toStringed)) {
        return hitMaxDepth ?
            '[Array]' :
            printArray(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
    }
    else if (toStringed === '[object Map]') {
        return hitMaxDepth ?
            '[Map]' :
            printMap(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
    }
    else if (toStringed === '[object Set]') {
        return hitMaxDepth ?
            '[Set]' :
            printSet(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
    }
    return hitMaxDepth ?
        '[Object]' :
        printObject(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
}
function printPlugin(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    let plugin;
    for (let p = 0; p < plugins.length; p++) {
        if (plugins[p].test(val)) {
            plugin = plugins[p];
            break;
        }
    }
    if (!plugin) {
        return null;
    }
    function boundPrint(val) {
        return print(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
    }
    function boundIndent(str) {
        const indentation = prevIndent + indent;
        return indentation + str.replace(NEWLINE_REGEXP, '\n' + indentation);
    }
    const opts = {
        edgeSpacing,
        min,
        spacing
    };
    return plugin.print(val, boundPrint, boundIndent, opts, colors);
}
function print(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors) {
    const pluginsResult = printPlugin(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
    if (typeof pluginsResult === 'string') {
        return pluginsResult;
    }
    const basicResult = printBasicValue(val, printFunctionName, escapeRegex);
    if (basicResult !== null) {
        return basicResult;
    }
    return printComplexValue(val, indent, prevIndent, spacing, edgeSpacing, refs, maxDepth, currentDepth, plugins, min, callToJSON, printFunctionName, escapeRegex, colors);
}
const DEFAULTS = {
    callToJSON: true,
    edgeSpacing: '\n',
    escapeRegex: false,
    highlight: false,
    indent: 2,
    maxDepth: Infinity,
    min: false,
    plugins: [],
    printFunctionName: true,
    spacing: '\n',
    theme: {
        comment: 'gray',
        content: 'reset',
        prop: 'yellow',
        tag: 'cyan',
        value: 'green'
    }
};
function validateOptions(opts) {
    Object.keys(opts).forEach(key => {
        if (!DEFAULTS.hasOwnProperty(key)) {
            throw new Error(`pretty-format: Unknown option "${key}".`);
        }
    });
    if (opts.min && opts.indent !== undefined && opts.indent !== 0) {
        throw new Error('pretty-format: Options "min" and "indent" cannot be used together.');
    }
}
function normalizeOptions$1(opts) {
    const result = {};
    Object.keys(DEFAULTS).forEach(key => result[key] = opts.hasOwnProperty(key) ?
        key === 'theme' ? normalizeTheme(opts.theme) : opts[key] :
        DEFAULTS[key]);
    if (result.min) {
        result.indent = 0;
    }
    // $FlowFixMe the type cast below means YOU are responsible to verify the code above.
    return result;
}
function normalizeTheme(themeOption) {
    if (!themeOption) {
        throw new Error(`pretty-format: Option "theme" must not be null.`);
    }
    if (typeof themeOption !== 'object') {
        throw new Error(`pretty-format: Option "theme" must be of type "object" but instead received "${typeof themeOption}".`);
    }
    // Silently ignore any keys in `theme` that are not in defaults.
    const themeRefined = themeOption;
    const themeDefaults = DEFAULTS.theme;
    return Object.keys(themeDefaults).reduce((theme, key) => {
        theme[key] = Object.prototype.hasOwnProperty.call(themeOption, key) ?
            themeRefined[key] :
            themeDefaults[key];
        return theme;
    }, {});
}
function createIndent(indent) {
    return new Array(indent + 1).join(' ');
}
function prettyFormat$1(val, initialOptions) {
    let opts;
    if (!initialOptions) {
        opts = DEFAULTS;
    }
    else {
        validateOptions(initialOptions);
        opts = normalizeOptions$1(initialOptions);
    }
    const colors = {
        comment: { close: '', open: '' },
        content: { close: '', open: '' },
        prop: { close: '', open: '' },
        tag: { close: '', open: '' },
        value: { close: '', open: '' }
    };
    Object.keys(opts.theme).forEach(key => {
        if (opts.highlight) {
            const color = colors[key] = style[opts.theme[key]];
            if (!color ||
                typeof color.close !== 'string' ||
                typeof color.open !== 'string') {
                throw new Error(`pretty-format: Option "theme" has a key "${key}" whose value "${opts.theme[key]}" is undefined in ansi-styles.`);
            }
        }
    });
    let indent;
    let refs;
    const prevIndent = '';
    const currentDepth = 0;
    const spacing = opts.min ? ' ' : '\n';
    const edgeSpacing = opts.min ? '' : '\n';
    if (opts && opts.plugins.length) {
        indent = createIndent(opts.indent);
        refs = [];
        const pluginsResult = printPlugin(val, indent, prevIndent, spacing, edgeSpacing, refs, opts.maxDepth, currentDepth, opts.plugins, opts.min, opts.callToJSON, opts.printFunctionName, opts.escapeRegex, colors);
        if (typeof pluginsResult === 'string') {
            return pluginsResult;
        }
    }
    const basicResult = printBasicValue(val, opts.printFunctionName, opts.escapeRegex);
    if (basicResult !== null) {
        return basicResult;
    }
    if (!indent) {
        indent = createIndent(opts.indent);
    }
    if (!refs) {
        refs = [];
    }
    return printComplexValue(val, indent, prevIndent, spacing, edgeSpacing, refs, opts.maxDepth, currentDepth, opts.plugins, opts.min, opts.callToJSON, opts.printFunctionName, opts.escapeRegex, colors);
}
prettyFormat$1.plugins = {
    AsymmetricMatcher: AsymmetricMatcher$1,
    ConvertAnsi: ConvertAnsi,
    HTMLElement: HTMLElement$1,
    Immutable: ImmutablePlugins,
    ReactElement: ReactElement$1,
    ReactTestComponent: ReactTestComponent
};
var index$38 = prettyFormat$1;
const chalk$1 = index$32;
const prettyFormat = index$38;
var _require$plugins = index$38.plugins;
const AsymmetricMatcher = _require$plugins.AsymmetricMatcher;
const ReactElement = _require$plugins.ReactElement;
const HTMLElement = _require$plugins.HTMLElement;
const Immutable = _require$plugins.Immutable;
const PLUGINS = [AsymmetricMatcher, ReactElement, HTMLElement].concat(Immutable);
const EXPECTED_COLOR = chalk$1.green;
const EXPECTED_BG = chalk$1.bgGreen;
const RECEIVED_COLOR = chalk$1.red;
const RECEIVED_BG = chalk$1.bgRed;
const NUMBERS = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen'
];
// get the type of a value with handling the edge cases like `typeof []`
// and `typeof null`
const getType$1 = value => {
    if (typeof value === 'undefined') {
        return 'undefined';
    }
    else if (value === null) {
        return 'null';
    }
    else if (Array.isArray(value)) {
        return 'array';
    }
    else if (typeof value === 'boolean') {
        return 'boolean';
    }
    else if (typeof value === 'function') {
        return 'function';
    }
    else if (typeof value === 'number') {
        return 'number';
    }
    else if (typeof value === 'string') {
        return 'string';
    }
    else if (typeof value === 'object') {
        if (value.constructor === RegExp) {
            return 'regexp';
        }
        else if (value.constructor === Map) {
            return 'map';
        }
        else if (value.constructor === Set) {
            return 'set';
        }
        return 'object';
        // $FlowFixMe https://github.com/facebook/flow/issues/1015
    }
    else if (typeof value === 'symbol') {
        return 'symbol';
    }
    throw new Error(`value of unknown type: ${value}`);
};
const stringify = function (object) {
    let maxDepth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 10;
    const MAX_LENGTH = 10000;
    let result;
    try {
        result = prettyFormat(object, {
            maxDepth,
            min: true,
            plugins: PLUGINS
        });
    }
    catch (e) {
        result = prettyFormat(object, {
            callToJSON: false,
            maxDepth,
            min: true,
            plugins: PLUGINS
        });
    }
    return result.length >= MAX_LENGTH && maxDepth > 1 ?
        stringify(object, Math.floor(maxDepth / 2)) :
        result;
};
const highlightTrailingWhitespace = (text, bgColor) => text.replace(/\s+$/gm, bgColor('$&'));
const printReceived = object => highlightTrailingWhitespace(RECEIVED_COLOR(stringify(object)), RECEIVED_BG);
const printExpected = value => highlightTrailingWhitespace(EXPECTED_COLOR(stringify(value)), EXPECTED_BG);
const printWithType = (name, received, print) => {
    const type = getType$1(received);
    return (name +
        ':' + (type !== 'null' && type !== 'undefined' ? '\n  ' + type + ': ' : ' ') +
        print(received));
};
const ensureNoExpected = (expected, matcherName) => {
    matcherName || (matcherName = 'This');
    if (typeof expected !== 'undefined') {
        throw new Error(matcherHint('[.not]' + matcherName, undefined, '') +
            '\n\n' +
            'Matcher does not accept any arguments.\n' +
            printWithType('Got', expected, printExpected));
    }
};
const ensureActualIsNumber = (actual, matcherName) => {
    matcherName || (matcherName = 'This matcher');
    if (typeof actual !== 'number') {
        throw new Error(matcherHint('[.not]' + matcherName) +
            '\n\n' +
            `Received value must be a number.\n` +
            printWithType('Received', actual, printReceived));
    }
};
const ensureExpectedIsNumber = (expected, matcherName) => {
    matcherName || (matcherName = 'This matcher');
    if (typeof expected !== 'number') {
        throw new Error(matcherHint('[.not]' + matcherName) +
            '\n\n' +
            `Expected value must be a number.\n` +
            printWithType('Got', expected, printExpected));
    }
};
const ensureNumbers = (actual, expected, matcherName) => {
    ensureActualIsNumber(actual, matcherName);
    ensureExpectedIsNumber(expected, matcherName);
};
const pluralize = (word, count) => (NUMBERS[count] || count) + ' ' + word + (count === 1 ? '' : 's');
const matcherHint = function (matcherName) {
    let received = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'received';
    let expected = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'expected';
    let options = arguments[3];
    const secondArgument = options && options.secondArgument;
    const isDirectExpectCall = options && options.isDirectExpectCall;
    return (chalk$1.dim('expect' + (isDirectExpectCall ? '' : '(')) +
        RECEIVED_COLOR(received) +
        chalk$1.dim((isDirectExpectCall ? '' : ')') + matcherName + '(') +
        EXPECTED_COLOR(expected) + (secondArgument ? `, ${EXPECTED_COLOR(secondArgument)}` : '') +
        chalk$1.dim(')'));
};
var index$30 = {
    EXPECTED_BG,
    EXPECTED_COLOR,
    RECEIVED_BG,
    RECEIVED_COLOR,
    ensureActualIsNumber,
    ensureExpectedIsNumber,
    ensureNoExpected,
    ensureNumbers,
    getType: getType$1,
    highlightTrailingWhitespace,
    matcherHint,
    pluralize,
    printExpected,
    printReceived,
    printWithType,
    stringify
};
/* eslint-disable no-nested-ternary */
var arr = [];
var charCodeCache = [];
var index$46 = function (a, b) {
    if (a === b) {
        return 0;
    }
    var swap = a;
    // Swapping the strings if `a` is longer than `b` so we know which one is the
    // shortest & which one is the longest
    if (a.length > b.length) {
        a = b;
        b = swap;
    }
    var aLen = a.length;
    var bLen = b.length;
    if (aLen === 0) {
        return bLen;
    }
    if (bLen === 0) {
        return aLen;
    }
    // Performing suffix trimming:
    // We can linearly drop suffix common to both strings since they
    // don't increase distance at all
    // Note: `~-` is the bitwise way to perform a `- 1` operation
    while (aLen > 0 && (a.charCodeAt(~-aLen) === b.charCodeAt(~-bLen))) {
        aLen--;
        bLen--;
    }
    if (aLen === 0) {
        return bLen;
    }
    // Performing prefix trimming
    // We can linearly drop prefix common to both strings since they
    // don't increase distance at all
    var start = 0;
    while (start < aLen && (a.charCodeAt(start) === b.charCodeAt(start))) {
        start++;
    }
    aLen -= start;
    bLen -= start;
    if (aLen === 0) {
        return bLen;
    }
    var bCharCode;
    var ret;
    var tmp;
    var tmp2;
    var i = 0;
    var j = 0;
    while (i < aLen) {
        charCodeCache[start + i] = a.charCodeAt(start + i);
        arr[i] = ++i;
    }
    while (j < bLen) {
        bCharCode = b.charCodeAt(start + j);
        tmp = j++;
        ret = j;
        for (i = 0; i < aLen; i++) {
            tmp2 = bCharCode === charCodeCache[start + i] ? tmp : tmp + 1;
            tmp = arr[i];
            ret = arr[i] = tmp > ret ? tmp2 > ret ? ret + 1 : tmp2 : tmp2 > tmp ? tmp + 1 : tmp2;
        }
    }
    return ret;
};
const chalk$2 = index$24;
const BULLET = chalk$2.bold('\u25cf');
const DEPRECATION = `${BULLET} Deprecation Warning`;
const ERROR$1 = `${BULLET} Validation Error`;
const WARNING = `${BULLET} Validation Warning`;
const format$2 = value => typeof value === 'function' ?
    value.toString() :
    index$38(value, { min: true });
class ValidationError$1 extends Error {
    constructor(name, message, comment) {
        super();
        comment = comment ? '\n\n' + comment : '\n';
        this.name = '';
        this.stack = '';
        this.message = chalk$2.red(chalk$2.bold(name) + ':\n\n' + message + comment);
        Error.captureStackTrace(this, () => { });
    }
}
const logValidationWarning = (name, message, comment) => {
    comment = comment ? '\n\n' + comment : '\n';
    console.warn(chalk$2.yellow(chalk$2.bold(name) + ':\n\n' + message + comment));
};
const createDidYouMeanMessage = (unrecognized, allowedOptions) => {
    const leven = index$46;
    const suggestion = allowedOptions.find(option => {
        const steps = leven(option, unrecognized);
        return steps < 3;
    });
    return suggestion ? `Did you mean ${chalk$2.bold(format$2(suggestion))}?` : '';
};
var utils$2 = {
    DEPRECATION,
    ERROR: ERROR$1,
    ValidationError: ValidationError$1,
    WARNING,
    createDidYouMeanMessage,
    format: format$2,
    logValidationWarning
};
const chalk = index$24; /**
                                 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                 *
                                 * This source code is licensed under the BSD-style license found in the
                                 * LICENSE file in the root directory of this source tree. An additional grant
                                 * of patent rights can be found in the PATENTS file in the same directory.
                                 *
                                 *
                                 */
var _require = index$30;
const getType = _require.getType;
var _require2 = utils$2;
const format$1 = _require2.format;
const ValidationError = _require2.ValidationError;
const ERROR = _require2.ERROR;
const errorMessage = (option, received, defaultValue, options) => {
    const message = `  Option ${chalk.bold(`"${option}"`)} must be of type:
    ${chalk.bold.green(getType(defaultValue))}
  but instead received:
    ${chalk.bold.red(getType(received))}

  Example:
  {
    ${chalk.bold(`"${option}"`)}: ${chalk.bold(format$1(defaultValue))}
  }`;
    const comment = options.comment;
    const name = options.title && options.title.error || ERROR;
    throw new ValidationError(name, message, comment);
};
var errors = {
    ValidationError,
    errorMessage
};
var _require$2 = utils$2;
const logValidationWarning$1 = _require$2.logValidationWarning;
const DEPRECATION$2 = _require$2.DEPRECATION; /**
                                                                                                                   * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                                                                                   *
                                                                                                                   * This source code is licensed under the BSD-style license found in the
                                                                                                                   * LICENSE file in the root directory of this source tree. An additional grant
                                                                                                                   * of patent rights can be found in the PATENTS file in the same directory.
                                                                                                                   *
                                                                                                                   *
                                                                                                                   */
const deprecationMessage = (message, options) => { const comment = options.comment; const name = options.title && options.title.deprecation || DEPRECATION$2; logValidationWarning$1(name, message, comment); };
const deprecationWarning$1 = (config, option, deprecatedOptions, options) => {
    if (option in deprecatedOptions) {
        deprecationMessage(deprecatedOptions[option](config), options);
        return true;
    }
    return false;
};
var deprecated = {
    deprecationWarning: deprecationWarning$1
};
const chalk$3 = index$24; /**
                                 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                 *
                                 * This source code is licensed under the BSD-style license found in the
                                 * LICENSE file in the root directory of this source tree. An additional grant
                                 * of patent rights can be found in the PATENTS file in the same directory.
                                 *
                                 *
                                 */
var _require$3 = utils$2;
const format$3 = _require$3.format;
const logValidationWarning$2 = _require$3.logValidationWarning;
const createDidYouMeanMessage$1 = _require$3.createDidYouMeanMessage;
const WARNING$2 = _require$3.WARNING;
const unknownOptionWarning$1 = (config, exampleConfig, option, options) => {
    const didYouMean = createDidYouMeanMessage$1(option, Object.keys(exampleConfig));
    const message = `  Unknown option ${chalk$3.bold(`"${option}"`)} with value ${chalk$3.bold(format$3(config[option]))} was found.` + (didYouMean && ` ${didYouMean}`) +
        `\n  This is probably a typing mistake. Fixing it will remove this message.`;
    const comment = options.comment;
    const name = options.title && options.title.warning || WARNING$2;
    logValidationWarning$2(name, message, comment);
};
var warnings = {
    unknownOptionWarning: unknownOptionWarning$1
};
const config$1 = {
    comment: '  A comment',
    condition: (option, validOption) => true,
    deprecate: (config, option, deprecatedOptions, options) => false,
    deprecatedConfig: {
        key: config => { }
    },
    error: (option, received, defaultValue, options) => { },
    exampleConfig: { key: 'value', test: 'case' },
    title: {
        deprecation: 'Deprecation Warning',
        error: 'Validation Error',
        warning: 'Validation Warning'
    },
    unknown: (config, option, options) => { }
}; /**
                                             * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                             *
                                             * This source code is licensed under the BSD-style license found in the
                                             * LICENSE file in the root directory of this source tree. An additional grant
                                             * of patent rights can be found in the PATENTS file in the same directory.
                                             *
                                             *
                                             */
var exampleConfig$2 = config$1;
const toString$1 = Object.prototype.toString;
const validationCondition$1 = (option, validOption) => {
    return (option === null ||
        option === undefined ||
        toString$1.call(option) === toString$1.call(validOption));
};
var condition = validationCondition$1;
var _require$1 = deprecated;
const deprecationWarning = _require$1.deprecationWarning; /**
                                                                                 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                                                 *
                                                                                 * This source code is licensed under the BSD-style license found in the
                                                                                 * LICENSE file in the root directory of this source tree. An additional grant
                                                                                 * of patent rights can be found in the PATENTS file in the same directory.
                                                                                 *
                                                                                 *
                                                                                 */
var _require2$1 = warnings;
const unknownOptionWarning = _require2$1.unknownOptionWarning;
var _require3 = errors;
const errorMessage$1 = _require3.errorMessage;
const exampleConfig$1 = exampleConfig$2;
const validationCondition = condition;
var _require4 = utils$2;
const ERROR$2 = _require4.ERROR;
const DEPRECATION$1 = _require4.DEPRECATION;
const WARNING$1 = _require4.WARNING;
var defaultConfig$1 = { comment: '',
    condition: validationCondition,
    deprecate: deprecationWarning,
    deprecatedConfig: {},
    error: errorMessage$1,
    exampleConfig: exampleConfig$1,
    title: {
        deprecation: DEPRECATION$1,
        error: ERROR$2,
        warning: WARNING$1
    },
    unknown: unknownOptionWarning };
const defaultConfig = defaultConfig$1; /**
                                                   * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
                                                   *
                                                   * This source code is licensed under the BSD-style license found in the
                                                   * LICENSE file in the root directory of this source tree. An additional grant
                                                   * of patent rights can be found in the PATENTS file in the same directory.
                                                   *
                                                   *
                                                   */
const _validate = (config, options) => {
    let hasDeprecationWarnings = false;
    for (const key in config) {
        if (options.deprecatedConfig && key in options.deprecatedConfig &&
            typeof options.deprecate === 'function') {
            const isDeprecatedKey = options.deprecate(config, key, options.deprecatedConfig, options);
            hasDeprecationWarnings = hasDeprecationWarnings || isDeprecatedKey;
        }
        else if (hasOwnProperty.call(options.exampleConfig, key)) {
            if (typeof options.condition === 'function' &&
                typeof options.error === 'function' &&
                !options.condition(config[key], options.exampleConfig[key])) {
                options.error(key, config[key], options.exampleConfig[key], options);
            }
        }
        else {
            options.unknown &&
                options.unknown(config, options.exampleConfig, key, options);
        }
    }
    return { hasDeprecationWarnings };
};
const validate$1 = (config, options) => {
    _validate(options, defaultConfig); // validate against jest-validate config
    const defaultedOptions = Object.assign({}, defaultConfig, options, { title: Object.assign({}, defaultConfig.title, options.title) });
    var _validate2 = _validate(config, defaultedOptions);
    const hasDeprecationWarnings = _validate2.hasDeprecationWarnings;
    return {
        hasDeprecationWarnings,
        isValid: true
    };
};
var validate_1 = validate$1;
var index$22 = {
    ValidationError: errors.ValidationError,
    createDidYouMeanMessage: utils$2.createDidYouMeanMessage,
    format: utils$2.format,
    logValidationWarning: utils$2.logValidationWarning,
    validate: validate_1
};
const deprecated$2 = {
    useFlowParser: config => `  The ${'"useFlowParser"'} option is deprecated. Use ${'"parser"'} instead.

  Prettier now treats your configuration as:
  {
    ${'"parser"'}: ${config.useFlowParser ? '"flow"' : '"babylon"'}
  }`
};
var deprecated_1 = deprecated$2;
const validate = index$22.validate;
const deprecatedConfig = deprecated_1;
const defaultsTrailingComma = {
    array: false,
    object: false,
    import: false,
    export: false,
    arguments: false
};
const trailingCommaPresets = {
    none: Object.assign({}, defaultsTrailingComma),
    es5: Object.assign({}, defaultsTrailingComma, {
        array: true,
        object: true,
        import: true,
        export: true
    }),
    all: Object.assign({}, defaultsTrailingComma, {
        array: true,
        object: true,
        import: true,
        export: true,
        arguments: true
    })
};
const defaults = {
    cursorOffset: -1,
    rangeStart: 0,
    rangeEnd: Infinity,
    useTabs: false,
    tabWidth: 2,
    printWidth: 80,
    singleQuote: false,
    jsxSingleQuote: false,
    trailingComma: Object.assign({}, defaultsTrailingComma),
    bracketSpacing: false,
    bracesSpacing: true,
    breakProperty: false,
    arrowParens: false,
    arrayExpand: false,
    flattenTernaries: false,
    breakBeforeElse: false,
    jsxBracketSameLine: false,
    alignObjectProperties: false,
    noSpaceEmptyFn: false,
    parser: "babylon",
    semi: true,
    spaceBeforeFunctionParen: false,
    __log: false
};
const exampleConfig = Object.assign({}, defaults, {
    filepath: "path/to/Filename",
    printWidth: 80,
    originalText: "text"
});
// Copy options and fill in default values.
function normalize(options) {
    const normalized = Object.assign({}, options || {});
    const filepath = normalized.filepath;
    if (/\.(css|less|scss)$/.test(filepath)) {
        normalized.parser = "postcss";
    }
    else if (/\.html$/.test(filepath)) {
        normalized.parser = "parse5";
    }
    else if (/\.(ts|tsx)$/.test(filepath)) {
        normalized.parser = "typescript";
    }
    else if (/\.(graphql|gql)$/.test(filepath)) {
        normalized.parser = "graphql";
    }
    else if (/\.json$/.test(filepath)) {
        normalized.parser = "json";
    }
    if (normalized.parser === "json") {
        normalized.trailingComma = "none";
    }
    normalized.trailingComma = normalizeTrailingComma(normalized.trailingComma);
    const parserBackup = normalized.parser;
    if (typeof normalized.parser === "function") {
        // Delete the function from the object to pass validation.
        delete normalized.parser;
    }
    validate(normalized, { exampleConfig, deprecatedConfig });
    // Restore the option back to a function;
    normalized.parser = parserBackup;
    // For backward compatibility. Deprecated in 0.0.10
    if ("useFlowParser" in normalized) {
        normalized.parser = normalized.useFlowParser ? "flow" : "babylon";
        delete normalized.useFlowParser;
    }
    Object.keys(defaults).forEach(k => {
        if (normalized[k] == null) {
            normalized[k] = defaults[k];
        }
    });
    return normalized;
}
function normalizeTrailingComma(value) {
    let trailingComma;
    if ("boolean" === typeof value) {
        // Support a deprecated boolean type for the trailing comma config
        // for a few versions. This code can be removed later.
        trailingComma = Object.assign({}, trailingCommaPresets[value ? "es5" : "none"]);
        console.warn("Warning: `trailingComma` without any argument is deprecated. " +
            'Specify "none", "es5", or "all".');
    }
    else if ("object" === typeof value) {
        trailingComma = {};
        Object.keys(defaultsTrailingComma).forEach(k => {
            trailingComma[k] = null == value[k] ? defaultsTrailingComma[k] : value[k];
        });
    }
    else if ("string" === typeof value) {
        trailingComma = trailingCommaPresets[value];
        if (trailingComma) {
            trailingComma = Object.assign({}, trailingComma);
        }
        else {
            trailingComma = Object.assign({}, trailingCommaPresets.none);
            value.split(",").forEach(k => {
                if (k in defaultsTrailingComma) {
                    trailingComma[k] = true;
                }
            });
        }
    }
    else {
        trailingComma = Object.assign({}, defaultsTrailingComma);
    }
    return trailingComma;
}
var options = { normalize };
function flattenDoc(doc) {
    if (doc.type === "concat") {
        const res = [];
        for (let i = 0; i < doc.parts.length; ++i) {
            const doc2 = doc.parts[i];
            if (typeof doc2 !== "string" && doc2.type === "concat") {
                [].push.apply(res, flattenDoc(doc2).parts);
            }
            else {
                const flattened = flattenDoc(doc2);
                if (flattened !== "") {
                    res.push(flattened);
                }
            }
        }
        return Object.assign({}, doc, { parts: res });
    }
    else if (doc.type === "if-break") {
        return Object.assign({}, doc, {
            breakContents: doc.breakContents != null ? flattenDoc(doc.breakContents) : null,
            flatContents: doc.flatContents != null ? flattenDoc(doc.flatContents) : null
        });
    }
    else if (doc.type === "group") {
        return Object.assign({}, doc, {
            contents: flattenDoc(doc.contents),
            expandedStates: doc.expandedStates
                ? doc.expandedStates.map(flattenDoc)
                : doc.expandedStates
        });
    }
    else if (doc.contents) {
        return Object.assign({}, doc, { contents: flattenDoc(doc.contents) });
    }
    return doc;
}
function printDoc(doc) {
    if (typeof doc === "string") {
        return JSON.stringify(doc);
    }
    if (doc.type === "line") {
        if (doc.literalline) {
            return "literalline";
        }
        if (doc.hard) {
            return "hardline";
        }
        if (doc.soft) {
            return "softline";
        }
        return "line";
    }
    if (doc.type === "break-parent") {
        return "breakParent";
    }
    if (doc.type === "concat") {
        return "[" + doc.parts.map(printDoc).join(", ") + "]";
    }
    if (doc.type === "indent") {
        return "indent(" + printDoc(doc.contents) + ")";
    }
    if (doc.type === "align") {
        return "align(" + doc.n + ", " + printDoc(doc.contents) + ")";
    }
    if (doc.type === "if-break") {
        return ("ifBreak(" +
            printDoc(doc.breakContents) +
            (doc.flatContents ? ", " + printDoc(doc.flatContents) : "") +
            ")");
    }
    if (doc.type === "group") {
        if (doc.expandedStates) {
            return ("conditionalGroup(" +
                "[" +
                doc.expandedStates.map(printDoc).join(",") +
                "])");
        }
        return ((doc.break ? "wrappedGroup" : "group") +
            "(" +
            printDoc(doc.contents) +
            ")");
    }
    if (doc.type === "fill") {
        return "fill" + "(" + doc.parts.map(printDoc).join(", ") + ")";
    }
    if (doc.type === "line-suffix") {
        return "lineSuffix(" + printDoc(doc.contents) + ")";
    }
    if (doc.type === "line-suffix-boundary") {
        return "lineSuffixBoundary";
    }
    throw new Error("Unknown doc type " + doc.type);
}
var docDebug = {
    printDocToDebug: function (doc) {
        return printDoc(flattenDoc(doc));
    }
};
var os$1 = os;
function homedir() {
    var env = process.env;
    var home = env.HOME;
    var user = env.LOGNAME || env.USER || env.LNAME || env.USERNAME;
    if (process.platform === 'win32') {
        return env.USERPROFILE || env.HOMEDRIVE + env.HOMEPATH || home || null;
    }
    if (process.platform === 'darwin') {
        return home || (user ? '/Users/' + user : null);
    }
    if (process.platform === 'linux') {
        return home || (process.getuid() === 0 ? '/root' : (user ? '/home/' + user : null));
    }
    return home || null;
}
var index$50 = typeof os$1.homedir === 'function' ? os$1.homedir : homedir;
var index$52 = function (args, opts) {
    if (!opts)
        opts = {};
    var flags = { bools: {}, strings: {}, unknownFn: null };
    if (typeof opts['unknown'] === 'function') {
        flags.unknownFn = opts['unknown'];
    }
    if (typeof opts['boolean'] === 'boolean' && opts['boolean']) {
        flags.allBools = true;
    }
    else {
        [].concat(opts['boolean']).filter(Boolean).forEach(function (key) {
            flags.bools[key] = true;
        });
    }
    var aliases = {};
    Object.keys(opts.alias || {}).forEach(function (key) {
        aliases[key] = [].concat(opts.alias[key]);
        aliases[key].forEach(function (x) {
            aliases[x] = [key].concat(aliases[key].filter(function (y) {
                return x !== y;
            }));
        });
    });
    [].concat(opts.string).filter(Boolean).forEach(function (key) {
        flags.strings[key] = true;
        if (aliases[key]) {
            flags.strings[aliases[key]] = true;
        }
    });
    var defaults = opts['default'] || {};
    var argv = { _: [] };
    Object.keys(flags.bools).forEach(function (key) {
        setArg(key, defaults[key] === undefined ? false : defaults[key]);
    });
    var notFlags = [];
    if (args.indexOf('--') !== -1) {
        notFlags = args.slice(args.indexOf('--') + 1);
        args = args.slice(0, args.indexOf('--'));
    }
    function argDefined(key, arg) {
        return (flags.allBools && /^--[^=]+$/.test(arg)) ||
            flags.strings[key] || flags.bools[key] || aliases[key];
    }
    function setArg(key, val, arg) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg) === false)
                return;
        }
        var value = !flags.strings[key] && isNumber(val)
            ? Number(val) : val;
        setKey(argv, key.split('.'), value);
        (aliases[key] || []).forEach(function (x) {
            setKey(argv, x.split('.'), value);
        });
    }
    function setKey(obj, keys, value) {
        var o = obj;
        keys.slice(0, -1).forEach(function (key) {
            if (o[key] === undefined)
                o[key] = {};
            o = o[key];
        });
        var key = keys[keys.length - 1];
        if (o[key] === undefined || flags.bools[key] || typeof o[key] === 'boolean') {
            o[key] = value;
        }
        else if (Array.isArray(o[key])) {
            o[key].push(value);
        }
        else {
            o[key] = [o[key], value];
        }
    }
    function aliasIsBoolean(key) {
        return aliases[key].some(function (x) {
            return flags.bools[x];
        });
    }
    for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        if (/^--.+=/.test(arg)) {
            // Using [\s\S] instead of . because js doesn't support the
            // 'dotall' regex modifier. See:
            // http://stackoverflow.com/a/1068308/13216
            var m = arg.match(/^--([^=]+)=([\s\S]*)$/);
            var key = m[1];
            var value = m[2];
            if (flags.bools[key]) {
                value = value !== 'false';
            }
            setArg(key, value, arg);
        }
        else if (/^--no-.+/.test(arg)) {
            var key = arg.match(/^--no-(.+)/)[1];
            setArg(key, false, arg);
        }
        else if (/^--.+/.test(arg)) {
            var key = arg.match(/^--(.+)/)[1];
            var next = args[i + 1];
            if (next !== undefined && !/^-/.test(next)
                && !flags.bools[key]
                && !flags.allBools
                && (aliases[key] ? !aliasIsBoolean(key) : true)) {
                setArg(key, next, arg);
                i++;
            }
            else if (/^(true|false)$/.test(next)) {
                setArg(key, next === 'true', arg);
                i++;
            }
            else {
                setArg(key, flags.strings[key] ? '' : true, arg);
            }
        }
        else if (/^-[^-]+/.test(arg)) {
            var letters = arg.slice(1, -1).split('');
            var broken = false;
            for (var j = 0; j < letters.length; j++) {
                var next = arg.slice(j + 2);
                if (next === '-') {
                    setArg(letters[j], next, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
                    setArg(letters[j], next.split('=')[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j])
                    && /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
                    setArg(letters[j], next, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                }
                else {
                    setArg(letters[j], flags.strings[letters[j]] ? '' : true, arg);
                }
            }
            var key = arg.slice(-1)[0];
            if (!broken && key !== '-') {
                if (args[i + 1] && !/^(-|--)[^-]/.test(args[i + 1])
                    && !flags.bools[key]
                    && (aliases[key] ? !aliasIsBoolean(key) : true)) {
                    setArg(key, args[i + 1], arg);
                    i++;
                }
                else if (args[i + 1] && /true|false/.test(args[i + 1])) {
                    setArg(key, args[i + 1] === 'true', arg);
                    i++;
                }
                else {
                    setArg(key, flags.strings[key] ? '' : true, arg);
                }
            }
        }
        else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings['_'] || !isNumber(arg) ? arg : Number(arg));
            }
            if (opts.stopEarly) {
                argv._.push.apply(argv._, args.slice(i + 1));
                break;
            }
        }
    }
    Object.keys(defaults).forEach(function (key) {
        if (!hasKey(argv, key.split('.'))) {
            setKey(argv, key.split('.'), defaults[key]);
            (aliases[key] || []).forEach(function (x) {
                setKey(argv, x.split('.'), defaults[key]);
            });
        }
    });
    if (opts['--']) {
        argv['--'] = new Array();
        notFlags.forEach(function (key) {
            argv['--'].push(key);
        });
    }
    else {
        notFlags.forEach(function (key) {
            argv._.push(key);
        });
    }
    return argv;
};
function hasKey(obj, keys) {
    var o = obj;
    keys.slice(0, -1).forEach(function (key) {
        o = (o[key] || {});
    });
    var key = keys[keys.length - 1];
    return key in o;
}
function isNumber(x) {
    if (typeof x === 'number')
        return true;
    if (/^0x[0-9a-f]+$/i.test(x))
        return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
}
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;
function toObject(val) {
    if (val === null || val === undefined) {
        throw new TypeError('Object.assign cannot be called with null or undefined');
    }
    return Object(val);
}
function shouldUseNative() {
    try {
        if (!Object.assign) {
            return false;
        }
        // Detect buggy property enumeration order in older V8 versions.
        // https://bugs.chromium.org/p/v8/issues/detail?id=4118
        var test1 = new String('abc'); // eslint-disable-line no-new-wrappers
        test1[5] = 'de';
        if (Object.getOwnPropertyNames(test1)[0] === '5') {
            return false;
        }
        // https://bugs.chromium.org/p/v8/issues/detail?id=3056
        var test2 = {};
        for (var i = 0; i < 10; i++) {
            test2['_' + String.fromCharCode(i)] = i;
        }
        var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
            return test2[n];
        });
        if (order2.join('') !== '0123456789') {
            return false;
        }
        // https://bugs.chromium.org/p/v8/issues/detail?id=3056
        var test3 = {};
        'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
            test3[letter] = letter;
        });
        if (Object.keys(Object.assign({}, test3)).join('') !==
            'abcdefghijklmnopqrst') {
            return false;
        }
        return true;
    }
    catch (err) {
        // We don't expect any of the above to throw, but better to be safe.
        return false;
    }
}
var index$54 = shouldUseNative() ? Object.assign : function (target, source) {
    var from;
    var to = toObject(target);
    var symbols;
    for (var s = 1; s < arguments.length; s++) {
        from = Object(arguments[s]);
        for (var key in from) {
            if (hasOwnProperty$1.call(from, key)) {
                to[key] = from[key];
            }
        }
        if (getOwnPropertySymbols) {
            symbols = getOwnPropertySymbols(from);
            for (var i = 0; i < symbols.length; i++) {
                if (propIsEnumerable.call(from, symbols[i])) {
                    to[symbols[i]] = from[symbols[i]];
                }
            }
        }
    }
    return to;
};
var fs$1 = fs;
/**
 * async
 */
function isDirectory$1(filepath, cb) {
    if (typeof cb !== 'function') {
        throw new Error('expected a callback function');
    }
    if (typeof filepath !== 'string') {
        cb(new Error('expected filepath to be a string'));
        return;
    }
    fs$1.stat(filepath, function (err, stats) {
        if (err) {
            if (err.code === 'ENOENT') {
                cb(null, false);
                return;
            }
            cb(err);
            return;
        }
        cb(null, stats.isDirectory());
    });
}
/**
 * sync
 */
isDirectory$1.sync = function isDirectorySync(filepath) {
    if (typeof filepath !== 'string') {
        throw new Error('expected filepath to be a string');
    }
    try {
        var stat = fs$1.statSync(filepath);
        return stat.isDirectory();
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        else {
            throw err;
        }
    }
    return false;
};
/**
 * Expose `isDirectory`
 */
var index$56 = isDirectory$1;
var fs$2 = fs;
var readFile$1 = function (filepath, options) {
    options = options || {};
    options.throwNotFound = options.throwNotFound || false;
    return new Promise(function (resolve, reject) {
        fs$2.readFile(filepath, 'utf8', function (err, content) {
            if (err && err.code === 'ENOENT' && !options.throwNotFound) {
                return resolve(null);
            }
            if (err)
                return reject(err);
            resolve(content);
        });
    });
};
var index$62 = function isArrayish(obj) {
    if (!obj) {
        return false;
    }
    return obj instanceof Array || Array.isArray(obj) ||
        (obj.length >= 0 && obj.splice instanceof Function);
};
var util$10 = util;
var isArrayish = index$62;
var errorEx$1 = function errorEx(name, properties) {
    if (!name || name.constructor !== String) {
        properties = name || {};
        name = Error.name;
    }
    var errorExError = function ErrorEXError(message) {
        if (!this) {
            return new ErrorEXError(message);
        }
        message = message instanceof Error
            ? message.message
            : (message || this.message);
        Error.call(this, message);
        Error.captureStackTrace(this, errorExError);
        this.name = name;
        Object.defineProperty(this, 'message', {
            configurable: true,
            enumerable: false,
            get: function () {
                var newMessage = message.split(/\r?\n/g);
                for (var key in properties) {
                    if (!properties.hasOwnProperty(key)) {
                        continue;
                    }
                    var modifier = properties[key];
                    if ('message' in modifier) {
                        newMessage = modifier.message(this[key], newMessage) || newMessage;
                        if (!isArrayish(newMessage)) {
                            newMessage = [newMessage];
                        }
                    }
                }
                return newMessage.join('\n');
            },
            set: function (v) {
                message = v;
            }
        });
        var stackDescriptor = Object.getOwnPropertyDescriptor(this, 'stack');
        var stackGetter = stackDescriptor.get;
        var stackValue = stackDescriptor.value;
        delete stackDescriptor.value;
        delete stackDescriptor.writable;
        stackDescriptor.get = function () {
            var stack = (stackGetter)
                ? stackGetter.call(this).split(/\r?\n+/g)
                : stackValue.split(/\r?\n+/g);
            // starting in Node 7, the stack builder caches the message.
            // just replace it.
            stack[0] = this.name + ': ' + this.message;
            var lineCount = 1;
            for (var key in properties) {
                if (!properties.hasOwnProperty(key)) {
                    continue;
                }
                var modifier = properties[key];
                if ('line' in modifier) {
                    var line = modifier.line(this[key]);
                    if (line) {
                        stack.splice(lineCount++, 0, '    ' + line);
                    }
                }
                if ('stack' in modifier) {
                    modifier.stack(this[key], stack);
                }
            }
            return stack.join('\n');
        };
        Object.defineProperty(this, 'stack', stackDescriptor);
    };
    if (Object.setPrototypeOf) {
        Object.setPrototypeOf(errorExError.prototype, Error.prototype);
        Object.setPrototypeOf(errorExError, Error);
    }
    else {
        util$10.inherits(errorExError, Error);
    }
    return errorExError;
};
errorEx$1.append = function (str, def) {
    return {
        message: function (v, message) {
            v = v || def;
            if (v) {
                message[0] += ' ' + str.replace('%s', v.toString());
            }
            return message;
        }
    };
};
errorEx$1.line = function (str, def) {
    return {
        line: function (v) {
            v = v || def;
            if (v) {
                return str.replace('%s', v.toString());
            }
            return null;
        }
    };
};
var index$60 = errorEx$1;
var unicode = createCommonjsModule(function (module) {
    // This is autogenerated with esprima tools, see:
    // https://github.com/ariya/esprima/blob/master/esprima.js
    //
    // PS: oh God, I hate Unicode
    // ECMAScript 5.1/Unicode v6.3.0 NonAsciiIdentifierStart:
    var Uni = module.exports;
    module.exports.isWhiteSpace = function isWhiteSpace(x) {
        // section 7.2, table 2
        return x === '\u0020'
            || x === '\u00A0'
            || x === '\uFEFF' // <-- this is not a Unicode WS, only a JS one
            || (x >= '\u0009' && x <= '\u000D') // 9 A B C D
            || x === '\u1680'
            || x === '\u180E'
            || (x >= '\u2000' && x <= '\u200A') // 0 1 2 3 4 5 6 7 8 9 A
            || x === '\u2028'
            || x === '\u2029'
            || x === '\u202F'
            || x === '\u205F'
            || x === '\u3000';
    };
    module.exports.isWhiteSpaceJSON = function isWhiteSpaceJSON(x) {
        return x === '\u0020'
            || x === '\u0009'
            || x === '\u000A'
            || x === '\u000D';
    };
    module.exports.isLineTerminator = function isLineTerminator(x) {
        // ok, here is the part when JSON is wrong
        // section 7.3, table 3
        return x === '\u000A'
            || x === '\u000D'
            || x === '\u2028'
            || x === '\u2029';
    };
    module.exports.isLineTerminatorJSON = function isLineTerminatorJSON(x) {
        return x === '\u000A'
            || x === '\u000D';
    };
    module.exports.isIdentifierStart = function isIdentifierStart(x) {
        return x === '$'
            || x === '_'
            || (x >= 'A' && x <= 'Z')
            || (x >= 'a' && x <= 'z')
            || (x >= '\u0080' && Uni.NonAsciiIdentifierStart.test(x));
    };
    module.exports.isIdentifierPart = function isIdentifierPart(x) {
        return x === '$'
            || x === '_'
            || (x >= 'A' && x <= 'Z')
            || (x >= 'a' && x <= 'z')
            || (x >= '0' && x <= '9') // <-- addition to Start
            || (x >= '\u0080' && Uni.NonAsciiIdentifierPart.test(x));
    };
    module.exports.NonAsciiIdentifierStart = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/;
    // ECMAScript 5.1/Unicode v6.3.0 NonAsciiIdentifierPart:
    module.exports.NonAsciiIdentifierPart = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0\u08A2-\u08AC\u08E4-\u08FE\u0900-\u0963\u0966-\u096F\u0971-\u0977\u0979-\u097F\u0981-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191C\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1D00-\u1DE6\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA697\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A\uAA7B\uAA80-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE26\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/;
});
var parse_1 = createCommonjsModule(function (module) {
    /*
     * Author: Alex Kocharin <alex@kocharin.ru>
     * GIT: https://github.com/rlidwka/jju
     * License: WTFPL, grab your copy here: http://www.wtfpl.net/txt/copying/
     */
    // RTFM: http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf
    var Uni = unicode;
    function isHexDigit(x) {
        return (x >= '0' && x <= '9')
            || (x >= 'A' && x <= 'F')
            || (x >= 'a' && x <= 'f');
    }
    function isOctDigit(x) {
        return x >= '0' && x <= '7';
    }
    function isDecDigit(x) {
        return x >= '0' && x <= '9';
    }
    var unescapeMap = {
        '\'': '\'',
        '"': '"',
        '\\': '\\',
        'b': '\b',
        'f': '\f',
        'n': '\n',
        'r': '\r',
        't': '\t',
        'v': '\v',
        '/': '/',
    };
    function formatError(input, msg, position, lineno, column, json5) {
        var result = msg + ' at ' + (lineno + 1) + ':' + (column + 1), tmppos = position - column - 1, srcline = '', underline = '';
        var isLineTerminator = json5 ? Uni.isLineTerminator : Uni.isLineTerminatorJSON;
        // output no more than 70 characters before the wrong ones
        if (tmppos < position - 70) {
            tmppos = position - 70;
        }
        while (1) {
            var chr = input[++tmppos];
            if (isLineTerminator(chr) || tmppos === input.length) {
                if (position >= tmppos) {
                    // ending line error, so show it after the last char
                    underline += '^';
                }
                break;
            }
            srcline += chr;
            if (position === tmppos) {
                underline += '^';
            }
            else if (position > tmppos) {
                underline += input[tmppos] === '\t' ? '\t' : ' ';
            }
            // output no more than 78 characters on the string
            if (srcline.length > 78)
                break;
        }
        return result + '\n' + srcline + '\n' + underline;
    }
    function parse(input, options) {
        // parse as a standard JSON mode
        var json5 = !(options.mode === 'json' || options.legacy);
        var isLineTerminator = json5 ? Uni.isLineTerminator : Uni.isLineTerminatorJSON;
        var isWhiteSpace = json5 ? Uni.isWhiteSpace : Uni.isWhiteSpaceJSON;
        var length = input.length, lineno = 0, linestart = 0, position = 0, stack = [];
        var tokenStart = function () { };
        var tokenEnd = function (v) { return v; };
        /* tokenize({
             raw: '...',
             type: 'whitespace'|'comment'|'key'|'literal'|'separator'|'newline',
             value: 'number'|'string'|'whatever',
             path: [...],
           })
        */
        if (options._tokenize) {
            (function () {
                var start = null;
                tokenStart = function () {
                    if (start !== null)
                        throw Error('internal error, token overlap');
                    start = position;
                };
                tokenEnd = function (v, type) {
                    if (start != position) {
                        var hash = {
                            raw: input.substr(start, position - start),
                            type: type,
                            stack: stack.slice(0),
                        };
                        if (v !== undefined)
                            hash.value = v;
                        options._tokenize.call(null, hash);
                    }
                    start = null;
                    return v;
                };
            })();
        }
        function fail(msg) {
            var column = position - linestart;
            if (!msg) {
                if (position < length) {
                    var token = '\'' +
                        JSON
                            .stringify(input[position])
                            .replace(/^"|"$/g, '')
                            .replace(/'/g, "\\'")
                            .replace(/\\"/g, '"')
                        + '\'';
                    if (!msg)
                        msg = 'Unexpected token ' + token;
                }
                else {
                    if (!msg)
                        msg = 'Unexpected end of input';
                }
            }
            var error = SyntaxError(formatError(input, msg, position, lineno, column, json5));
            error.row = lineno + 1;
            error.column = column + 1;
            throw error;
        }
        function newline(chr) {
            // account for <cr><lf>
            if (chr === '\r' && input[position] === '\n')
                position++;
            linestart = position;
            lineno++;
        }
        function parseGeneric() {
            var result;
            while (position < length) {
                tokenStart();
                var chr = input[position++];
                if (chr === '"' || (chr === '\'' && json5)) {
                    return tokenEnd(parseString(chr), 'literal');
                }
                else if (chr === '{') {
                    tokenEnd(undefined, 'separator');
                    return parseObject();
                }
                else if (chr === '[') {
                    tokenEnd(undefined, 'separator');
                    return parseArray();
                }
                else if (chr === '-'
                    || chr === '.'
                    || isDecDigit(chr)
                    || (json5 && (chr === '+' || chr === 'I' || chr === 'N'))) {
                    return tokenEnd(parseNumber(), 'literal');
                }
                else if (chr === 'n') {
                    parseKeyword('null');
                    return tokenEnd(null, 'literal');
                }
                else if (chr === 't') {
                    parseKeyword('true');
                    return tokenEnd(true, 'literal');
                }
                else if (chr === 'f') {
                    parseKeyword('false');
                    return tokenEnd(false, 'literal');
                }
                else {
                    position--;
                    return tokenEnd(undefined);
                }
            }
        }
        function parseKey() {
            var result;
            while (position < length) {
                tokenStart();
                var chr = input[position++];
                if (chr === '"' || (chr === '\'' && json5)) {
                    return tokenEnd(parseString(chr), 'key');
                }
                else if (chr === '{') {
                    tokenEnd(undefined, 'separator');
                    return parseObject();
                }
                else if (chr === '[') {
                    tokenEnd(undefined, 'separator');
                    return parseArray();
                }
                else if (chr === '.'
                    || isDecDigit(chr)) {
                    return tokenEnd(parseNumber(true), 'key');
                }
                else if (json5
                    && Uni.isIdentifierStart(chr) || (chr === '\\' && input[position] === 'u')) {
                    // unicode char or a unicode sequence
                    var rollback = position - 1;
                    var result = parseIdentifier();
                    if (result === undefined) {
                        position = rollback;
                        return tokenEnd(undefined);
                    }
                    else {
                        return tokenEnd(result, 'key');
                    }
                }
                else {
                    position--;
                    return tokenEnd(undefined);
                }
            }
        }
        function skipWhiteSpace() {
            tokenStart();
            while (position < length) {
                var chr = input[position++];
                if (isLineTerminator(chr)) {
                    position--;
                    tokenEnd(undefined, 'whitespace');
                    tokenStart();
                    position++;
                    newline(chr);
                    tokenEnd(undefined, 'newline');
                    tokenStart();
                }
                else if (isWhiteSpace(chr)) {
                    // nothing
                }
                else if (chr === '/'
                    && json5
                    && (input[position] === '/' || input[position] === '*')) {
                    position--;
                    tokenEnd(undefined, 'whitespace');
                    tokenStart();
                    position++;
                    skipComment(input[position++] === '*');
                    tokenEnd(undefined, 'comment');
                    tokenStart();
                }
                else {
                    position--;
                    break;
                }
            }
            return tokenEnd(undefined, 'whitespace');
        }
        function skipComment(multi) {
            while (position < length) {
                var chr = input[position++];
                if (isLineTerminator(chr)) {
                    // LineTerminator is an end of singleline comment
                    if (!multi) {
                        // let parent function deal with newline
                        position--;
                        return;
                    }
                    newline(chr);
                }
                else if (chr === '*' && multi) {
                    // end of multiline comment
                    if (input[position] === '/') {
                        position++;
                        return;
                    }
                }
                else {
                    // nothing
                }
            }
            if (multi) {
                fail('Unclosed multiline comment');
            }
        }
        function parseKeyword(keyword) {
            // keyword[0] is not checked because it should've checked earlier
            var _pos = position;
            var len = keyword.length;
            for (var i = 1; i < len; i++) {
                if (position >= length || keyword[i] != input[position]) {
                    position = _pos - 1;
                    fail();
                }
                position++;
            }
        }
        function parseObject() {
            var result = options.null_prototype ? Object.create(null) : {}, empty_object = {}, is_non_empty = false;
            while (position < length) {
                skipWhiteSpace();
                var item1 = parseKey();
                skipWhiteSpace();
                tokenStart();
                var chr = input[position++];
                tokenEnd(undefined, 'separator');
                if (chr === '}' && item1 === undefined) {
                    if (!json5 && is_non_empty) {
                        position--;
                        fail('Trailing comma in object');
                    }
                    return result;
                }
                else if (chr === ':' && item1 !== undefined) {
                    skipWhiteSpace();
                    stack.push(item1);
                    var item2 = parseGeneric();
                    stack.pop();
                    if (item2 === undefined)
                        fail('No value found for key ' + item1);
                    if (typeof (item1) !== 'string') {
                        if (!json5 || typeof (item1) !== 'number') {
                            fail('Wrong key type: ' + item1);
                        }
                    }
                    if ((item1 in empty_object || empty_object[item1] != null) && options.reserved_keys !== 'replace') {
                        if (options.reserved_keys === 'throw') {
                            fail('Reserved key: ' + item1);
                        }
                        else {
                            // silently ignore it
                        }
                    }
                    else {
                        if (typeof (options.reviver) === 'function') {
                            item2 = options.reviver.call(null, item1, item2);
                        }
                        if (item2 !== undefined) {
                            is_non_empty = true;
                            Object.defineProperty(result, item1, {
                                value: item2,
                                enumerable: true,
                                configurable: true,
                                writable: true,
                            });
                        }
                    }
                    skipWhiteSpace();
                    tokenStart();
                    var chr = input[position++];
                    tokenEnd(undefined, 'separator');
                    if (chr === ',') {
                        continue;
                    }
                    else if (chr === '}') {
                        return result;
                    }
                    else {
                        fail();
                    }
                }
                else {
                    position--;
                    fail();
                }
            }
            fail();
        }
        function parseArray() {
            var result = [];
            while (position < length) {
                skipWhiteSpace();
                stack.push(result.length);
                var item = parseGeneric();
                stack.pop();
                skipWhiteSpace();
                tokenStart();
                var chr = input[position++];
                tokenEnd(undefined, 'separator');
                if (item !== undefined) {
                    if (typeof (options.reviver) === 'function') {
                        item = options.reviver.call(null, String(result.length), item);
                    }
                    if (item === undefined) {
                        result.length++;
                        item = true; // hack for check below, not included into result
                    }
                    else {
                        result.push(item);
                    }
                }
                if (chr === ',') {
                    if (item === undefined) {
                        fail('Elisions are not supported');
                    }
                }
                else if (chr === ']') {
                    if (!json5 && item === undefined && result.length) {
                        position--;
                        fail('Trailing comma in array');
                    }
                    return result;
                }
                else {
                    position--;
                    fail();
                }
            }
        }
        function parseNumber() {
            // rewind because we don't know first char
            position--;
            var start = position, chr = input[position++], t;
            var to_num = function (is_octal) {
                var str = input.substr(start, position - start);
                if (is_octal) {
                    var result = parseInt(str.replace(/^0o?/, ''), 8);
                }
                else {
                    var result = Number(str);
                }
                if (Number.isNaN(result)) {
                    position--;
                    fail('Bad numeric literal - "' + input.substr(start, position - start + 1) + '"');
                }
                else if (!json5 && !str.match(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?(e[+-]?[0-9]+)?$/i)) {
                    // additional restrictions imposed by json
                    position--;
                    fail('Non-json numeric literal - "' + input.substr(start, position - start + 1) + '"');
                }
                else {
                    return result;
                }
            };
            // ex: -5982475.249875e+29384
            //     ^ skipping this
            if (chr === '-' || (chr === '+' && json5))
                chr = input[position++];
            if (chr === 'N' && json5) {
                parseKeyword('NaN');
                return NaN;
            }
            if (chr === 'I' && json5) {
                parseKeyword('Infinity');
                // returning +inf or -inf
                return to_num();
            }
            if (chr >= '1' && chr <= '9') {
                // ex: -5982475.249875e+29384
                //        ^^^ skipping these
                while (position < length && isDecDigit(input[position]))
                    position++;
                chr = input[position++];
            }
            // special case for leading zero: 0.123456
            if (chr === '0') {
                chr = input[position++];
                //             new syntax, "0o777"           old syntax, "0777"
                var is_octal = chr === 'o' || chr === 'O' || isOctDigit(chr);
                var is_hex = chr === 'x' || chr === 'X';
                if (json5 && (is_octal || is_hex)) {
                    while (position < length
                        && (is_hex ? isHexDigit : isOctDigit)(input[position]))
                        position++;
                    var sign = 1;
                    if (input[start] === '-') {
                        sign = -1;
                        start++;
                    }
                    else if (input[start] === '+') {
                        start++;
                    }
                    return sign * to_num(is_octal);
                }
            }
            if (chr === '.') {
                // ex: -5982475.249875e+29384
                //                ^^^ skipping these
                while (position < length && isDecDigit(input[position]))
                    position++;
                chr = input[position++];
            }
            if (chr === 'e' || chr === 'E') {
                chr = input[position++];
                if (chr === '-' || chr === '+')
                    position++;
                // ex: -5982475.249875e+29384
                //                       ^^^ skipping these
                while (position < length && isDecDigit(input[position]))
                    position++;
                chr = input[position++];
            }
            // we have char in the buffer, so count for it
            position--;
            return to_num();
        }
        function parseIdentifier() {
            // rewind because we don't know first char
            position--;
            var result = '';
            while (position < length) {
                var chr = input[position++];
                if (chr === '\\'
                    && input[position] === 'u'
                    && isHexDigit(input[position + 1])
                    && isHexDigit(input[position + 2])
                    && isHexDigit(input[position + 3])
                    && isHexDigit(input[position + 4])) {
                    // UnicodeEscapeSequence
                    chr = String.fromCharCode(parseInt(input.substr(position + 1, 4), 16));
                    position += 5;
                }
                if (result.length) {
                    // identifier started
                    if (Uni.isIdentifierPart(chr)) {
                        result += chr;
                    }
                    else {
                        position--;
                        return result;
                    }
                }
                else {
                    if (Uni.isIdentifierStart(chr)) {
                        result += chr;
                    }
                    else {
                        return undefined;
                    }
                }
            }
            fail();
        }
        function parseString(endChar) {
            // 7.8.4 of ES262 spec
            var result = '';
            while (position < length) {
                var chr = input[position++];
                if (chr === endChar) {
                    return result;
                }
                else if (chr === '\\') {
                    if (position >= length)
                        fail();
                    chr = input[position++];
                    if (unescapeMap[chr] && (json5 || (chr != 'v' && chr != "'"))) {
                        result += unescapeMap[chr];
                    }
                    else if (json5 && isLineTerminator(chr)) {
                        // line continuation
                        newline(chr);
                    }
                    else if (chr === 'u' || (chr === 'x' && json5)) {
                        // unicode/character escape sequence
                        var off = chr === 'u' ? 4 : 2;
                        // validation for \uXXXX
                        for (var i = 0; i < off; i++) {
                            if (position >= length)
                                fail();
                            if (!isHexDigit(input[position]))
                                fail('Bad escape sequence');
                            position++;
                        }
                        result += String.fromCharCode(parseInt(input.substr(position - off, off), 16));
                    }
                    else if (json5 && isOctDigit(chr)) {
                        if (chr < '4' && isOctDigit(input[position]) && isOctDigit(input[position + 1])) {
                            // three-digit octal
                            var digits = 3;
                        }
                        else if (isOctDigit(input[position])) {
                            // two-digit octal
                            var digits = 2;
                        }
                        else {
                            var digits = 1;
                        }
                        position += digits - 1;
                        result += String.fromCharCode(parseInt(input.substr(position - digits, digits), 8));
                        /*if (!isOctDigit(input[position])) {
                          // \0 is allowed still
                          result += '\0'
                        } else {
                          fail('Octal literals are not supported')
                        }*/
                    }
                    else if (json5) {
                        // \X -> x
                        result += chr;
                    }
                    else {
                        position--;
                        fail();
                    }
                }
                else if (isLineTerminator(chr)) {
                    fail();
                }
                else {
                    if (!json5 && chr.charCodeAt(0) < 32) {
                        position--;
                        fail('Unexpected control character');
                    }
                    // SourceCharacter but not one of " or \ or LineTerminator
                    result += chr;
                }
            }
            fail();
        }
        skipWhiteSpace();
        var return_value = parseGeneric();
        if (return_value !== undefined || position < length) {
            skipWhiteSpace();
            if (position >= length) {
                if (typeof (options.reviver) === 'function') {
                    return_value = options.reviver.call(null, '', return_value);
                }
                return return_value;
            }
            else {
                fail();
            }
        }
        else {
            if (position) {
                fail('No data, only a whitespace');
            }
            else {
                fail('No data, empty input');
            }
        }
    }
    /*
     * parse(text, options)
     * or
     * parse(text, reviver)
     *
     * where:
     * text - string
     * options - object
     * reviver - function
     */
    module.exports.parse = function parseJSON(input, options) {
        // support legacy functions
        if (typeof (options) === 'function') {
            options = {
                reviver: options
            };
        }
        if (input === undefined) {
            // parse(stringify(x)) should be equal x
            // with JSON functions it is not 'cause of undefined
            // so we're fixing it
            return undefined;
        }
        // JSON.parse compat
        if (typeof (input) !== 'string')
            input = String(input);
        if (options == null)
            options = {};
        if (options.reserved_keys == null)
            options.reserved_keys = 'ignore';
        if (options.reserved_keys === 'throw' || options.reserved_keys === 'ignore') {
            if (options.null_prototype == null) {
                options.null_prototype = true;
            }
        }
        try {
            return parse(input, options);
        }
        catch (err) {
            // jju is a recursive parser, so JSON.parse("{{{{{{{") could blow up the stack
            //
            // this catch is used to skip all those internal calls
            if (err instanceof SyntaxError && err.row != null && err.column != null) {
                var old_err = err;
                err = SyntaxError(old_err.message);
                err.column = old_err.column;
                err.row = old_err.row;
            }
            throw err;
        }
    };
    module.exports.tokenize = function tokenizeJSON(input, options) {
        if (options == null)
            options = {};
        options._tokenize = function (smth) {
            if (options._addstack)
                smth.stack.unshift.apply(smth.stack, options._addstack);
            tokens.push(smth);
        };
        var tokens = [];
        tokens.data = module.exports.parse(input, options);
        return tokens;
    };
});
var errorEx = index$60;
var fallback = parse_1;
var JSONError = errorEx('JSONError', {
    fileName: errorEx.append('in %s')
});
var index$58 = function (x, reviver, filename) {
    if (typeof reviver === 'string') {
        filename = reviver;
        reviver = null;
    }
    try {
        try {
            return JSON.parse(x, reviver);
        }
        catch (err) {
            fallback.parse(x, {
                mode: 'json',
                reviver: reviver
            });
            throw err;
        }
    }
    catch (err) {
        var jsonErr = new JSONError(err);
        if (filename) {
            jsonErr.fileName = filename;
        }
        throw jsonErr;
    }
};
var parseJson$1 = index$58;
var parseJson_1 = function (json, filepath) {
    try {
        return parseJson$1(json);
    }
    catch (err) {
        err.message = 'JSON Error in ' + filepath + ':\n' + err.message;
        throw err;
    }
};
var path$4 = require$$0$1;
var readFile = readFile$1;
var parseJson = parseJson_1;
var loadPackageProp$1 = function (packageDir, options) {
    var packagePath = path$4.join(packageDir, 'package.json');
    return readFile(packagePath).then(function (content) {
        if (!content)
            return null;
        var parsedContent = parseJson(content, packagePath);
        var packagePropValue = parsedContent[options.packageProp];
        if (!packagePropValue)
            return null;
        return {
            config: packagePropValue,
            filepath: packagePath,
        };
    });
};
function isNothing(subject) {
    return (typeof subject === 'undefined') || (subject === null);
}
function isObject(subject) {
    return (typeof subject === 'object') && (subject !== null);
}
function toArray(sequence) {
    if (Array.isArray(sequence))
        return sequence;
    else if (isNothing(sequence))
        return [];
    return [sequence];
}
function extend(target, source) {
    var index, length, key, sourceKeys;
    if (source) {
        sourceKeys = Object.keys(source);
        for (index = 0, length = sourceKeys.length; index < length; index += 1) {
            key = sourceKeys[index];
            target[key] = source[key];
        }
    }
    return target;
}
function repeat(string, count) {
    var result = '', cycle;
    for (cycle = 0; cycle < count; cycle += 1) {
        result += string;
    }
    return result;
}
function isNegativeZero(number) {
    return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number);
}
var isNothing_1 = isNothing;
var isObject_1 = isObject;
var toArray_1 = toArray;
var repeat_1 = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1 = extend;
var common$1 = {
    isNothing: isNothing_1,
    isObject: isObject_1,
    toArray: toArray_1,
    repeat: repeat_1,
    isNegativeZero: isNegativeZero_1,
    extend: extend_1
};
// YAML error class. http://stackoverflow.com/questions/8458984
//
function YAMLException$2(reason, mark) {
    // Super constructor
    Error.call(this);
    // Include stack trace in error object
    if (Error.captureStackTrace) {
        // Chrome and NodeJS
        Error.captureStackTrace(this, this.constructor);
    }
    else {
        // FF, IE 10+ and Safari 6+. Fallback for others
        this.stack = (new Error()).stack || '';
    }
    this.name = 'YAMLException';
    this.reason = reason;
    this.mark = mark;
    this.message = (this.reason || '(unknown reason)') + (this.mark ? ' ' + this.mark.toString() : '');
}
// Inherit from Error
YAMLException$2.prototype = Object.create(Error.prototype);
YAMLException$2.prototype.constructor = YAMLException$2;
YAMLException$2.prototype.toString = function toString(compact) {
    var result = this.name + ': ';
    result += this.reason || '(unknown reason)';
    if (!compact && this.mark) {
        result += ' ' + this.mark.toString();
    }
    return result;
};
var exception = YAMLException$2;
var common$3 = common$1;
function Mark$1(name, buffer, position, line, column) {
    this.name = name;
    this.buffer = buffer;
    this.position = position;
    this.line = line;
    this.column = column;
}
Mark$1.prototype.getSnippet = function getSnippet(indent, maxLength) {
    var head, start, tail, end, snippet;
    if (!this.buffer)
        return null;
    indent = indent || 4;
    maxLength = maxLength || 75;
    head = '';
    start = this.position;
    while (start > 0 && '\x00\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(start - 1)) === -1) {
        start -= 1;
        if (this.position - start > (maxLength / 2 - 1)) {
            head = ' ... ';
            start += 5;
            break;
        }
    }
    tail = '';
    end = this.position;
    while (end < this.buffer.length && '\x00\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(end)) === -1) {
        end += 1;
        if (end - this.position > (maxLength / 2 - 1)) {
            tail = ' ... ';
            end -= 5;
            break;
        }
    }
    snippet = this.buffer.slice(start, end);
    return common$3.repeat(' ', indent) + head + snippet + tail + '\n' +
        common$3.repeat(' ', indent + this.position - start + head.length) + '^';
};
Mark$1.prototype.toString = function toString(compact) {
    var snippet, where = '';
    if (this.name) {
        where += 'in "' + this.name + '" ';
    }
    where += 'at line ' + (this.line + 1) + ', column ' + (this.column + 1);
    if (!compact) {
        snippet = this.getSnippet();
        if (snippet) {
            where += ':\n' + snippet;
        }
    }
    return where;
};
var mark = Mark$1;
var YAMLException$4 = exception;
var TYPE_CONSTRUCTOR_OPTIONS = [
    'kind',
    'resolve',
    'construct',
    'instanceOf',
    'predicate',
    'represent',
    'defaultStyle',
    'styleAliases'
];
var YAML_NODE_KINDS = [
    'scalar',
    'sequence',
    'mapping'
];
function compileStyleAliases(map) {
    var result = {};
    if (map !== null) {
        Object.keys(map).forEach(function (style) {
            map[style].forEach(function (alias) {
                result[String(alias)] = style;
            });
        });
    }
    return result;
}
function Type$2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function (name) {
        if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
            throw new YAMLException$4('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
        }
    });
    // TODO: Add tag format check.
    this.tag = tag;
    this.kind = options['kind'] || null;
    this.resolve = options['resolve'] || function () { return true; };
    this.construct = options['construct'] || function (data) { return data; };
    this.instanceOf = options['instanceOf'] || null;
    this.predicate = options['predicate'] || null;
    this.represent = options['represent'] || null;
    this.defaultStyle = options['defaultStyle'] || null;
    this.styleAliases = compileStyleAliases(options['styleAliases'] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
        throw new YAMLException$4('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
}
var type = Type$2;
/*eslint-disable max-len*/
var common$4 = common$1;
var YAMLException$3 = exception;
var Type$1 = type;
function compileList(schema, name, result) {
    var exclude = [];
    schema.include.forEach(function (includedSchema) {
        result = compileList(includedSchema, name, result);
    });
    schema[name].forEach(function (currentType) {
        result.forEach(function (previousType, previousIndex) {
            if (previousType.tag === currentType.tag && previousType.kind === currentType.kind) {
                exclude.push(previousIndex);
            }
        });
        result.push(currentType);
    });
    return result.filter(function (type$$1, index) {
        return exclude.indexOf(index) === -1;
    });
}
function compileMap() {
    var result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {}
    }, index, length;
    function collectType(type$$1) {
        result[type$$1.kind][type$$1.tag] = result['fallback'][type$$1.tag] = type$$1;
    }
    for (index = 0, length = arguments.length; index < length; index += 1) {
        arguments[index].forEach(collectType);
    }
    return result;
}
function Schema$2(definition) {
    this.include = definition.include || [];
    this.implicit = definition.implicit || [];
    this.explicit = definition.explicit || [];
    this.implicit.forEach(function (type$$1) {
        if (type$$1.loadKind && type$$1.loadKind !== 'scalar') {
            throw new YAMLException$3('There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.');
        }
    });
    this.compiledImplicit = compileList(this, 'implicit', []);
    this.compiledExplicit = compileList(this, 'explicit', []);
    this.compiledTypeMap = compileMap(this.compiledImplicit, this.compiledExplicit);
}
Schema$2.DEFAULT = null;
Schema$2.create = function createSchema() {
    var schemas, types;
    switch (arguments.length) {
        case 1:
            schemas = Schema$2.DEFAULT;
            types = arguments[0];
            break;
        case 2:
            schemas = arguments[0];
            types = arguments[1];
            break;
        default:
            throw new YAMLException$3('Wrong number of arguments for Schema.create function');
    }
    schemas = common$4.toArray(schemas);
    types = common$4.toArray(types);
    if (!schemas.every(function (schema) { return schema instanceof Schema$2; })) {
        throw new YAMLException$3('Specified list of super schemas (or a single Schema object) contains a non-Schema object.');
    }
    if (!types.every(function (type$$1) { return type$$1 instanceof Type$1; })) {
        throw new YAMLException$3('Specified list of YAML types (or a single Type object) contains a non-Type object.');
    }
    return new Schema$2({
        include: schemas,
        explicit: types
    });
};
var schema = Schema$2;
var Type$3 = type;
var str = new Type$3('tag:yaml.org,2002:str', {
    kind: 'scalar',
    construct: function (data) { return data !== null ? data : ''; }
});
var Type$4 = type;
var seq = new Type$4('tag:yaml.org,2002:seq', {
    kind: 'sequence',
    construct: function (data) { return data !== null ? data : []; }
});
var Type$5 = type;
var map = new Type$5('tag:yaml.org,2002:map', {
    kind: 'mapping',
    construct: function (data) { return data !== null ? data : {}; }
});
var Schema$5 = schema;
var failsafe = new Schema$5({
    explicit: [
        str,
        seq,
        map
    ]
});
var Type$6 = type;
function resolveYamlNull(data) {
    if (data === null)
        return true;
    var max = data.length;
    return (max === 1 && data === '~') ||
        (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'));
}
function constructYamlNull() {
    return null;
}
function isNull(object) {
    return object === null;
}
var _null = new Type$6('tag:yaml.org,2002:null', {
    kind: 'scalar',
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
        canonical: function () { return '~'; },
        lowercase: function () { return 'null'; },
        uppercase: function () { return 'NULL'; },
        camelcase: function () { return 'Null'; }
    },
    defaultStyle: 'lowercase'
});
var Type$7 = type;
function resolveYamlBoolean(data) {
    if (data === null)
        return false;
    var max = data.length;
    return (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
        (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'));
}
function constructYamlBoolean(data) {
    return data === 'true' ||
        data === 'True' ||
        data === 'TRUE';
}
function isBoolean(object) {
    return Object.prototype.toString.call(object) === '[object Boolean]';
}
var bool = new Type$7('tag:yaml.org,2002:bool', {
    kind: 'scalar',
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
        lowercase: function (object) { return object ? 'true' : 'false'; },
        uppercase: function (object) { return object ? 'TRUE' : 'FALSE'; },
        camelcase: function (object) { return object ? 'True' : 'False'; }
    },
    defaultStyle: 'lowercase'
});
var common$5 = common$1;
var Type$8 = type;
function isHexCode(c) {
    return ((0x30 /* 0 */ <= c) && (c <= 0x39 /* 9 */)) ||
        ((0x41 /* A */ <= c) && (c <= 0x46 /* F */)) ||
        ((0x61 /* a */ <= c) && (c <= 0x66 /* f */));
}
function isOctCode(c) {
    return ((0x30 /* 0 */ <= c) && (c <= 0x37 /* 7 */));
}
function isDecCode(c) {
    return ((0x30 /* 0 */ <= c) && (c <= 0x39 /* 9 */));
}
function resolveYamlInteger(data) {
    if (data === null)
        return false;
    var max = data.length, index = 0, hasDigits = false, ch;
    if (!max)
        return false;
    ch = data[index];
    // sign
    if (ch === '-' || ch === '+') {
        ch = data[++index];
    }
    if (ch === '0') {
        // 0
        if (index + 1 === max)
            return true;
        ch = data[++index];
        // base 2, base 8, base 16
        if (ch === 'b') {
            // base 2
            index++;
            for (; index < max; index++) {
                ch = data[index];
                if (ch === '_')
                    continue;
                if (ch !== '0' && ch !== '1')
                    return false;
                hasDigits = true;
            }
            return hasDigits && ch !== '_';
        }
        if (ch === 'x') {
            // base 16
            index++;
            for (; index < max; index++) {
                ch = data[index];
                if (ch === '_')
                    continue;
                if (!isHexCode(data.charCodeAt(index)))
                    return false;
                hasDigits = true;
            }
            return hasDigits && ch !== '_';
        }
        // base 8
        for (; index < max; index++) {
            ch = data[index];
            if (ch === '_')
                continue;
            if (!isOctCode(data.charCodeAt(index)))
                return false;
            hasDigits = true;
        }
        return hasDigits && ch !== '_';
    }
    // base 10 (except 0) or base 60
    // value should not start with `_`;
    if (ch === '_')
        return false;
    for (; index < max; index++) {
        ch = data[index];
        if (ch === '_')
            continue;
        if (ch === ':')
            break;
        if (!isDecCode(data.charCodeAt(index))) {
            return false;
        }
        hasDigits = true;
    }
    // Should have digits and should not end with `_`
    if (!hasDigits || ch === '_')
        return false;
    // if !base60 - done;
    if (ch !== ':')
        return true;
    // base60 almost not used, no needs to optimize
    return /^(:[0-5]?[0-9])+$/.test(data.slice(index));
}
function constructYamlInteger(data) {
    var value = data, sign = 1, ch, base, digits = [];
    if (value.indexOf('_') !== -1) {
        value = value.replace(/_/g, '');
    }
    ch = value[0];
    if (ch === '-' || ch === '+') {
        if (ch === '-')
            sign = -1;
        value = value.slice(1);
        ch = value[0];
    }
    if (value === '0')
        return 0;
    if (ch === '0') {
        if (value[1] === 'b')
            return sign * parseInt(value.slice(2), 2);
        if (value[1] === 'x')
            return sign * parseInt(value, 16);
        return sign * parseInt(value, 8);
    }
    if (value.indexOf(':') !== -1) {
        value.split(':').forEach(function (v) {
            digits.unshift(parseInt(v, 10));
        });
        value = 0;
        base = 1;
        digits.forEach(function (d) {
            value += (d * base);
            base *= 60;
        });
        return sign * value;
    }
    return sign * parseInt(value, 10);
}
function isInteger(object) {
    return (Object.prototype.toString.call(object)) === '[object Number]' &&
        (object % 1 === 0 && !common$5.isNegativeZero(object));
}
var int_1 = new Type$8('tag:yaml.org,2002:int', {
    kind: 'scalar',
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
        binary: function (object) { return '0b' + object.toString(2); },
        octal: function (object) { return '0' + object.toString(8); },
        decimal: function (object) { return object.toString(10); },
        hexadecimal: function (object) { return '0x' + object.toString(16).toUpperCase(); }
    },
    defaultStyle: 'decimal',
    styleAliases: {
        binary: [2, 'bin'],
        octal: [8, 'oct'],
        decimal: [10, 'dec'],
        hexadecimal: [16, 'hex']
    }
});
var common$6 = common$1;
var Type$9 = type;
var YAML_FLOAT_PATTERN = new RegExp(
// 2.5e4, 2.5 and integers
'^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?' +
    // .2e4, .2
    // special case, seems not from spec
    '|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?' +
    // 20:59
    '|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*' +
    // .inf
    '|[-+]?\\.(?:inf|Inf|INF)' +
    // .nan
    '|\\.(?:nan|NaN|NAN))$');
function resolveYamlFloat(data) {
    if (data === null)
        return false;
    if (!YAML_FLOAT_PATTERN.test(data) ||
        // Quick hack to not allow integers end with `_`
        // Probably should update regexp & check speed
        data[data.length - 1] === '_') {
        return false;
    }
    return true;
}
function constructYamlFloat(data) {
    var value, sign, base, digits;
    value = data.replace(/_/g, '').toLowerCase();
    sign = value[0] === '-' ? -1 : 1;
    digits = [];
    if ('+-'.indexOf(value[0]) >= 0) {
        value = value.slice(1);
    }
    if (value === '.inf') {
        return (sign === 1) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }
    else if (value === '.nan') {
        return NaN;
    }
    else if (value.indexOf(':') >= 0) {
        value.split(':').forEach(function (v) {
            digits.unshift(parseFloat(v, 10));
        });
        value = 0.0;
        base = 1;
        digits.forEach(function (d) {
            value += d * base;
            base *= 60;
        });
        return sign * value;
    }
    return sign * parseFloat(value, 10);
}
var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
function representYamlFloat(object, style) {
    var res;
    if (isNaN(object)) {
        switch (style) {
            case 'lowercase': return '.nan';
            case 'uppercase': return '.NAN';
            case 'camelcase': return '.NaN';
        }
    }
    else if (Number.POSITIVE_INFINITY === object) {
        switch (style) {
            case 'lowercase': return '.inf';
            case 'uppercase': return '.INF';
            case 'camelcase': return '.Inf';
        }
    }
    else if (Number.NEGATIVE_INFINITY === object) {
        switch (style) {
            case 'lowercase': return '-.inf';
            case 'uppercase': return '-.INF';
            case 'camelcase': return '-.Inf';
        }
    }
    else if (common$6.isNegativeZero(object)) {
        return '-0.0';
    }
    res = object.toString(10);
    // JS stringifier can build scientific format without dots: 5e-100,
    // while YAML requres dot: 5.e-100. Fix it with simple hack
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
}
function isFloat(object) {
    return (Object.prototype.toString.call(object) === '[object Number]') &&
        (object % 1 !== 0 || common$6.isNegativeZero(object));
}
var float_1 = new Type$9('tag:yaml.org,2002:float', {
    kind: 'scalar',
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: 'lowercase'
});
var Schema$4 = schema;
var json = new Schema$4({
    include: [
        failsafe
    ],
    implicit: [
        _null,
        bool,
        int_1,
        float_1
    ]
});
var Schema$3 = schema;
var core = new Schema$3({
    include: [
        json
    ]
});
var Type$10 = type;
var YAML_DATE_REGEXP = new RegExp('^([0-9][0-9][0-9][0-9])' +
    '-([0-9][0-9])' +
    '-([0-9][0-9])$'); // [3] day
var YAML_TIMESTAMP_REGEXP = new RegExp('^([0-9][0-9][0-9][0-9])' +
    '-([0-9][0-9]?)' +
    '-([0-9][0-9]?)' +
    '(?:[Tt]|[ \\t]+)' +
    '([0-9][0-9]?)' +
    ':([0-9][0-9])' +
    ':([0-9][0-9])' +
    '(?:\\.([0-9]*))?' +
    '(?:[ \\t]*(Z|([-+])([0-9][0-9]?)' +
    '(?::([0-9][0-9]))?))?$'); // [11] tz_minute
function resolveYamlTimestamp(data) {
    if (data === null)
        return false;
    if (YAML_DATE_REGEXP.exec(data) !== null)
        return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null)
        return true;
    return false;
}
function constructYamlTimestamp(data) {
    var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
    match = YAML_DATE_REGEXP.exec(data);
    if (match === null)
        match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null)
        throw new Error('Date resolve error');
    // match: [1] year [2] month [3] day
    year = +(match[1]);
    month = +(match[2]) - 1; // JS month starts with 0
    day = +(match[3]);
    if (!match[4]) {
        return new Date(Date.UTC(year, month, day));
    }
    // match: [4] hour [5] minute [6] second [7] fraction
    hour = +(match[4]);
    minute = +(match[5]);
    second = +(match[6]);
    if (match[7]) {
        fraction = match[7].slice(0, 3);
        while (fraction.length < 3) {
            fraction += '0';
        }
        fraction = +fraction;
    }
    // match: [8] tz [9] tz_sign [10] tz_hour [11] tz_minute
    if (match[9]) {
        tz_hour = +(match[10]);
        tz_minute = +(match[11] || 0);
        delta = (tz_hour * 60 + tz_minute) * 60000; // delta in mili-seconds
        if (match[9] === '-')
            delta = -delta;
    }
    date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta)
        date.setTime(date.getTime() - delta);
    return date;
}
function representYamlTimestamp(object /*, style*/) {
    return object.toISOString();
}
var timestamp = new Type$10('tag:yaml.org,2002:timestamp', {
    kind: 'scalar',
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
});
var Type$11 = type;
function resolveYamlMerge(data) {
    return data === '<<' || data === null;
}
var merge = new Type$11('tag:yaml.org,2002:merge', {
    kind: 'scalar',
    resolve: resolveYamlMerge
});
/*eslint-disable no-bitwise*/
var NodeBuffer;
try {
    // A trick for browserified version, to not include `Buffer` shim
    var _require$4 = commonjsRequire;
    NodeBuffer = _require$4('buffer').Buffer;
}
catch (__) { }
var Type$12 = type;
// [ 64, 65, 66 ] -> [ padding, CR, LF ]
var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';
function resolveYamlBinary(data) {
    if (data === null)
        return false;
    var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;
    // Convert one by one.
    for (idx = 0; idx < max; idx++) {
        code = map.indexOf(data.charAt(idx));
        // Skip CR/LF
        if (code > 64)
            continue;
        // Fail on illegal characters
        if (code < 0)
            return false;
        bitlen += 6;
    }
    // If there are any bits left, source was corrupted
    return (bitlen % 8) === 0;
}
function constructYamlBinary(data) {
    var idx, tailbits, input = data.replace(/[\r\n=]/g, ''), // remove CR/LF & padding to simplify scan
    max = input.length, map = BASE64_MAP, bits = 0, result = [];
    // Collect by 6*4 bits (3 bytes)
    for (idx = 0; idx < max; idx++) {
        if ((idx % 4 === 0) && idx) {
            result.push((bits >> 16) & 0xFF);
            result.push((bits >> 8) & 0xFF);
            result.push(bits & 0xFF);
        }
        bits = (bits << 6) | map.indexOf(input.charAt(idx));
    }
    // Dump tail
    tailbits = (max % 4) * 6;
    if (tailbits === 0) {
        result.push((bits >> 16) & 0xFF);
        result.push((bits >> 8) & 0xFF);
        result.push(bits & 0xFF);
    }
    else if (tailbits === 18) {
        result.push((bits >> 10) & 0xFF);
        result.push((bits >> 2) & 0xFF);
    }
    else if (tailbits === 12) {
        result.push((bits >> 4) & 0xFF);
    }
    // Wrap into Buffer for NodeJS and leave Array for browser
    if (NodeBuffer) {
        // Support node 6.+ Buffer API when available
        return NodeBuffer.from ? NodeBuffer.from(result) : new NodeBuffer(result);
    }
    return result;
}
function representYamlBinary(object /*, style*/) {
    var result = '', bits = 0, idx, tail, max = object.length, map = BASE64_MAP;
    // Convert every three bytes to 4 ASCII characters.
    for (idx = 0; idx < max; idx++) {
        if ((idx % 3 === 0) && idx) {
            result += map[(bits >> 18) & 0x3F];
            result += map[(bits >> 12) & 0x3F];
            result += map[(bits >> 6) & 0x3F];
            result += map[bits & 0x3F];
        }
        bits = (bits << 8) + object[idx];
    }
    // Dump tail
    tail = max % 3;
    if (tail === 0) {
        result += map[(bits >> 18) & 0x3F];
        result += map[(bits >> 12) & 0x3F];
        result += map[(bits >> 6) & 0x3F];
        result += map[bits & 0x3F];
    }
    else if (tail === 2) {
        result += map[(bits >> 10) & 0x3F];
        result += map[(bits >> 4) & 0x3F];
        result += map[(bits << 2) & 0x3F];
        result += map[64];
    }
    else if (tail === 1) {
        result += map[(bits >> 2) & 0x3F];
        result += map[(bits << 4) & 0x3F];
        result += map[64];
        result += map[64];
    }
    return result;
}
function isBinary(object) {
    return NodeBuffer && NodeBuffer.isBuffer(object);
}
var binary = new Type$12('tag:yaml.org,2002:binary', {
    kind: 'scalar',
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
});
var Type$13 = type;
var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var _toString = Object.prototype.toString;
function resolveYamlOmap(data) {
    if (data === null)
        return true;
    var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
    for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];
        pairHasKey = false;
        if (_toString.call(pair) !== '[object Object]')
            return false;
        for (pairKey in pair) {
            if (_hasOwnProperty$1.call(pair, pairKey)) {
                if (!pairHasKey)
                    pairHasKey = true;
                else
                    return false;
            }
        }
        if (!pairHasKey)
            return false;
        if (objectKeys.indexOf(pairKey) === -1)
            objectKeys.push(pairKey);
        else
            return false;
    }
    return true;
}
function constructYamlOmap(data) {
    return data !== null ? data : [];
}
var omap = new Type$13('tag:yaml.org,2002:omap', {
    kind: 'sequence',
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
});
var Type$14 = type;
var _toString$1 = Object.prototype.toString;
function resolveYamlPairs(data) {
    if (data === null)
        return true;
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];
        if (_toString$1.call(pair) !== '[object Object]')
            return false;
        keys = Object.keys(pair);
        if (keys.length !== 1)
            return false;
        result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
}
function constructYamlPairs(data) {
    if (data === null)
        return [];
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length; index < length; index += 1) {
        pair = object[index];
        keys = Object.keys(pair);
        result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
}
var pairs = new Type$14('tag:yaml.org,2002:pairs', {
    kind: 'sequence',
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
});
var Type$15 = type;
var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
function resolveYamlSet(data) {
    if (data === null)
        return true;
    var key, object = data;
    for (key in object) {
        if (_hasOwnProperty$2.call(object, key)) {
            if (object[key] !== null)
                return false;
        }
    }
    return true;
}
function constructYamlSet(data) {
    return data !== null ? data : {};
}
var set = new Type$15('tag:yaml.org,2002:set', {
    kind: 'mapping',
    resolve: resolveYamlSet,
    construct: constructYamlSet
});
var Schema$1 = schema;
var default_safe = new Schema$1({
    include: [
        core
    ],
    implicit: [
        timestamp,
        merge
    ],
    explicit: [
        binary,
        omap,
        pairs,
        set
    ]
});
var Type$16 = type;
function resolveJavascriptUndefined() {
    return true;
}
function constructJavascriptUndefined() {
    /*eslint-disable no-undefined*/
    return undefined;
}
function representJavascriptUndefined() {
    return '';
}
function isUndefined(object) {
    return typeof object === 'undefined';
}
var _undefined = new Type$16('tag:yaml.org,2002:js/undefined', {
    kind: 'scalar',
    resolve: resolveJavascriptUndefined,
    construct: constructJavascriptUndefined,
    predicate: isUndefined,
    represent: representJavascriptUndefined
});
var Type$17 = type;
function resolveJavascriptRegExp(data) {
    if (data === null)
        return false;
    if (data.length === 0)
        return false;
    var regexp = data, tail = /\/([gim]*)$/.exec(data), modifiers = '';
    // if regexp starts with '/' it can have modifiers and must be properly closed
    // `/foo/gim` - modifiers tail can be maximum 3 chars
    if (regexp[0] === '/') {
        if (tail)
            modifiers = tail[1];
        if (modifiers.length > 3)
            return false;
        // if expression starts with /, is should be properly terminated
        if (regexp[regexp.length - modifiers.length - 1] !== '/')
            return false;
    }
    return true;
}
function constructJavascriptRegExp(data) {
    var regexp = data, tail = /\/([gim]*)$/.exec(data), modifiers = '';
    // `/foo/gim` - tail can be maximum 4 chars
    if (regexp[0] === '/') {
        if (tail)
            modifiers = tail[1];
        regexp = regexp.slice(1, regexp.length - modifiers.length - 1);
    }
    return new RegExp(regexp, modifiers);
}
function representJavascriptRegExp(object /*, style*/) {
    var result = '/' + object.source + '/';
    if (object.global)
        result += 'g';
    if (object.multiline)
        result += 'm';
    if (object.ignoreCase)
        result += 'i';
    return result;
}
function isRegExp(object) {
    return Object.prototype.toString.call(object) === '[object RegExp]';
}
var regexp = new Type$17('tag:yaml.org,2002:js/regexp', {
    kind: 'scalar',
    resolve: resolveJavascriptRegExp,
    construct: constructJavascriptRegExp,
    predicate: isRegExp,
    represent: representJavascriptRegExp
});
var esprima;
// Browserified version does not have esprima
//
// 1. For node.js just require module as deps
// 2. For browser try to require mudule via external AMD system.
//    If not found - try to fallback to window.esprima. If not
//    found too - then fail to parse.
//
try {
    // workaround to exclude package from browserify list.
    var _require$5 = commonjsRequire;
    esprima = _require$5('esprima');
}
catch (_) {
    /*global window */
    if (typeof window !== 'undefined')
        esprima = window.esprima;
}
var Type$18 = type;
function resolveJavascriptFunction(data) {
    if (data === null)
        return false;
    try {
        var source = '(' + data + ')', ast = esprima.parse(source, { range: true });
        if (ast.type !== 'Program' ||
            ast.body.length !== 1 ||
            ast.body[0].type !== 'ExpressionStatement' ||
            ast.body[0].expression.type !== 'FunctionExpression') {
            return false;
        }
        return true;
    }
    catch (err) {
        return false;
    }
}
function constructJavascriptFunction(data) {
    /*jslint evil:true*/
    var source = '(' + data + ')', ast = esprima.parse(source, { range: true }), params = [], body;
    if (ast.type !== 'Program' ||
        ast.body.length !== 1 ||
        ast.body[0].type !== 'ExpressionStatement' ||
        ast.body[0].expression.type !== 'FunctionExpression') {
        throw new Error('Failed to resolve function');
    }
    ast.body[0].expression.params.forEach(function (param) {
        params.push(param.name);
    });
    body = ast.body[0].expression.body.range;
    // Esprima's ranges include the first '{' and the last '}' characters on
    // function expressions. So cut them out.
    /*eslint-disable no-new-func*/
    return new Function(params, source.slice(body[0] + 1, body[1] - 1));
}
function representJavascriptFunction(object /*, style*/) {
    return object.toString();
}
function isFunction(object) {
    return Object.prototype.toString.call(object) === '[object Function]';
}
var _function = new Type$18('tag:yaml.org,2002:js/function', {
    kind: 'scalar',
    resolve: resolveJavascriptFunction,
    construct: constructJavascriptFunction,
    predicate: isFunction,
    represent: representJavascriptFunction
});
var Schema$6 = schema;
var default_full = Schema$6.DEFAULT = new Schema$6({
    include: [
        default_safe
    ],
    explicit: [
        _undefined,
        regexp,
        _function
    ]
});
/*eslint-disable max-len,no-use-before-define*/
var common = common$1;
var YAMLException$1 = exception;
var Mark = mark;
var DEFAULT_SAFE_SCHEMA$1 = default_safe;
var DEFAULT_FULL_SCHEMA$1 = default_full;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var CHOMPING_CLIP = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP = 3;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function is_EOL(c) {
    return (c === 0x0A /* LF */) || (c === 0x0D /* CR */);
}
function is_WHITE_SPACE(c) {
    return (c === 0x09 /* Tab */) || (c === 0x20 /* Space */);
}
function is_WS_OR_EOL(c) {
    return (c === 0x09 /* Tab */) ||
        (c === 0x20 /* Space */) ||
        (c === 0x0A /* LF */) ||
        (c === 0x0D /* CR */);
}
function is_FLOW_INDICATOR(c) {
    return c === 0x2C /* , */ ||
        c === 0x5B /* [ */ ||
        c === 0x5D /* ] */ ||
        c === 0x7B /* { */ ||
        c === 0x7D /* } */;
}
function fromHexCode(c) {
    var lc;
    if ((0x30 /* 0 */ <= c) && (c <= 0x39 /* 9 */)) {
        return c - 0x30;
    }
    /*eslint-disable no-bitwise*/
    lc = c | 0x20;
    if ((0x61 /* a */ <= lc) && (lc <= 0x66 /* f */)) {
        return lc - 0x61 + 10;
    }
    return -1;
}
function escapedHexLen(c) {
    if (c === 0x78 /* x */) {
        return 2;
    }
    if (c === 0x75 /* u */) {
        return 4;
    }
    if (c === 0x55 /* U */) {
        return 8;
    }
    return 0;
}
function fromDecimalCode(c) {
    if ((0x30 /* 0 */ <= c) && (c <= 0x39 /* 9 */)) {
        return c - 0x30;
    }
    return -1;
}
function simpleEscapeSequence(c) {
    return (c === 0x30 /* 0 */) ? '\x00' :
        (c === 0x61 /* a */) ? '\x07' :
            (c === 0x62 /* b */) ? '\x08' :
                (c === 0x74 /* t */) ? '\x09' :
                    (c === 0x09 /* Tab */) ? '\x09' :
                        (c === 0x6E /* n */) ? '\x0A' :
                            (c === 0x76 /* v */) ? '\x0B' :
                                (c === 0x66 /* f */) ? '\x0C' :
                                    (c === 0x72 /* r */) ? '\x0D' :
                                        (c === 0x65 /* e */) ? '\x1B' :
                                            (c === 0x20 /* Space */) ? ' ' :
                                                (c === 0x22 /* " */) ? '\x22' :
                                                    (c === 0x2F /* / */) ? '/' :
                                                        (c === 0x5C /* \ */) ? '\x5C' :
                                                            (c === 0x4E /* N */) ? '\x85' :
                                                                (c === 0x5F /* _ */) ? '\xA0' :
                                                                    (c === 0x4C /* L */) ? '\u2028' :
                                                                        (c === 0x50 /* P */) ? '\u2029' : '';
}
function charFromCodepoint(c) {
    if (c <= 0xFFFF) {
        return String.fromCharCode(c);
    }
    // Encode UTF-16 surrogate pair
    // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
    return String.fromCharCode(((c - 0x010000) >> 10) + 0xD800, ((c - 0x010000) & 0x03FF) + 0xDC00);
}
var simpleEscapeCheck = new Array(256); // integer, for fast access
var simpleEscapeMap = new Array(256);
for (var i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
}
function State(input, options) {
    this.input = input;
    this.filename = options['filename'] || null;
    this.schema = options['schema'] || DEFAULT_FULL_SCHEMA$1;
    this.onWarning = options['onWarning'] || null;
    this.legacy = options['legacy'] || false;
    this.json = options['json'] || false;
    this.listener = options['listener'] || null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.documents = [];
    /*
    this.version;
    this.checkLineBreaks;
    this.tagMap;
    this.anchorMap;
    this.tag;
    this.anchor;
    this.kind;
    this.result;*/
}
function generateError(state, message) {
    return new YAMLException$1(message, new Mark(state.filename, state.input, state.position, state.line, (state.position - state.lineStart)));
}
function throwError(state, message) {
    throw generateError(state, message);
}
function throwWarning(state, message) {
    if (state.onWarning) {
        state.onWarning.call(null, generateError(state, message));
    }
}
var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
        var match, major, minor;
        if (state.version !== null) {
            throwError(state, 'duplication of %YAML directive');
        }
        if (args.length !== 1) {
            throwError(state, 'YAML directive accepts exactly one argument');
        }
        match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
        if (match === null) {
            throwError(state, 'ill-formed argument of the YAML directive');
        }
        major = parseInt(match[1], 10);
        minor = parseInt(match[2], 10);
        if (major !== 1) {
            throwError(state, 'unacceptable YAML version of the document');
        }
        state.version = args[0];
        state.checkLineBreaks = (minor < 2);
        if (minor !== 1 && minor !== 2) {
            throwWarning(state, 'unsupported YAML version of the document');
        }
    },
    TAG: function handleTagDirective(state, name, args) {
        var handle, prefix;
        if (args.length !== 2) {
            throwError(state, 'TAG directive accepts exactly two arguments');
        }
        handle = args[0];
        prefix = args[1];
        if (!PATTERN_TAG_HANDLE.test(handle)) {
            throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
        }
        if (_hasOwnProperty.call(state.tagMap, handle)) {
            throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
        }
        if (!PATTERN_TAG_URI.test(prefix)) {
            throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
        }
        state.tagMap[handle] = prefix;
    }
};
function captureSegment(state, start, end, checkJson) {
    var _position, _length, _character, _result;
    if (start < end) {
        _result = state.input.slice(start, end);
        if (checkJson) {
            for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
                _character = _result.charCodeAt(_position);
                if (!(_character === 0x09 ||
                    (0x20 <= _character && _character <= 0x10FFFF))) {
                    throwError(state, 'expected valid JSON character');
                }
            }
        }
        else if (PATTERN_NON_PRINTABLE.test(_result)) {
            throwError(state, 'the stream contains non-printable characters');
        }
        state.result += _result;
    }
}
function mergeMappings(state, destination, source, overridableKeys) {
    var sourceKeys, key, index, quantity;
    if (!common.isObject(source)) {
        throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
    }
    sourceKeys = Object.keys(source);
    for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
        key = sourceKeys[index];
        if (!_hasOwnProperty.call(destination, key)) {
            destination[key] = source[key];
            overridableKeys[key] = true;
        }
    }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startPos) {
    var index, quantity;
    keyNode = String(keyNode);
    if (_result === null) {
        _result = {};
    }
    if (keyTag === 'tag:yaml.org,2002:merge') {
        if (Array.isArray(valueNode)) {
            for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
                mergeMappings(state, _result, valueNode[index], overridableKeys);
            }
        }
        else {
            mergeMappings(state, _result, valueNode, overridableKeys);
        }
    }
    else {
        if (!state.json &&
            !_hasOwnProperty.call(overridableKeys, keyNode) &&
            _hasOwnProperty.call(_result, keyNode)) {
            state.line = startLine || state.line;
            state.position = startPos || state.position;
            throwError(state, 'duplicated mapping key');
        }
        _result[keyNode] = valueNode;
        delete overridableKeys[keyNode];
    }
    return _result;
}
function readLineBreak(state) {
    var ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 0x0A /* LF */) {
        state.position++;
    }
    else if (ch === 0x0D /* CR */) {
        state.position++;
        if (state.input.charCodeAt(state.position) === 0x0A /* LF */) {
            state.position++;
        }
    }
    else {
        throwError(state, 'a line break is expected');
    }
    state.line += 1;
    state.lineStart = state.position;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
    var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
        }
        if (allowComments && ch === 0x23 /* # */) {
            do {
                ch = state.input.charCodeAt(++state.position);
            } while (ch !== 0x0A /* LF */ && ch !== 0x0D /* CR */ && ch !== 0);
        }
        if (is_EOL(ch)) {
            readLineBreak(state);
            ch = state.input.charCodeAt(state.position);
            lineBreaks++;
            state.lineIndent = 0;
            while (ch === 0x20 /* Space */) {
                state.lineIndent++;
                ch = state.input.charCodeAt(++state.position);
            }
        }
        else {
            break;
        }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
        throwWarning(state, 'deficient indentation');
    }
    return lineBreaks;
}
function testDocumentSeparator(state) {
    var _position = state.position, ch;
    ch = state.input.charCodeAt(_position);
    // Condition state.position === state.lineStart is tested
    // in parent on each call, for efficiency. No needs to test here again.
    if ((ch === 0x2D /* - */ || ch === 0x2E /* . */) &&
        ch === state.input.charCodeAt(_position + 1) &&
        ch === state.input.charCodeAt(_position + 2)) {
        _position += 3;
        ch = state.input.charCodeAt(_position);
        if (ch === 0 || is_WS_OR_EOL(ch)) {
            return true;
        }
    }
    return false;
}
function writeFoldedLines(state, count) {
    if (count === 1) {
        state.result += ' ';
    }
    else if (count > 1) {
        state.result += common.repeat('\n', count - 1);
    }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
    ch = state.input.charCodeAt(state.position);
    if (is_WS_OR_EOL(ch) ||
        is_FLOW_INDICATOR(ch) ||
        ch === 0x23 /* # */ ||
        ch === 0x26 /* & */ ||
        ch === 0x2A /* * */ ||
        ch === 0x21 /* ! */ ||
        ch === 0x7C /* | */ ||
        ch === 0x3E /* > */ ||
        ch === 0x27 /* ' */ ||
        ch === 0x22 /* " */ ||
        ch === 0x25 /* % */ ||
        ch === 0x40 /* @ */ ||
        ch === 0x60 /* ` */) {
        return false;
    }
    if (ch === 0x3F /* ? */ || ch === 0x2D /* - */) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following) ||
            withinFlowCollection && is_FLOW_INDICATOR(following)) {
            return false;
        }
    }
    state.kind = 'scalar';
    state.result = '';
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
        if (ch === 0x3A /* : */) {
            following = state.input.charCodeAt(state.position + 1);
            if (is_WS_OR_EOL(following) ||
                withinFlowCollection && is_FLOW_INDICATOR(following)) {
                break;
            }
        }
        else if (ch === 0x23 /* # */) {
            preceding = state.input.charCodeAt(state.position - 1);
            if (is_WS_OR_EOL(preceding)) {
                break;
            }
        }
        else if ((state.position === state.lineStart && testDocumentSeparator(state)) ||
            withinFlowCollection && is_FLOW_INDICATOR(ch)) {
            break;
        }
        else if (is_EOL(ch)) {
            _line = state.line;
            _lineStart = state.lineStart;
            _lineIndent = state.lineIndent;
            skipSeparationSpace(state, false, -1);
            if (state.lineIndent >= nodeIndent) {
                hasPendingContent = true;
                ch = state.input.charCodeAt(state.position);
                continue;
            }
            else {
                state.position = captureEnd;
                state.line = _line;
                state.lineStart = _lineStart;
                state.lineIndent = _lineIndent;
                break;
            }
        }
        if (hasPendingContent) {
            captureSegment(state, captureStart, captureEnd, false);
            writeFoldedLines(state, state.line - _line);
            captureStart = captureEnd = state.position;
            hasPendingContent = false;
        }
        if (!is_WHITE_SPACE(ch)) {
            captureEnd = state.position + 1;
        }
        ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
        return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
    var ch, captureStart, captureEnd;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 0x27 /* ' */) {
        return false;
    }
    state.kind = 'scalar';
    state.result = '';
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 0x27 /* ' */) {
            captureSegment(state, captureStart, state.position, true);
            ch = state.input.charCodeAt(++state.position);
            if (ch === 0x27 /* ' */) {
                captureStart = state.position;
                state.position++;
                captureEnd = state.position;
            }
            else {
                return true;
            }
        }
        else if (is_EOL(ch)) {
            captureSegment(state, captureStart, captureEnd, true);
            writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
            captureStart = captureEnd = state.position;
        }
        else if (state.position === state.lineStart && testDocumentSeparator(state)) {
            throwError(state, 'unexpected end of the document within a single quoted scalar');
        }
        else {
            state.position++;
            captureEnd = state.position;
        }
    }
    throwError(state, 'unexpected end of the stream within a single quoted scalar');
}
function readDoubleQuotedScalar(state, nodeIndent) {
    var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 0x22 /* " */) {
        return false;
    }
    state.kind = 'scalar';
    state.result = '';
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 0x22 /* " */) {
            captureSegment(state, captureStart, state.position, true);
            state.position++;
            return true;
        }
        else if (ch === 0x5C /* \ */) {
            captureSegment(state, captureStart, state.position, true);
            ch = state.input.charCodeAt(++state.position);
            if (is_EOL(ch)) {
                skipSeparationSpace(state, false, nodeIndent);
                // TODO: rework to inline fn with no type cast?
            }
            else if (ch < 256 && simpleEscapeCheck[ch]) {
                state.result += simpleEscapeMap[ch];
                state.position++;
            }
            else if ((tmp = escapedHexLen(ch)) > 0) {
                hexLength = tmp;
                hexResult = 0;
                for (; hexLength > 0; hexLength--) {
                    ch = state.input.charCodeAt(++state.position);
                    if ((tmp = fromHexCode(ch)) >= 0) {
                        hexResult = (hexResult << 4) + tmp;
                    }
                    else {
                        throwError(state, 'expected hexadecimal character');
                    }
                }
                state.result += charFromCodepoint(hexResult);
                state.position++;
            }
            else {
                throwError(state, 'unknown escape sequence');
            }
            captureStart = captureEnd = state.position;
        }
        else if (is_EOL(ch)) {
            captureSegment(state, captureStart, captureEnd, true);
            writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
            captureStart = captureEnd = state.position;
        }
        else if (state.position === state.lineStart && testDocumentSeparator(state)) {
            throwError(state, 'unexpected end of the document within a double quoted scalar');
        }
        else {
            state.position++;
            captureEnd = state.position;
        }
    }
    throwError(state, 'unexpected end of the stream within a double quoted scalar');
}
function readFlowCollection(state, nodeIndent) {
    var readNext = true, _line, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = {}, keyNode, keyTag, valueNode, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 0x5B /* [ */) {
        terminator = 0x5D; /* ] */
        isMapping = false;
        _result = [];
    }
    else if (ch === 0x7B /* { */) {
        terminator = 0x7D; /* } */
        isMapping = true;
        _result = {};
    }
    else {
        return false;
    }
    if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === terminator) {
            state.position++;
            state.tag = _tag;
            state.anchor = _anchor;
            state.kind = isMapping ? 'mapping' : 'sequence';
            state.result = _result;
            return true;
        }
        else if (!readNext) {
            throwError(state, 'missed comma between flow collection entries');
        }
        keyTag = keyNode = valueNode = null;
        isPair = isExplicitPair = false;
        if (ch === 0x3F /* ? */) {
            following = state.input.charCodeAt(state.position + 1);
            if (is_WS_OR_EOL(following)) {
                isPair = isExplicitPair = true;
                state.position++;
                skipSeparationSpace(state, true, nodeIndent);
            }
        }
        _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        keyTag = state.tag;
        keyNode = state.result;
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if ((isExplicitPair || state.line === _line) && ch === 0x3A /* : */) {
            isPair = true;
            ch = state.input.charCodeAt(++state.position);
            skipSeparationSpace(state, true, nodeIndent);
            composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
            valueNode = state.result;
        }
        if (isMapping) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode);
        }
        else if (isPair) {
            _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode));
        }
        else {
            _result.push(keyNode);
        }
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === 0x2C /* , */) {
            readNext = true;
            ch = state.input.charCodeAt(++state.position);
        }
        else {
            readNext = false;
        }
    }
    throwError(state, 'unexpected end of the stream within a flow collection');
}
function readBlockScalar(state, nodeIndent) {
    var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 0x7C /* | */) {
        folding = false;
    }
    else if (ch === 0x3E /* > */) {
        folding = true;
    }
    else {
        return false;
    }
    state.kind = 'scalar';
    state.result = '';
    while (ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
        if (ch === 0x2B /* + */ || ch === 0x2D /* - */) {
            if (CHOMPING_CLIP === chomping) {
                chomping = (ch === 0x2B /* + */) ? CHOMPING_KEEP : CHOMPING_STRIP;
            }
            else {
                throwError(state, 'repeat of a chomping mode identifier');
            }
        }
        else if ((tmp = fromDecimalCode(ch)) >= 0) {
            if (tmp === 0) {
                throwError(state, 'bad explicit indentation width of a block scalar; it cannot be less than one');
            }
            else if (!detectedIndent) {
                textIndent = nodeIndent + tmp - 1;
                detectedIndent = true;
            }
            else {
                throwError(state, 'repeat of an indentation width identifier');
            }
        }
        else {
            break;
        }
    }
    if (is_WHITE_SPACE(ch)) {
        do {
            ch = state.input.charCodeAt(++state.position);
        } while (is_WHITE_SPACE(ch));
        if (ch === 0x23 /* # */) {
            do {
                ch = state.input.charCodeAt(++state.position);
            } while (!is_EOL(ch) && (ch !== 0));
        }
    }
    while (ch !== 0) {
        readLineBreak(state);
        state.lineIndent = 0;
        ch = state.input.charCodeAt(state.position);
        while ((!detectedIndent || state.lineIndent < textIndent) &&
            (ch === 0x20 /* Space */)) {
            state.lineIndent++;
            ch = state.input.charCodeAt(++state.position);
        }
        if (!detectedIndent && state.lineIndent > textIndent) {
            textIndent = state.lineIndent;
        }
        if (is_EOL(ch)) {
            emptyLines++;
            continue;
        }
        // End of the scalar.
        if (state.lineIndent < textIndent) {
            // Perform the chomping.
            if (chomping === CHOMPING_KEEP) {
                state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
            }
            else if (chomping === CHOMPING_CLIP) {
                if (didReadContent) {
                    state.result += '\n';
                }
            }
            // Break this `while` cycle and go to the funciton's epilogue.
            break;
        }
        // Folded style: use fancy rules to handle line breaks.
        if (folding) {
            // Lines starting with white space characters (more-indented lines) are not folded.
            if (is_WHITE_SPACE(ch)) {
                atMoreIndented = true;
                // except for the first content line (cf. Example 8.1)
                state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
                // End of more-indented block.
            }
            else if (atMoreIndented) {
                atMoreIndented = false;
                state.result += common.repeat('\n', emptyLines + 1);
                // Just one line break - perceive as the same line.
            }
            else if (emptyLines === 0) {
                if (didReadContent) {
                    state.result += ' ';
                }
                // Several line breaks - perceive as different lines.
            }
            else {
                state.result += common.repeat('\n', emptyLines);
            }
            // Literal style: just add exact number of line breaks between content lines.
        }
        else {
            // Keep all line breaks except the header line break.
            state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
        }
        didReadContent = true;
        detectedIndent = true;
        emptyLines = 0;
        captureStart = state.position;
        while (!is_EOL(ch) && (ch !== 0)) {
            ch = state.input.charCodeAt(++state.position);
        }
        captureSegment(state, captureStart, state.position, false);
    }
    return true;
}
function readBlockSequence(state, nodeIndent) {
    var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
    if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
        if (ch !== 0x2D /* - */) {
            break;
        }
        following = state.input.charCodeAt(state.position + 1);
        if (!is_WS_OR_EOL(following)) {
            break;
        }
        detected = true;
        state.position++;
        if (skipSeparationSpace(state, true, -1)) {
            if (state.lineIndent <= nodeIndent) {
                _result.push(null);
                ch = state.input.charCodeAt(state.position);
                continue;
            }
        }
        _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        _result.push(state.result);
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
            throwError(state, 'bad indentation of a sequence entry');
        }
        else if (state.lineIndent < nodeIndent) {
            break;
        }
    }
    if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = 'sequence';
        state.result = _result;
        return true;
    }
    return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
    var following, allowCompact, _line, _pos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = {}, keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
    if (state.anchor !== null) {
        state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
        following = state.input.charCodeAt(state.position + 1);
        _line = state.line; // Save the current line.
        _pos = state.position;
        //
        // Explicit notation case. There are two separate blocks:
        // first for the key (denoted by "?") and second for the value (denoted by ":")
        //
        if ((ch === 0x3F /* ? */ || ch === 0x3A /* : */) && is_WS_OR_EOL(following)) {
            if (ch === 0x3F /* ? */) {
                if (atExplicitKey) {
                    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
                    keyTag = keyNode = valueNode = null;
                }
                detected = true;
                atExplicitKey = true;
                allowCompact = true;
            }
            else if (atExplicitKey) {
                // i.e. 0x3A/* : */ === character after the explicit key.
                atExplicitKey = false;
                allowCompact = true;
            }
            else {
                throwError(state, 'incomplete explicit mapping pair; a key node is missed');
            }
            state.position += 1;
            ch = following;
            //
            // Implicit notation case. Flow-style node as the key first, then ":", and the value.
            //
        }
        else if (composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
            if (state.line === _line) {
                ch = state.input.charCodeAt(state.position);
                while (is_WHITE_SPACE(ch)) {
                    ch = state.input.charCodeAt(++state.position);
                }
                if (ch === 0x3A /* : */) {
                    ch = state.input.charCodeAt(++state.position);
                    if (!is_WS_OR_EOL(ch)) {
                        throwError(state, 'a whitespace character is expected after the key-value separator within a block mapping');
                    }
                    if (atExplicitKey) {
                        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
                        keyTag = keyNode = valueNode = null;
                    }
                    detected = true;
                    atExplicitKey = false;
                    allowCompact = false;
                    keyTag = state.tag;
                    keyNode = state.result;
                }
                else if (detected) {
                    throwError(state, 'can not read an implicit mapping pair; a colon is missed');
                }
                else {
                    state.tag = _tag;
                    state.anchor = _anchor;
                    return true; // Keep the result of `composeNode`.
                }
            }
            else if (detected) {
                throwError(state, 'can not read a block mapping entry; a multiline key may not be an implicit key');
            }
            else {
                state.tag = _tag;
                state.anchor = _anchor;
                return true; // Keep the result of `composeNode`.
            }
        }
        else {
            break; // Reading is done. Go to the epilogue.
        }
        //
        // Common reading code for both explicit and implicit notations.
        //
        if (state.line === _line || state.lineIndent > nodeIndent) {
            if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
                if (atExplicitKey) {
                    keyNode = state.result;
                }
                else {
                    valueNode = state.result;
                }
            }
            if (!atExplicitKey) {
                storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _pos);
                keyTag = keyNode = valueNode = null;
            }
            skipSeparationSpace(state, true, -1);
            ch = state.input.charCodeAt(state.position);
        }
        if (state.lineIndent > nodeIndent && (ch !== 0)) {
            throwError(state, 'bad indentation of a mapping entry');
        }
        else if (state.lineIndent < nodeIndent) {
            break;
        }
    }
    //
    // Epilogue.
    //
    // Special case: last mapping's node contains only the key in explicit notation.
    if (atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
    }
    // Expose the resulting mapping.
    if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = 'mapping';
        state.result = _result;
    }
    return detected;
}
function readTagProperty(state) {
    var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 0x21 /* ! */)
        return false;
    if (state.tag !== null) {
        throwError(state, 'duplication of a tag property');
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 0x3C /* < */) {
        isVerbatim = true;
        ch = state.input.charCodeAt(++state.position);
    }
    else if (ch === 0x21 /* ! */) {
        isNamed = true;
        tagHandle = '!!';
        ch = state.input.charCodeAt(++state.position);
    }
    else {
        tagHandle = '!';
    }
    _position = state.position;
    if (isVerbatim) {
        do {
            ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && ch !== 0x3E /* > */);
        if (state.position < state.length) {
            tagName = state.input.slice(_position, state.position);
            ch = state.input.charCodeAt(++state.position);
        }
        else {
            throwError(state, 'unexpected end of the stream within a verbatim tag');
        }
    }
    else {
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
            if (ch === 0x21 /* ! */) {
                if (!isNamed) {
                    tagHandle = state.input.slice(_position - 1, state.position + 1);
                    if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
                        throwError(state, 'named tag handle cannot contain such characters');
                    }
                    isNamed = true;
                    _position = state.position + 1;
                }
                else {
                    throwError(state, 'tag suffix cannot contain exclamation marks');
                }
            }
            ch = state.input.charCodeAt(++state.position);
        }
        tagName = state.input.slice(_position, state.position);
        if (PATTERN_FLOW_INDICATORS.test(tagName)) {
            throwError(state, 'tag suffix cannot contain flow indicator characters');
        }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
        throwError(state, 'tag name cannot contain such characters: ' + tagName);
    }
    if (isVerbatim) {
        state.tag = tagName;
    }
    else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
        state.tag = state.tagMap[tagHandle] + tagName;
    }
    else if (tagHandle === '!') {
        state.tag = '!' + tagName;
    }
    else if (tagHandle === '!!') {
        state.tag = 'tag:yaml.org,2002:' + tagName;
    }
    else {
        throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
}
function readAnchorProperty(state) {
    var _position, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 0x26 /* & */)
        return false;
    if (state.anchor !== null) {
        throwError(state, 'duplication of an anchor property');
    }
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
        ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
        throwError(state, 'name of an anchor node must contain at least one character');
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
}
function readAlias(state) {
    var _position, alias, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 0x2A /* * */)
        return false;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
        ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
        throwError(state, 'name of an alias node must contain at least one character');
    }
    alias = state.input.slice(_position, state.position);
    if (!state.anchorMap.hasOwnProperty(alias)) {
        throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, // 1: this>parent, 0: this=parent, -1: this<parent
    atNewLine = false, hasContent = false, typeIndex, typeQuantity, type, flowIndent, blockIndent;
    if (state.listener !== null) {
        state.listener('open', state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    allowBlockStyles = allowBlockScalars = allowBlockCollections =
        CONTEXT_BLOCK_OUT === nodeContext ||
            CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
        if (skipSeparationSpace(state, true, -1)) {
            atNewLine = true;
            if (state.lineIndent > parentIndent) {
                indentStatus = 1;
            }
            else if (state.lineIndent === parentIndent) {
                indentStatus = 0;
            }
            else if (state.lineIndent < parentIndent) {
                indentStatus = -1;
            }
        }
    }
    if (indentStatus === 1) {
        while (readTagProperty(state) || readAnchorProperty(state)) {
            if (skipSeparationSpace(state, true, -1)) {
                atNewLine = true;
                allowBlockCollections = allowBlockStyles;
                if (state.lineIndent > parentIndent) {
                    indentStatus = 1;
                }
                else if (state.lineIndent === parentIndent) {
                    indentStatus = 0;
                }
                else if (state.lineIndent < parentIndent) {
                    indentStatus = -1;
                }
            }
            else {
                allowBlockCollections = false;
            }
        }
    }
    if (allowBlockCollections) {
        allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
        if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
            flowIndent = parentIndent;
        }
        else {
            flowIndent = parentIndent + 1;
        }
        blockIndent = state.position - state.lineStart;
        if (indentStatus === 1) {
            if (allowBlockCollections &&
                (readBlockSequence(state, blockIndent) ||
                    readBlockMapping(state, blockIndent, flowIndent)) ||
                readFlowCollection(state, flowIndent)) {
                hasContent = true;
            }
            else {
                if ((allowBlockScalars && readBlockScalar(state, flowIndent)) ||
                    readSingleQuotedScalar(state, flowIndent) ||
                    readDoubleQuotedScalar(state, flowIndent)) {
                    hasContent = true;
                }
                else if (readAlias(state)) {
                    hasContent = true;
                    if (state.tag !== null || state.anchor !== null) {
                        throwError(state, 'alias node should not have any properties');
                    }
                }
                else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
                    hasContent = true;
                    if (state.tag === null) {
                        state.tag = '?';
                    }
                }
                if (state.anchor !== null) {
                    state.anchorMap[state.anchor] = state.result;
                }
            }
        }
        else if (indentStatus === 0) {
            // Special case: block sequences are allowed to have same indentation level as the parent.
            // http://www.yaml.org/spec/1.2/spec.html#id2799784
            hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
    }
    if (state.tag !== null && state.tag !== '!') {
        if (state.tag === '?') {
            for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
                type = state.implicitTypes[typeIndex];
                // Implicit resolving is not allowed for non-scalar types, and '?'
                // non-specific tag is only assigned to plain scalars. So, it isn't
                // needed to check for 'kind' conformity.
                if (type.resolve(state.result)) {
                    state.result = type.construct(state.result);
                    state.tag = type.tag;
                    if (state.anchor !== null) {
                        state.anchorMap[state.anchor] = state.result;
                    }
                    break;
                }
            }
        }
        else if (_hasOwnProperty.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
            type = state.typeMap[state.kind || 'fallback'][state.tag];
            if (state.result !== null && type.kind !== state.kind) {
                throwError(state, 'unacceptable node kind for !<' + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
            }
            if (!type.resolve(state.result)) {
                throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
            }
            else {
                state.result = type.construct(state.result);
                if (state.anchor !== null) {
                    state.anchorMap[state.anchor] = state.result;
                }
            }
        }
        else {
            throwError(state, 'unknown tag !<' + state.tag + '>');
        }
    }
    if (state.listener !== null) {
        state.listener('close', state);
    }
    return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
    var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = {};
    state.anchorMap = {};
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if (state.lineIndent > 0 || ch !== 0x25 /* % */) {
            break;
        }
        hasDirectives = true;
        ch = state.input.charCodeAt(++state.position);
        _position = state.position;
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
            ch = state.input.charCodeAt(++state.position);
        }
        directiveName = state.input.slice(_position, state.position);
        directiveArgs = [];
        if (directiveName.length < 1) {
            throwError(state, 'directive name must not be less than one character in length');
        }
        while (ch !== 0) {
            while (is_WHITE_SPACE(ch)) {
                ch = state.input.charCodeAt(++state.position);
            }
            if (ch === 0x23 /* # */) {
                do {
                    ch = state.input.charCodeAt(++state.position);
                } while (ch !== 0 && !is_EOL(ch));
                break;
            }
            if (is_EOL(ch))
                break;
            _position = state.position;
            while (ch !== 0 && !is_WS_OR_EOL(ch)) {
                ch = state.input.charCodeAt(++state.position);
            }
            directiveArgs.push(state.input.slice(_position, state.position));
        }
        if (ch !== 0)
            readLineBreak(state);
        if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
            directiveHandlers[directiveName](state, directiveName, directiveArgs);
        }
        else {
            throwWarning(state, 'unknown document directive "' + directiveName + '"');
        }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 &&
        state.input.charCodeAt(state.position) === 0x2D /* - */ &&
        state.input.charCodeAt(state.position + 1) === 0x2D /* - */ &&
        state.input.charCodeAt(state.position + 2) === 0x2D /* - */) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
    }
    else if (hasDirectives) {
        throwError(state, 'directives end mark is expected');
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks &&
        PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
        throwWarning(state, 'non-ASCII line breaks are interpreted as content');
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
        if (state.input.charCodeAt(state.position) === 0x2E /* . */) {
            state.position += 3;
            skipSeparationSpace(state, true, -1);
        }
        return;
    }
    if (state.position < (state.length - 1)) {
        throwError(state, 'end of the stream or a document separator is expected');
    }
    else {
        return;
    }
}
function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
        // Add tailing `\n` if not exists
        if (input.charCodeAt(input.length - 1) !== 0x0A /* LF */ &&
            input.charCodeAt(input.length - 1) !== 0x0D /* CR */) {
            input += '\n';
        }
        // Strip BOM
        if (input.charCodeAt(0) === 0xFEFF) {
            input = input.slice(1);
        }
    }
    var state = new State(input, options);
    // Use 0 as string terminator. That significantly simplifies bounds check.
    state.input += '\0';
    while (state.input.charCodeAt(state.position) === 0x20 /* Space */) {
        state.lineIndent += 1;
        state.position += 1;
    }
    while (state.position < (state.length - 1)) {
        readDocument(state);
    }
    return state.documents;
}
function loadAll$1(input, iterator, options) {
    var documents = loadDocuments(input, options), index, length;
    for (index = 0, length = documents.length; index < length; index += 1) {
        iterator(documents[index]);
    }
}
function load$1(input, options) {
    var documents = loadDocuments(input, options);
    if (documents.length === 0) {
        /*eslint-disable no-undefined*/
        return undefined;
    }
    else if (documents.length === 1) {
        return documents[0];
    }
    throw new YAMLException$1('expected a single document in the stream, but found more');
}
function safeLoadAll$1(input, output, options) {
    loadAll$1(input, output, common.extend({ schema: DEFAULT_SAFE_SCHEMA$1 }, options));
}
function safeLoad$1(input, options) {
    return load$1(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA$1 }, options));
}
var loadAll_1 = loadAll$1;
var load_1 = load$1;
var safeLoadAll_1 = safeLoadAll$1;
var safeLoad_1 = safeLoad$1;
var loader$1 = {
    loadAll: loadAll_1,
    load: load_1,
    safeLoadAll: safeLoadAll_1,
    safeLoad: safeLoad_1
};
/*eslint-disable no-use-before-define*/
var common$7 = common$1;
var YAMLException$5 = exception;
var DEFAULT_FULL_SCHEMA$2 = default_full;
var DEFAULT_SAFE_SCHEMA$2 = default_safe;
var _toString$2 = Object.prototype.toString;
var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var CHAR_TAB = 0x09; /* Tab */
var CHAR_LINE_FEED = 0x0A; /* LF */
var CHAR_SPACE = 0x20; /* Space */
var CHAR_EXCLAMATION = 0x21; /* ! */
var CHAR_DOUBLE_QUOTE = 0x22; /* " */
var CHAR_SHARP = 0x23; /* # */
var CHAR_PERCENT = 0x25; /* % */
var CHAR_AMPERSAND = 0x26; /* & */
var CHAR_SINGLE_QUOTE = 0x27; /* ' */
var CHAR_ASTERISK = 0x2A; /* * */
var CHAR_COMMA = 0x2C; /* , */
var CHAR_MINUS = 0x2D; /* - */
var CHAR_COLON = 0x3A; /* : */
var CHAR_GREATER_THAN = 0x3E; /* > */
var CHAR_QUESTION = 0x3F; /* ? */
var CHAR_COMMERCIAL_AT = 0x40; /* @ */
var CHAR_LEFT_SQUARE_BRACKET = 0x5B; /* [ */
var CHAR_RIGHT_SQUARE_BRACKET = 0x5D; /* ] */
var CHAR_GRAVE_ACCENT = 0x60; /* ` */
var CHAR_LEFT_CURLY_BRACKET = 0x7B; /* { */
var CHAR_VERTICAL_LINE = 0x7C; /* | */
var CHAR_RIGHT_CURLY_BRACKET = 0x7D; /* } */
var ESCAPE_SEQUENCES = {};
ESCAPE_SEQUENCES[0x00] = '\\0';
ESCAPE_SEQUENCES[0x07] = '\\a';
ESCAPE_SEQUENCES[0x08] = '\\b';
ESCAPE_SEQUENCES[0x09] = '\\t';
ESCAPE_SEQUENCES[0x0A] = '\\n';
ESCAPE_SEQUENCES[0x0B] = '\\v';
ESCAPE_SEQUENCES[0x0C] = '\\f';
ESCAPE_SEQUENCES[0x0D] = '\\r';
ESCAPE_SEQUENCES[0x1B] = '\\e';
ESCAPE_SEQUENCES[0x22] = '\\"';
ESCAPE_SEQUENCES[0x5C] = '\\\\';
ESCAPE_SEQUENCES[0x85] = '\\N';
ESCAPE_SEQUENCES[0xA0] = '\\_';
ESCAPE_SEQUENCES[0x2028] = '\\L';
ESCAPE_SEQUENCES[0x2029] = '\\P';
var DEPRECATED_BOOLEANS_SYNTAX = [
    'y', 'Y', 'yes', 'Yes', 'YES', 'on', 'On', 'ON',
    'n', 'N', 'no', 'No', 'NO', 'off', 'Off', 'OFF'
];
function compileStyleMap(schema, map) {
    var result, keys, index, length, tag, style, type;
    if (map === null)
        return {};
    result = {};
    keys = Object.keys(map);
    for (index = 0, length = keys.length; index < length; index += 1) {
        tag = keys[index];
        style = String(map[tag]);
        if (tag.slice(0, 2) === '!!') {
            tag = 'tag:yaml.org,2002:' + tag.slice(2);
        }
        type = schema.compiledTypeMap['fallback'][tag];
        if (type && _hasOwnProperty$3.call(type.styleAliases, style)) {
            style = type.styleAliases[style];
        }
        result[tag] = style;
    }
    return result;
}
function encodeHex(character) {
    var string, handle, length;
    string = character.toString(16).toUpperCase();
    if (character <= 0xFF) {
        handle = 'x';
        length = 2;
    }
    else if (character <= 0xFFFF) {
        handle = 'u';
        length = 4;
    }
    else if (character <= 0xFFFFFFFF) {
        handle = 'U';
        length = 8;
    }
    else {
        throw new YAMLException$5('code point within a string may not be greater than 0xFFFFFFFF');
    }
    return '\\' + handle + common$7.repeat('0', length - string.length) + string;
}
function State$1(options) {
    this.schema = options['schema'] || DEFAULT_FULL_SCHEMA$2;
    this.indent = Math.max(1, (options['indent'] || 2));
    this.skipInvalid = options['skipInvalid'] || false;
    this.flowLevel = (common$7.isNothing(options['flowLevel']) ? -1 : options['flowLevel']);
    this.styleMap = compileStyleMap(this.schema, options['styles'] || null);
    this.sortKeys = options['sortKeys'] || false;
    this.lineWidth = options['lineWidth'] || 80;
    this.noRefs = options['noRefs'] || false;
    this.noCompatMode = options['noCompatMode'] || false;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = '';
    this.duplicates = [];
    this.usedDuplicates = null;
}
// Indents every line in a string. Empty lines (\n only) are not indented.
function indentString(string, spaces) {
    var ind = common$7.repeat(' ', spaces), position = 0, next = -1, result = '', line, length = string.length;
    while (position < length) {
        next = string.indexOf('\n', position);
        if (next === -1) {
            line = string.slice(position);
            position = length;
        }
        else {
            line = string.slice(position, next + 1);
            position = next + 1;
        }
        if (line.length && line !== '\n')
            result += ind;
        result += line;
    }
    return result;
}
function generateNextLine(state, level) {
    return '\n' + common$7.repeat(' ', state.indent * level);
}
function testImplicitResolving(state, str) {
    var index, length, type;
    for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
        type = state.implicitTypes[index];
        if (type.resolve(str)) {
            return true;
        }
    }
    return false;
}
// [33] s-white ::= s-space | s-tab
function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
}
// Returns true if the character can be printed without escaping.
// From YAML 1.2: "any allowed characters known to be non-printable
// should also be escaped. [However,] This isn’t mandatory"
// Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
function isPrintable(c) {
    return (0x00020 <= c && c <= 0x00007E)
        || ((0x000A1 <= c && c <= 0x00D7FF) && c !== 0x2028 && c !== 0x2029)
        || ((0x0E000 <= c && c <= 0x00FFFD) && c !== 0xFEFF /* BOM */)
        || (0x10000 <= c && c <= 0x10FFFF);
}
// Simplified test for values allowed after the first character in plain style.
function isPlainSafe(c) {
    // Uses a subset of nb-char - c-flow-indicator - ":" - "#"
    // where nb-char ::= c-printable - b-char - c-byte-order-mark.
    return isPrintable(c) && c !== 0xFEFF
        && c !== CHAR_COMMA
        && c !== CHAR_LEFT_SQUARE_BRACKET
        && c !== CHAR_RIGHT_SQUARE_BRACKET
        && c !== CHAR_LEFT_CURLY_BRACKET
        && c !== CHAR_RIGHT_CURLY_BRACKET
        && c !== CHAR_COLON
        && c !== CHAR_SHARP;
}
// Simplified test for values allowed as the first character in plain style.
function isPlainSafeFirst(c) {
    // Uses a subset of ns-char - c-indicator
    // where ns-char = nb-char - s-white.
    return isPrintable(c) && c !== 0xFEFF
        && !isWhitespace(c) // - s-white
        && c !== CHAR_MINUS
        && c !== CHAR_QUESTION
        && c !== CHAR_COLON
        && c !== CHAR_COMMA
        && c !== CHAR_LEFT_SQUARE_BRACKET
        && c !== CHAR_RIGHT_SQUARE_BRACKET
        && c !== CHAR_LEFT_CURLY_BRACKET
        && c !== CHAR_RIGHT_CURLY_BRACKET
        && c !== CHAR_SHARP
        && c !== CHAR_AMPERSAND
        && c !== CHAR_ASTERISK
        && c !== CHAR_EXCLAMATION
        && c !== CHAR_VERTICAL_LINE
        && c !== CHAR_GREATER_THAN
        && c !== CHAR_SINGLE_QUOTE
        && c !== CHAR_DOUBLE_QUOTE
        && c !== CHAR_PERCENT
        && c !== CHAR_COMMERCIAL_AT
        && c !== CHAR_GRAVE_ACCENT;
}
var STYLE_PLAIN = 1;
var STYLE_SINGLE = 2;
var STYLE_LITERAL = 3;
var STYLE_FOLDED = 4;
var STYLE_DOUBLE = 5;
// Determines which scalar styles are possible and returns the preferred style.
// lineWidth = -1 => no limit.
// Pre-conditions: str.length > 0.
// Post-conditions:
//    STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
//    STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
//    STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth != -1).
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType) {
    var i;
    var char;
    var hasLineBreak = false;
    var hasFoldableLine = false; // only checked if shouldTrackWidth
    var shouldTrackWidth = lineWidth !== -1;
    var previousLineBreak = -1; // count the first line correctly
    var plain = isPlainSafeFirst(string.charCodeAt(0))
        && !isWhitespace(string.charCodeAt(string.length - 1));
    if (singleLineOnly) {
        // Case: no block styles.
        // Check for disallowed characters to rule out plain and single.
        for (i = 0; i < string.length; i++) {
            char = string.charCodeAt(i);
            if (!isPrintable(char)) {
                return STYLE_DOUBLE;
            }
            plain = plain && isPlainSafe(char);
        }
    }
    else {
        // Case: block styles permitted.
        for (i = 0; i < string.length; i++) {
            char = string.charCodeAt(i);
            if (char === CHAR_LINE_FEED) {
                hasLineBreak = true;
                // Check if any line can be folded.
                if (shouldTrackWidth) {
                    hasFoldableLine = hasFoldableLine ||
                        // Foldable line = too long, and not more-indented.
                        (i - previousLineBreak - 1 > lineWidth &&
                            string[previousLineBreak + 1] !== ' ');
                    previousLineBreak = i;
                }
            }
            else if (!isPrintable(char)) {
                return STYLE_DOUBLE;
            }
            plain = plain && isPlainSafe(char);
        }
        // in case the end is missing a \n
        hasFoldableLine = hasFoldableLine || (shouldTrackWidth &&
            (i - previousLineBreak - 1 > lineWidth &&
                string[previousLineBreak + 1] !== ' '));
    }
    // Although every style can represent \n without escaping, prefer block styles
    // for multiline, since they're more readable and they don't add empty lines.
    // Also prefer folding a super-long line.
    if (!hasLineBreak && !hasFoldableLine) {
        // Strings interpretable as another type have to be quoted;
        // e.g. the string 'true' vs. the boolean true.
        return plain && !testAmbiguousType(string)
            ? STYLE_PLAIN : STYLE_SINGLE;
    }
    // Edge case: block indentation indicator can only have one digit.
    if (string[0] === ' ' && indentPerLevel > 9) {
        return STYLE_DOUBLE;
    }
    // At this point we know block styles are valid.
    // Prefer literal style unless we want to fold.
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
}
// Note: line breaking/folding is implemented for only the folded style.
// NB. We drop the last trailing newline (if any) of a returned block scalar
//  since the dumper adds its own newline. This always works:
//    • No ending newline => unaffected; already using strip "-" chomping.
//    • Ending newline    => removed then restored.
//  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
function writeScalar(state, string, level, iskey) {
    state.dump = (function () {
        if (string.length === 0) {
            return "''";
        }
        if (!state.noCompatMode &&
            DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1) {
            return "'" + string + "'";
        }
        var indent = state.indent * Math.max(1, level); // no 0-indent scalars
        // As indentation gets deeper, let the width decrease monotonically
        // to the lower bound min(state.lineWidth, 40).
        // Note that this implies
        //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
        //  state.lineWidth > 40 + state.indent: width decreases until the lower bound.
        // This behaves better than a constant minimum width which disallows narrower options,
        // or an indent threshold which causes the width to suddenly increase.
        var lineWidth = state.lineWidth === -1
            ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
        // Without knowing if keys are implicit/explicit, assume implicit for safety.
        var singleLineOnly = iskey
            || (state.flowLevel > -1 && level >= state.flowLevel);
        function testAmbiguity(string) {
            return testImplicitResolving(state, string);
        }
        switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity)) {
            case STYLE_PLAIN:
                return string;
            case STYLE_SINGLE:
                return "'" + string.replace(/'/g, "''") + "'";
            case STYLE_LITERAL:
                return '|' + blockHeader(string, state.indent)
                    + dropEndingNewline(indentString(string, indent));
            case STYLE_FOLDED:
                return '>' + blockHeader(string, state.indent)
                    + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
            case STYLE_DOUBLE:
                return '"' + escapeString(string, lineWidth) + '"';
            default:
                throw new YAMLException$5('impossible error: invalid scalar style');
        }
    }());
}
// Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
function blockHeader(string, indentPerLevel) {
    var indentIndicator = (string[0] === ' ') ? String(indentPerLevel) : '';
    // note the special case: the string '\n' counts as a "trailing" empty line.
    var clip = string[string.length - 1] === '\n';
    var keep = clip && (string[string.length - 2] === '\n' || string === '\n');
    var chomp = keep ? '+' : (clip ? '' : '-');
    return indentIndicator + chomp + '\n';
}
// (See the note for writeScalar.)
function dropEndingNewline(string) {
    return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
}
// Note: a long line without a suitable break point will exceed the width limit.
// Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
function foldString(string, width) {
    // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
    // unless they're before or after a more-indented line, or at the very
    // beginning or end, in which case $k$ maps to $k$.
    // Therefore, parse each chunk as newline(s) followed by a content line.
    var lineRe = /(\n+)([^\n]*)/g;
    // first line (possibly an empty line)
    var result = (function () {
        var nextLF = string.indexOf('\n');
        nextLF = nextLF !== -1 ? nextLF : string.length;
        lineRe.lastIndex = nextLF;
        return foldLine(string.slice(0, nextLF), width);
    }());
    // If we haven't reached the first content line yet, don't add an extra \n.
    var prevMoreIndented = string[0] === '\n' || string[0] === ' ';
    var moreIndented;
    // rest of the lines
    var match;
    while ((match = lineRe.exec(string))) {
        var prefix = match[1], line = match[2];
        moreIndented = (line[0] === ' ');
        result += prefix
            + (!prevMoreIndented && !moreIndented && line !== ''
                ? '\n' : '')
            + foldLine(line, width);
        prevMoreIndented = moreIndented;
    }
    return result;
}
// Greedy line breaking.
// Picks the longest line under the limit each time,
// otherwise settles for the shortest line over the limit.
// NB. More-indented lines *cannot* be folded, as that would add an extra \n.
function foldLine(line, width) {
    if (line === '' || line[0] === ' ')
        return line;
    // Since a more-indented line adds a \n, breaks can't be followed by a space.
    var breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
    var match;
    // start is an inclusive index. end, curr, and next are exclusive.
    var start = 0, end, curr = 0, next = 0;
    var result = '';
    // Invariants: 0 <= start <= length-1.
    //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
    // Inside the loop:
    //   A match implies length >= 2, so curr and next are <= length-2.
    while ((match = breakRe.exec(line))) {
        next = match.index;
        // maintain invariant: curr - start <= width
        if (next - start > width) {
            end = (curr > start) ? curr : next; // derive end <= length-2
            result += '\n' + line.slice(start, end);
            // skip the space that was output as \n
            start = end + 1; // derive start <= length-1
        }
        curr = next;
    }
    // By the invariants, start <= length-1, so there is something left over.
    // It is either the whole string or a part starting from non-whitespace.
    result += '\n';
    // Insert a break if the remainder is too long and there is a break available.
    if (line.length - start > width && curr > start) {
        result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
    }
    else {
        result += line.slice(start);
    }
    return result.slice(1); // drop extra \n joiner
}
// Escapes a double-quoted string.
function escapeString(string) {
    var result = '';
    var char;
    var escapeSeq;
    for (var i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        escapeSeq = ESCAPE_SEQUENCES[char];
        result += !escapeSeq && isPrintable(char)
            ? string[i]
            : escapeSeq || encodeHex(char);
    }
    return result;
}
function writeFlowSequence(state, level, object) {
    var _result = '', _tag = state.tag, index, length;
    for (index = 0, length = object.length; index < length; index += 1) {
        // Write only valid elements.
        if (writeNode(state, level, object[index], false, false)) {
            if (index !== 0)
                _result += ', ';
            _result += state.dump;
        }
    }
    state.tag = _tag;
    state.dump = '[' + _result + ']';
}
function writeBlockSequence(state, level, object, compact) {
    var _result = '', _tag = state.tag, index, length;
    for (index = 0, length = object.length; index < length; index += 1) {
        // Write only valid elements.
        if (writeNode(state, level + 1, object[index], true, true)) {
            if (!compact || index !== 0) {
                _result += generateNextLine(state, level);
            }
            if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
                _result += '-';
            }
            else {
                _result += '- ';
            }
            _result += state.dump;
        }
    }
    state.tag = _tag;
    state.dump = _result || '[]'; // Empty sequence if no valid values.
}
function writeFlowMapping(state, level, object) {
    var _result = '', _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
    for (index = 0, length = objectKeyList.length; index < length; index += 1) {
        pairBuffer = '';
        if (index !== 0)
            pairBuffer += ', ';
        objectKey = objectKeyList[index];
        objectValue = object[objectKey];
        if (!writeNode(state, level, objectKey, false, false)) {
            continue; // Skip this pair because of invalid key;
        }
        if (state.dump.length > 1024)
            pairBuffer += '? ';
        pairBuffer += state.dump + ': ';
        if (!writeNode(state, level, objectValue, false, false)) {
            continue; // Skip this pair because of invalid value.
        }
        pairBuffer += state.dump;
        // Both key and value are valid.
        _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = '{' + _result + '}';
}
function writeBlockMapping(state, level, object, compact) {
    var _result = '', _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
    // Allow sorting keys so that the output file is deterministic
    if (state.sortKeys === true) {
        // Default sorting
        objectKeyList.sort();
    }
    else if (typeof state.sortKeys === 'function') {
        // Custom sort function
        objectKeyList.sort(state.sortKeys);
    }
    else if (state.sortKeys) {
        // Something is wrong
        throw new YAMLException$5('sortKeys must be a boolean or a function');
    }
    for (index = 0, length = objectKeyList.length; index < length; index += 1) {
        pairBuffer = '';
        if (!compact || index !== 0) {
            pairBuffer += generateNextLine(state, level);
        }
        objectKey = objectKeyList[index];
        objectValue = object[objectKey];
        if (!writeNode(state, level + 1, objectKey, true, true, true)) {
            continue; // Skip this pair because of invalid key.
        }
        explicitPair = (state.tag !== null && state.tag !== '?') ||
            (state.dump && state.dump.length > 1024);
        if (explicitPair) {
            if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
                pairBuffer += '?';
            }
            else {
                pairBuffer += '? ';
            }
        }
        pairBuffer += state.dump;
        if (explicitPair) {
            pairBuffer += generateNextLine(state, level);
        }
        if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
            continue; // Skip this pair because of invalid value.
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            pairBuffer += ':';
        }
        else {
            pairBuffer += ': ';
        }
        pairBuffer += state.dump;
        // Both key and value are valid.
        _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || '{}'; // Empty mapping if no valid pairs.
}
function detectType(state, object, explicit) {
    var _result, typeList, index, length, type, style;
    typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (index = 0, length = typeList.length; index < length; index += 1) {
        type = typeList[index];
        if ((type.instanceOf || type.predicate) &&
            (!type.instanceOf || ((typeof object === 'object') && (object instanceof type.instanceOf))) &&
            (!type.predicate || type.predicate(object))) {
            state.tag = explicit ? type.tag : '?';
            if (type.represent) {
                style = state.styleMap[type.tag] || type.defaultStyle;
                if (_toString$2.call(type.represent) === '[object Function]') {
                    _result = type.represent(object, style);
                }
                else if (_hasOwnProperty$3.call(type.represent, style)) {
                    _result = type.represent[style](object, style);
                }
                else {
                    throw new YAMLException$5('!<' + type.tag + '> tag resolver accepts not "' + style + '" style');
                }
                state.dump = _result;
            }
            return true;
        }
    }
    return false;
}
// Serializes `object` and writes it to global `result`.
// Returns true on success, or false on invalid object.
//
function writeNode(state, level, object, block, compact, iskey) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
        detectType(state, object, true);
    }
    var type = _toString$2.call(state.dump);
    if (block) {
        block = (state.flowLevel < 0 || state.flowLevel > level);
    }
    var objectOrArray = type === '[object Object]' || type === '[object Array]', duplicateIndex, duplicate;
    if (objectOrArray) {
        duplicateIndex = state.duplicates.indexOf(object);
        duplicate = duplicateIndex !== -1;
    }
    if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0)) {
        compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
        state.dump = '*ref_' + duplicateIndex;
    }
    else {
        if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
            state.usedDuplicates[duplicateIndex] = true;
        }
        if (type === '[object Object]') {
            if (block && (Object.keys(state.dump).length !== 0)) {
                writeBlockMapping(state, level, state.dump, compact);
                if (duplicate) {
                    state.dump = '&ref_' + duplicateIndex + state.dump;
                }
            }
            else {
                writeFlowMapping(state, level, state.dump);
                if (duplicate) {
                    state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
                }
            }
        }
        else if (type === '[object Array]') {
            if (block && (state.dump.length !== 0)) {
                writeBlockSequence(state, level, state.dump, compact);
                if (duplicate) {
                    state.dump = '&ref_' + duplicateIndex + state.dump;
                }
            }
            else {
                writeFlowSequence(state, level, state.dump);
                if (duplicate) {
                    state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
                }
            }
        }
        else if (type === '[object String]') {
            if (state.tag !== '?') {
                writeScalar(state, state.dump, level, iskey);
            }
        }
        else {
            if (state.skipInvalid)
                return false;
            throw new YAMLException$5('unacceptable kind of an object to dump ' + type);
        }
        if (state.tag !== null && state.tag !== '?') {
            state.dump = '!<' + state.tag + '> ' + state.dump;
        }
    }
    return true;
}
function getDuplicateReferences(object, state) {
    var objects = [], duplicatesIndexes = [], index, length;
    inspectNode(object, objects, duplicatesIndexes);
    for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
        state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
    var objectKeyList, index, length;
    if (object !== null && typeof object === 'object') {
        index = objects.indexOf(object);
        if (index !== -1) {
            if (duplicatesIndexes.indexOf(index) === -1) {
                duplicatesIndexes.push(index);
            }
        }
        else {
            objects.push(object);
            if (Array.isArray(object)) {
                for (index = 0, length = object.length; index < length; index += 1) {
                    inspectNode(object[index], objects, duplicatesIndexes);
                }
            }
            else {
                objectKeyList = Object.keys(object);
                for (index = 0, length = objectKeyList.length; index < length; index += 1) {
                    inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
                }
            }
        }
    }
}
function dump$1(input, options) {
    options = options || {};
    var state = new State$1(options);
    if (!state.noRefs)
        getDuplicateReferences(input, state);
    if (writeNode(state, 0, input, true, true))
        return state.dump + '\n';
    return '';
}
function safeDump$1(input, options) {
    return dump$1(input, common$7.extend({ schema: DEFAULT_SAFE_SCHEMA$2 }, options));
}
var dump_1 = dump$1;
var safeDump_1 = safeDump$1;
var dumper$1 = {
    dump: dump_1,
    safeDump: safeDump_1
};
var loader = loader$1;
var dumper = dumper$1;
function deprecated$3(name) {
    return function () {
        throw new Error('Function ' + name + ' is deprecated and cannot be used.');
    };
}
var Type = type;
var Schema = schema;
var FAILSAFE_SCHEMA = failsafe;
var JSON_SCHEMA = json;
var CORE_SCHEMA = core;
var DEFAULT_SAFE_SCHEMA = default_safe;
var DEFAULT_FULL_SCHEMA = default_full;
var load = loader.load;
var loadAll = loader.loadAll;
var safeLoad = loader.safeLoad;
var safeLoadAll = loader.safeLoadAll;
var dump = dumper.dump;
var safeDump = dumper.safeDump;
var YAMLException = exception;
// Deprecated schema names from JS-YAML 2.0.x
var MINIMAL_SCHEMA = failsafe;
var SAFE_SCHEMA = default_safe;
var DEFAULT_SCHEMA = default_full;
// Deprecated functions from JS-YAML 1.x.x
var scan = deprecated$3('scan');
var parse$1 = deprecated$3('parse');
var compose = deprecated$3('compose');
var addConstructor = deprecated$3('addConstructor');
var jsYaml = {
    Type: Type,
    Schema: Schema,
    FAILSAFE_SCHEMA: FAILSAFE_SCHEMA,
    JSON_SCHEMA: JSON_SCHEMA,
    CORE_SCHEMA: CORE_SCHEMA,
    DEFAULT_SAFE_SCHEMA: DEFAULT_SAFE_SCHEMA,
    DEFAULT_FULL_SCHEMA: DEFAULT_FULL_SCHEMA,
    load: load,
    loadAll: loadAll,
    safeLoad: safeLoad,
    safeLoadAll: safeLoadAll,
    dump: dump,
    safeDump: safeDump,
    YAMLException: YAMLException,
    MINIMAL_SCHEMA: MINIMAL_SCHEMA,
    SAFE_SCHEMA: SAFE_SCHEMA,
    DEFAULT_SCHEMA: DEFAULT_SCHEMA,
    scan: scan,
    parse: parse$1,
    compose: compose,
    addConstructor: addConstructor
};
var yaml$1 = jsYaml;
var index$64 = yaml$1;
var index$66 = createCommonjsModule(function (module) {
    'use strict';
    var Module = module$1;
    var path = require$$0$1;
    module.exports = function requireFromString(code, filename, opts) {
        if (typeof filename === 'object') {
            opts = filename;
            filename = undefined;
        }
        opts = opts || {};
        filename = filename || '';
        opts.appendPaths = opts.appendPaths || [];
        opts.prependPaths = opts.prependPaths || [];
        if (typeof code !== 'string') {
            throw new Error('code must be a string, not ' + typeof code);
        }
        var paths = Module._nodeModulePaths(path.dirname(filename));
        var m = new Module(filename, module.parent);
        m.filename = filename;
        m.paths = [].concat(opts.prependPaths).concat(paths).concat(opts.appendPaths);
        m._compile(code, filename);
        return m.exports;
    };
});
var yaml = index$64;
var requireFromString = index$66;
var readFile$3 = readFile$1;
var parseJson$2 = parseJson_1;
var loadRc$1 = function (filepath, options) {
    return loadExtensionlessRc().then(function (result) {
        if (result)
            return result;
        if (options.rcExtensions)
            return loadRcWithExtensions();
        return null;
    });
    function loadExtensionlessRc() {
        return readRcFile().then(function (content) {
            if (!content)
                return null;
            var pasedConfig = (options.rcStrictJson)
                ? parseJson$2(content, filepath)
                : yaml.safeLoad(content, {
                    filename: filepath,
                });
            return {
                config: pasedConfig,
                filepath: filepath,
            };
        });
    }
    function loadRcWithExtensions() {
        return readRcFile('json').then(function (content) {
            if (content) {
                var successFilepath = filepath + '.json';
                return {
                    config: parseJson$2(content, successFilepath),
                    filepath: successFilepath,
                };
            }
            // If not content was found in the file with extension,
            // try the next possible extension
            return readRcFile('yaml');
        }).then(function (content) {
            if (content) {
                // If the previous check returned an object with a config
                // property, then it succeeded and this step can be skipped
                if (content.config)
                    return content;
                // If it just returned a string, then *this* check succeeded
                var successFilepath = filepath + '.yaml';
                return {
                    config: yaml.safeLoad(content, { filename: successFilepath }),
                    filepath: successFilepath,
                };
            }
            return readRcFile('yml');
        }).then(function (content) {
            if (content) {
                if (content.config)
                    return content;
                var successFilepath = filepath + '.yml';
                return {
                    config: yaml.safeLoad(content, { filename: successFilepath }),
                    filepath: successFilepath,
                };
            }
            return readRcFile('js');
        }).then(function (content) {
            if (content) {
                if (content.config)
                    return content;
                var successFilepath = filepath + '.js';
                return {
                    config: requireFromString(content, successFilepath),
                    filepath: successFilepath,
                };
            }
            return null;
        });
    }
    function readRcFile(extension) {
        var filepathWithExtension = (extension)
            ? filepath + '.' + extension
            : filepath;
        return readFile$3(filepathWithExtension);
    }
};
var requireFromString$1 = index$66;
var readFile$4 = readFile$1;
var loadJs$1 = function (filepath) {
    return readFile$4(filepath).then(function (content) {
        if (!content)
            return null;
        return {
            config: requireFromString$1(content, filepath),
            filepath: filepath,
        };
    });
};
var yaml$2 = index$64;
var requireFromString$2 = index$66;
var readFile$5 = readFile$1;
var parseJson$3 = parseJson_1;
var loadDefinedFile$1 = function (filepath, options) {
    return readFile$5(filepath, { throwNotFound: true }).then(function (content) {
        var parsedConfig = (function () {
            switch (options.format) {
                case 'json':
                    return parseJson$3(content, filepath);
                case 'yaml':
                    return yaml$2.safeLoad(content, {
                        filename: filepath,
                    });
                case 'js':
                    return requireFromString$2(content, filepath);
                default:
                    return tryAllParsing(content, filepath);
            }
        })();
        if (!parsedConfig) {
            throw new Error('Failed to parse "' + filepath + '" as JSON, JS, or YAML.');
        }
        return {
            config: parsedConfig,
            filepath: filepath,
        };
    });
};
function tryAllParsing(content, filepath) {
    return tryYaml(content, filepath, function () {
        return tryRequire(content, filepath, function () {
            return null;
        });
    });
}
function tryYaml(content, filepath, cb) {
    try {
        var result = yaml$2.safeLoad(content, {
            filename: filepath,
        });
        if (typeof result === 'string') {
            return cb();
        }
        return result;
    }
    catch (e) {
        return cb();
    }
}
function tryRequire(content, filepath, cb) {
    try {
        return requireFromString$2(content, filepath);
    }
    catch (e) {
        return cb();
    }
}
var path$3 = require$$0$1;
var isDir = index$56;
var loadPackageProp = loadPackageProp$1;
var loadRc = loadRc$1;
var loadJs = loadJs$1;
var loadDefinedFile = loadDefinedFile$1;
var createExplorer$1 = function (options) {
    // These cache Promises that resolve with results, not the results themselves
    var fileCache = (options.cache) ? new Map() : null;
    var directoryCache = (options.cache) ? new Map() : null;
    var transform = options.transform || identityPromise;
    function clearFileCache() {
        if (fileCache)
            fileCache.clear();
    }
    function clearDirectoryCache() {
        if (directoryCache)
            directoryCache.clear();
    }
    function clearCaches() {
        clearFileCache();
        clearDirectoryCache();
    }
    function load(searchPath, configPath) {
        if (configPath) {
            var absoluteConfigPath = path$3.resolve(process.cwd(), configPath);
            if (fileCache && fileCache.has(absoluteConfigPath)) {
                return fileCache.get(absoluteConfigPath);
            }
            var result = loadDefinedFile(absoluteConfigPath, options)
                .then(transform);
            if (fileCache)
                fileCache.set(absoluteConfigPath, result);
            return result;
        }
        if (!searchPath)
            return Promise.resolve(null);
        var absoluteSearchPath = path$3.resolve(process.cwd(), searchPath);
        return isDirectory(absoluteSearchPath)
            .then(function (searchPathIsDirectory) {
            var directory = (searchPathIsDirectory)
                ? absoluteSearchPath
                : path$3.dirname(absoluteSearchPath);
            return searchDirectory(directory);
        });
    }
    function searchDirectory(directory) {
        if (directoryCache && directoryCache.has(directory)) {
            return directoryCache.get(directory);
        }
        var result = Promise.resolve()
            .then(function () {
            if (!options.packageProp)
                return;
            return loadPackageProp(directory, options);
        })
            .then(function (result) {
            if (result || !options.rc)
                return result;
            return loadRc(path$3.join(directory, options.rc), options);
        })
            .then(function (result) {
            if (result || !options.js)
                return result;
            return loadJs(path$3.join(directory, options.js));
        })
            .then(function (result) {
            if (result)
                return result;
            var splitPath = directory.split(path$3.sep);
            var nextDirectory = (splitPath.length > 1)
                ? splitPath.slice(0, -1).join(path$3.sep)
                : null;
            if (!nextDirectory || directory === options.stopDir)
                return null;
            return searchDirectory(nextDirectory);
        })
            .then(transform);
        if (directoryCache)
            directoryCache.set(directory, result);
        return result;
    }
    return {
        load: load,
        clearFileCache: clearFileCache,
        clearDirectoryCache: clearDirectoryCache,
        clearCaches: clearCaches,
    };
};
function isDirectory(filepath) {
    return new Promise(function (resolve, reject) {
        return isDir(filepath, function (err, dir) {
            if (err)
                return reject(err);
            return resolve(dir);
        });
    });
}
function identityPromise(x) {
    return Promise.resolve(x);
}
var path$2 = require$$0$1;
var oshomedir = index$50;
var minimist = index$52;
var assign = index$54;
var createExplorer = createExplorer$1;
var parsedCliArgs = minimist(process.argv);
var index$48 = function (moduleName, options) {
    options = assign({
        packageProp: moduleName,
        rc: '.' + moduleName + 'rc',
        js: moduleName + '.config.js',
        argv: 'config',
        rcStrictJson: false,
        stopDir: oshomedir(),
        cache: true,
    }, options);
    if (options.argv && parsedCliArgs[options.argv]) {
        options.configPath = path$2.resolve(parsedCliArgs[options.argv]);
    }
    return createExplorer(options);
};
var index$70 = function (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        var x = fn(xs[i], i);
        if (isArray(x))
            res.push.apply(res, x);
        else
            res.push(x);
    }
    return res;
};
var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};
var index$72 = balanced$1;
function balanced$1(a, b, str) {
    if (a instanceof RegExp)
        a = maybeMatch(a, str);
    if (b instanceof RegExp)
        b = maybeMatch(b, str);
    var r = range(a, b, str);
    return r && {
        start: r[0],
        end: r[1],
        pre: str.slice(0, r[0]),
        body: str.slice(r[0] + a.length, r[1]),
        post: str.slice(r[1] + b.length)
    };
}
function maybeMatch(reg, str) {
    var m = str.match(reg);
    return m ? m[0] : null;
}
balanced$1.range = range;
function range(a, b, str) {
    var begs, beg, left, right, result;
    var ai = str.indexOf(a);
    var bi = str.indexOf(b, ai + 1);
    var i = ai;
    if (ai >= 0 && bi > 0) {
        begs = [];
        left = str.length;
        while (i >= 0 && !result) {
            if (i == ai) {
                begs.push(i);
                ai = str.indexOf(a, i + 1);
            }
            else if (begs.length == 1) {
                result = [begs.pop(), bi];
            }
            else {
                beg = begs.pop();
                if (beg < left) {
                    left = beg;
                    right = bi;
                }
                bi = str.indexOf(b, i + 1);
            }
            i = ai < bi && ai >= 0 ? ai : bi;
        }
        if (begs.length) {
            result = [left, right];
        }
    }
    return result;
}
var concatMap = index$70;
var balanced = index$72;
var index$68 = expandTop;
var escSlash = '\0SLASH' + Math.random() + '\0';
var escOpen = '\0OPEN' + Math.random() + '\0';
var escClose = '\0CLOSE' + Math.random() + '\0';
var escComma = '\0COMMA' + Math.random() + '\0';
var escPeriod = '\0PERIOD' + Math.random() + '\0';
function numeric(str) {
    return parseInt(str, 10) == str
        ? parseInt(str, 10)
        : str.charCodeAt(0);
}
function escapeBraces(str) {
    return str.split('\\\\').join(escSlash)
        .split('\\{').join(escOpen)
        .split('\\}').join(escClose)
        .split('\\,').join(escComma)
        .split('\\.').join(escPeriod);
}
function unescapeBraces(str) {
    return str.split(escSlash).join('\\')
        .split(escOpen).join('{')
        .split(escClose).join('}')
        .split(escComma).join(',')
        .split(escPeriod).join('.');
}
// Basically just str.split(","), but handling cases
// where we have nested braced sections, which should be
// treated as individual members, like {a,{b,c},d}
function parseCommaParts(str) {
    if (!str)
        return [''];
    var parts = [];
    var m = balanced('{', '}', str);
    if (!m)
        return str.split(',');
    var pre = m.pre;
    var body = m.body;
    var post = m.post;
    var p = pre.split(',');
    p[p.length - 1] += '{' + body + '}';
    var postParts = parseCommaParts(post);
    if (post.length) {
        p[p.length - 1] += postParts.shift();
        p.push.apply(p, postParts);
    }
    parts.push.apply(parts, p);
    return parts;
}
function expandTop(str) {
    if (!str)
        return [];
    // I don't know why Bash 4.3 does this, but it does.
    // Anything starting with {} will have the first two bytes preserved
    // but *only* at the top level, so {},a}b will not expand to anything,
    // but a{},b}c will be expanded to [a}c,abc].
    // One could argue that this is a bug in Bash, but since the goal of
    // this module is to match Bash's rules, we escape a leading {}
    if (str.substr(0, 2) === '{}') {
        str = '\\{\\}' + str.substr(2);
    }
    return expand$1(escapeBraces(str), true).map(unescapeBraces);
}
function embrace(str) {
    return '{' + str + '}';
}
function isPadded(el) {
    return /^-?0\d/.test(el);
}
function lte(i, y) {
    return i <= y;
}
function gte(i, y) {
    return i >= y;
}
function expand$1(str, isTop) {
    var expansions = [];
    var m = balanced('{', '}', str);
    if (!m || /\$$/.test(m.pre))
        return [str];
    var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
    var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
    var isSequence = isNumericSequence || isAlphaSequence;
    var isOptions = m.body.indexOf(',') >= 0;
    if (!isSequence && !isOptions) {
        // {a},b}
        if (m.post.match(/,.*\}/)) {
            str = m.pre + '{' + m.body + escClose + m.post;
            return expand$1(str);
        }
        return [str];
    }
    var n;
    if (isSequence) {
        n = m.body.split(/\.\./);
    }
    else {
        n = parseCommaParts(m.body);
        if (n.length === 1) {
            // x{{a,b}}y ==> x{a}y x{b}y
            n = expand$1(n[0], false).map(embrace);
            if (n.length === 1) {
                var post = m.post.length
                    ? expand$1(m.post, false)
                    : [''];
                return post.map(function (p) {
                    return m.pre + n[0] + p;
                });
            }
        }
    }
    // at this point, n is the parts, and we know it's not a comma set
    // with a single entry.
    // no need to expand pre, since it is guaranteed to be free of brace-sets
    var pre = m.pre;
    var post = m.post.length
        ? expand$1(m.post, false)
        : [''];
    var N;
    if (isSequence) {
        var x = numeric(n[0]);
        var y = numeric(n[1]);
        var width = Math.max(n[0].length, n[1].length);
        var incr = n.length == 3
            ? Math.abs(numeric(n[2]))
            : 1;
        var test = lte;
        var reverse = y < x;
        if (reverse) {
            incr *= -1;
            test = gte;
        }
        var pad = n.some(isPadded);
        N = [];
        for (var i = x; test(i, y); i += incr) {
            var c;
            if (isAlphaSequence) {
                c = String.fromCharCode(i);
                if (c === '\\')
                    c = '';
            }
            else {
                c = String(i);
                if (pad) {
                    var need = width - c.length;
                    if (need > 0) {
                        var z = new Array(need + 1).join('0');
                        if (i < 0)
                            c = '-' + z + c.slice(1);
                        else
                            c = z + c;
                    }
                }
            }
            N.push(c);
        }
    }
    else {
        N = concatMap(n, function (el) { return expand$1(el, false); });
    }
    for (var j = 0; j < N.length; j++) {
        for (var k = 0; k < post.length; k++) {
            var expansion = pre + N[j] + post[k];
            if (!isTop || isSequence || expansion)
                expansions.push(expansion);
        }
    }
    return expansions;
}
var minimatch_1 = minimatch$1;
minimatch$1.Minimatch = Minimatch;
var path$5 = { sep: '/' };
try {
    path$5 = require$$0$1;
}
catch (er) { }
var GLOBSTAR = minimatch$1.GLOBSTAR = Minimatch.GLOBSTAR = {};
var expand = index$68;
var plTypes = {
    '!': { open: '(?:(?!(?:', close: '))[^/]*?)' },
    '?': { open: '(?:', close: ')?' },
    '+': { open: '(?:', close: ')+' },
    '*': { open: '(?:', close: ')*' },
    '@': { open: '(?:', close: ')' }
};
// any single thing other than /
// don't need to escape / when using new RegExp()
var qmark = '[^/]';
// * => any number of characters
var star = qmark + '*?';
// ** when dots are allowed.  Anything goes, except .. and .
// not (^ or / followed by one or two dots followed by $ or /),
// followed by anything, any number of times.
var twoStarDot = '(?:(?!(?:\\\/|^)(?:\\.{1,2})($|\\\/)).)*?';
// not a ^ or / followed by a dot,
// followed by anything, any number of times.
var twoStarNoDot = '(?:(?!(?:\\\/|^)\\.).)*?';
// characters that need to be escaped in RegExp.
var reSpecials = charSet('().*{}+?[]^$\\!');
// "abc" -> { a:true, b:true, c:true }
function charSet(s) {
    return s.split('').reduce(function (set, c) {
        set[c] = true;
        return set;
    }, {});
}
// normalizes slashes.
var slashSplit = /\/+/;
minimatch$1.filter = filter;
function filter(pattern, options) {
    options = options || {};
    return function (p, i, list) {
        return minimatch$1(p, pattern, options);
    };
}
function ext(a, b) {
    a = a || {};
    b = b || {};
    var t = {};
    Object.keys(b).forEach(function (k) {
        t[k] = b[k];
    });
    Object.keys(a).forEach(function (k) {
        t[k] = a[k];
    });
    return t;
}
minimatch$1.defaults = function (def) {
    if (!def || !Object.keys(def).length)
        return minimatch$1;
    var orig = minimatch$1;
    var m = function minimatch(p, pattern, options) {
        return orig.minimatch(p, pattern, ext(def, options));
    };
    m.Minimatch = function Minimatch(pattern, options) {
        return new orig.Minimatch(pattern, ext(def, options));
    };
    return m;
};
Minimatch.defaults = function (def) {
    if (!def || !Object.keys(def).length)
        return Minimatch;
    return minimatch$1.defaults(def).Minimatch;
};
function minimatch$1(p, pattern, options) {
    if (typeof pattern !== 'string') {
        throw new TypeError('glob pattern string required');
    }
    if (!options)
        options = {};
    // shortcut: comments match nothing.
    if (!options.nocomment && pattern.charAt(0) === '#') {
        return false;
    }
    // "" only matches ""
    if (pattern.trim() === '')
        return p === '';
    return new Minimatch(pattern, options).match(p);
}
function Minimatch(pattern, options) {
    if (!(this instanceof Minimatch)) {
        return new Minimatch(pattern, options);
    }
    if (typeof pattern !== 'string') {
        throw new TypeError('glob pattern string required');
    }
    if (!options)
        options = {};
    pattern = pattern.trim();
    // windows support: need to use /, not \
    if (path$5.sep !== '/') {
        pattern = pattern.split(path$5.sep).join('/');
    }
    this.options = options;
    this.set = [];
    this.pattern = pattern;
    this.regexp = null;
    this.negate = false;
    this.comment = false;
    this.empty = false;
    // make the set of regexps etc.
    this.make();
}
Minimatch.prototype.debug = function () { };
Minimatch.prototype.make = make;
function make() {
    // don't do it more than once.
    if (this._made)
        return;
    var pattern = this.pattern;
    var options = this.options;
    // empty patterns and comments match nothing.
    if (!options.nocomment && pattern.charAt(0) === '#') {
        this.comment = true;
        return;
    }
    if (!pattern) {
        this.empty = true;
        return;
    }
    // step 1: figure out negation, etc.
    this.parseNegate();
    // step 2: expand braces
    var set = this.globSet = this.braceExpand();
    if (options.debug)
        this.debug = console.error;
    this.debug(this.pattern, set);
    // step 3: now we have a set, so turn each one into a series of path-portion
    // matching patterns.
    // These will be regexps, except in the case of "**", which is
    // set to the GLOBSTAR object for globstar behavior,
    // and will not contain any / characters
    set = this.globParts = set.map(function (s) {
        return s.split(slashSplit);
    });
    this.debug(this.pattern, set);
    // glob --> regexps
    set = set.map(function (s, si, set) {
        return s.map(this.parse, this);
    }, this);
    this.debug(this.pattern, set);
    // filter out everything that didn't compile properly.
    set = set.filter(function (s) {
        return s.indexOf(false) === -1;
    });
    this.debug(this.pattern, set);
    this.set = set;
}
Minimatch.prototype.parseNegate = parseNegate;
function parseNegate() {
    var pattern = this.pattern;
    var negate = false;
    var options = this.options;
    var negateOffset = 0;
    if (options.nonegate)
        return;
    for (var i = 0, l = pattern.length; i < l && pattern.charAt(i) === '!'; i++) {
        negate = !negate;
        negateOffset++;
    }
    if (negateOffset)
        this.pattern = pattern.substr(negateOffset);
    this.negate = negate;
}
// Brace expansion:
// a{b,c}d -> abd acd
// a{b,}c -> abc ac
// a{0..3}d -> a0d a1d a2d a3d
// a{b,c{d,e}f}g -> abg acdfg acefg
// a{b,c}d{e,f}g -> abdeg acdeg abdeg abdfg
//
// Invalid sets are not expanded.
// a{2..}b -> a{2..}b
// a{b}c -> a{b}c
minimatch$1.braceExpand = function (pattern, options) {
    return braceExpand(pattern, options);
};
Minimatch.prototype.braceExpand = braceExpand;
function braceExpand(pattern, options) {
    if (!options) {
        if (this instanceof Minimatch) {
            options = this.options;
        }
        else {
            options = {};
        }
    }
    pattern = typeof pattern === 'undefined'
        ? this.pattern : pattern;
    if (typeof pattern === 'undefined') {
        throw new TypeError('undefined pattern');
    }
    if (options.nobrace ||
        !pattern.match(/\{.*\}/)) {
        // shortcut. no need to expand.
        return [pattern];
    }
    return expand(pattern);
}
// parse a component of the expanded set.
// At this point, no pattern may contain "/" in it
// so we're going to return a 2d array, where each entry is the full
// pattern, split on '/', and then turned into a regular expression.
// A regexp is made at the end which joins each array with an
// escaped /, and another full one which joins each regexp with |.
//
// Following the lead of Bash 4.1, note that "**" only has special meaning
// when it is the *only* thing in a path portion.  Otherwise, any series
// of * is equivalent to a single *.  Globstar behavior is enabled by
// default, and can be disabled by setting options.noglobstar.
Minimatch.prototype.parse = parse$2;
var SUBPARSE = {};
function parse$2(pattern, isSub) {
    if (pattern.length > 1024 * 64) {
        throw new TypeError('pattern is too long');
    }
    var options = this.options;
    // shortcuts
    if (!options.noglobstar && pattern === '**')
        return GLOBSTAR;
    if (pattern === '')
        return '';
    var re = '';
    var hasMagic = !!options.nocase;
    var escaping = false;
    // ? => one single character
    var patternListStack = [];
    var negativeLists = [];
    var stateChar;
    var inClass = false;
    var reClassStart = -1;
    var classStart = -1;
    // . and .. never match anything that doesn't start with .,
    // even when options.dot is set.
    var patternStart = pattern.charAt(0) === '.' ? '' // anything
        : options.dot ? '(?!(?:^|\\\/)\\.{1,2}(?:$|\\\/))'
            : '(?!\\.)';
    var self = this;
    function clearStateChar() {
        if (stateChar) {
            // we had some state-tracking character
            // that wasn't consumed by this pass.
            switch (stateChar) {
                case '*':
                    re += star;
                    hasMagic = true;
                    break;
                case '?':
                    re += qmark;
                    hasMagic = true;
                    break;
                default:
                    re += '\\' + stateChar;
                    break;
            }
            self.debug('clearStateChar %j %j', stateChar, re);
            stateChar = false;
        }
    }
    for (var i = 0, len = pattern.length, c; (i < len) && (c = pattern.charAt(i)); i++) {
        this.debug('%s\t%s %s %j', pattern, i, re, c);
        // skip over any that are escaped.
        if (escaping && reSpecials[c]) {
            re += '\\' + c;
            escaping = false;
            continue;
        }
        switch (c) {
            case '/':
                // completely not allowed, even escaped.
                // Should already be path-split by now.
                return false;
            case '\\':
                clearStateChar();
                escaping = true;
                continue;
            // the various stateChar values
            // for the "extglob" stuff.
            case '?':
            case '*':
            case '+':
            case '@':
            case '!':
                this.debug('%s\t%s %s %j <-- stateChar', pattern, i, re, c);
                // all of those are literals inside a class, except that
                // the glob [!a] means [^a] in regexp
                if (inClass) {
                    this.debug('  in class');
                    if (c === '!' && i === classStart + 1)
                        c = '^';
                    re += c;
                    continue;
                }
                // if we already have a stateChar, then it means
                // that there was something like ** or +? in there.
                // Handle the stateChar, then proceed with this one.
                self.debug('call clearStateChar %j', stateChar);
                clearStateChar();
                stateChar = c;
                // if extglob is disabled, then +(asdf|foo) isn't a thing.
                // just clear the statechar *now*, rather than even diving into
                // the patternList stuff.
                if (options.noext)
                    clearStateChar();
                continue;
            case '(':
                if (inClass) {
                    re += '(';
                    continue;
                }
                if (!stateChar) {
                    re += '\\(';
                    continue;
                }
                patternListStack.push({
                    type: stateChar,
                    start: i - 1,
                    reStart: re.length,
                    open: plTypes[stateChar].open,
                    close: plTypes[stateChar].close
                });
                // negation is (?:(?!js)[^/]*)
                re += stateChar === '!' ? '(?:(?!(?:' : '(?:';
                this.debug('plType %j %j', stateChar, re);
                stateChar = false;
                continue;
            case ')':
                if (inClass || !patternListStack.length) {
                    re += '\\)';
                    continue;
                }
                clearStateChar();
                hasMagic = true;
                var pl = patternListStack.pop();
                // negation is (?:(?!js)[^/]*)
                // The others are (?:<pattern>)<type>
                re += pl.close;
                if (pl.type === '!') {
                    negativeLists.push(pl);
                }
                pl.reEnd = re.length;
                continue;
            case '|':
                if (inClass || !patternListStack.length || escaping) {
                    re += '\\|';
                    escaping = false;
                    continue;
                }
                clearStateChar();
                re += '|';
                continue;
            // these are mostly the same in regexp and glob
            case '[':
                // swallow any state-tracking char before the [
                clearStateChar();
                if (inClass) {
                    re += '\\' + c;
                    continue;
                }
                inClass = true;
                classStart = i;
                reClassStart = re.length;
                re += c;
                continue;
            case ']':
                //  a right bracket shall lose its special
                //  meaning and represent itself in
                //  a bracket expression if it occurs
                //  first in the list.  -- POSIX.2 2.8.3.2
                if (i === classStart + 1 || !inClass) {
                    re += '\\' + c;
                    escaping = false;
                    continue;
                }
                // handle the case where we left a class open.
                // "[z-a]" is valid, equivalent to "\[z-a\]"
                if (inClass) {
                    // split where the last [ was, make sure we don't have
                    // an invalid re. if so, re-walk the contents of the
                    // would-be class to re-translate any characters that
                    // were passed through as-is
                    // TODO: It would probably be faster to determine this
                    // without a try/catch and a new RegExp, but it's tricky
                    // to do safely.  For now, this is safe and works.
                    var cs = pattern.substring(classStart + 1, i);
                    try {
                        RegExp('[' + cs + ']');
                    }
                    catch (er) {
                        // not a valid class!
                        var sp = this.parse(cs, SUBPARSE);
                        re = re.substr(0, reClassStart) + '\\[' + sp[0] + '\\]';
                        hasMagic = hasMagic || sp[1];
                        inClass = false;
                        continue;
                    }
                }
                // finish up the class.
                hasMagic = true;
                inClass = false;
                re += c;
                continue;
            default:
                // swallow any state char that wasn't consumed
                clearStateChar();
                if (escaping) {
                    // no need
                    escaping = false;
                }
                else if (reSpecials[c]
                    && !(c === '^' && inClass)) {
                    re += '\\';
                }
                re += c;
        } // switch
    } // for
    // handle the case where we left a class open.
    // "[abc" is valid, equivalent to "\[abc"
    if (inClass) {
        // split where the last [ was, and escape it
        // this is a huge pita.  We now have to re-walk
        // the contents of the would-be class to re-translate
        // any characters that were passed through as-is
        cs = pattern.substr(classStart + 1);
        sp = this.parse(cs, SUBPARSE);
        re = re.substr(0, reClassStart) + '\\[' + sp[0];
        hasMagic = hasMagic || sp[1];
    }
    // handle the case where we had a +( thing at the *end*
    // of the pattern.
    // each pattern list stack adds 3 chars, and we need to go through
    // and escape any | chars that were passed through as-is for the regexp.
    // Go through and escape them, taking care not to double-escape any
    // | chars that were already escaped.
    for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
        var tail = re.slice(pl.reStart + pl.open.length);
        this.debug('setting tail', re, pl);
        // maybe some even number of \, then maybe 1 \, followed by a |
        tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, function (_, $1, $2) {
            if (!$2) {
                // the | isn't already escaped, so escape it.
                $2 = '\\';
            }
            // need to escape all those slashes *again*, without escaping the
            // one that we need for escaping the | character.  As it works out,
            // escaping an even number of slashes can be done by simply repeating
            // it exactly after itself.  That's why this trick works.
            //
            // I am sorry that you have to see this.
            return $1 + $1 + $2 + '|';
        });
        this.debug('tail=%j\n   %s', tail, tail, pl, re);
        var t = pl.type === '*' ? star
            : pl.type === '?' ? qmark
                : '\\' + pl.type;
        hasMagic = true;
        re = re.slice(0, pl.reStart) + t + '\\(' + tail;
    }
    // handle trailing things that only matter at the very end.
    clearStateChar();
    if (escaping) {
        // trailing \\
        re += '\\\\';
    }
    // only need to apply the nodot start if the re starts with
    // something that could conceivably capture a dot
    var addPatternStart = false;
    switch (re.charAt(0)) {
        case '.':
        case '[':
        case '(': addPatternStart = true;
    }
    // Hack to work around lack of negative lookbehind in JS
    // A pattern like: *.!(x).!(y|z) needs to ensure that a name
    // like 'a.xyz.yz' doesn't match.  So, the first negative
    // lookahead, has to look ALL the way ahead, to the end of
    // the pattern.
    for (var n = negativeLists.length - 1; n > -1; n--) {
        var nl = negativeLists[n];
        var nlBefore = re.slice(0, nl.reStart);
        var nlFirst = re.slice(nl.reStart, nl.reEnd - 8);
        var nlLast = re.slice(nl.reEnd - 8, nl.reEnd);
        var nlAfter = re.slice(nl.reEnd);
        nlLast += nlAfter;
        // Handle nested stuff like *(*.js|!(*.json)), where open parens
        // mean that we should *not* include the ) in the bit that is considered
        // "after" the negated section.
        var openParensBefore = nlBefore.split('(').length - 1;
        var cleanAfter = nlAfter;
        for (i = 0; i < openParensBefore; i++) {
            cleanAfter = cleanAfter.replace(/\)[+*?]?/, '');
        }
        nlAfter = cleanAfter;
        var dollar = '';
        if (nlAfter === '' && isSub !== SUBPARSE) {
            dollar = '$';
        }
        var newRe = nlBefore + nlFirst + nlAfter + dollar + nlLast;
        re = newRe;
    }
    // if the re is not "" at this point, then we need to make sure
    // it doesn't match against an empty path part.
    // Otherwise a/* will match a/, which it should not.
    if (re !== '' && hasMagic) {
        re = '(?=.)' + re;
    }
    if (addPatternStart) {
        re = patternStart + re;
    }
    // parsing just a piece of a larger pattern.
    if (isSub === SUBPARSE) {
        return [re, hasMagic];
    }
    // skip the regexp for non-magical patterns
    // unescape anything in it, though, so that it'll be
    // an exact match against a file etc.
    if (!hasMagic) {
        return globUnescape(pattern);
    }
    var flags = options.nocase ? 'i' : '';
    try {
        var regExp = new RegExp('^' + re + '$', flags);
    }
    catch (er) {
        // If it was an invalid regular expression, then it can't match
        // anything.  This trick looks for a character after the end of
        // the string, which is of course impossible, except in multi-line
        // mode, but it's not a /m regex.
        return new RegExp('$.');
    }
    regExp._glob = pattern;
    regExp._src = re;
    return regExp;
}
minimatch$1.makeRe = function (pattern, options) {
    return new Minimatch(pattern, options || {}).makeRe();
};
Minimatch.prototype.makeRe = makeRe;
function makeRe() {
    if (this.regexp || this.regexp === false)
        return this.regexp;
    // at this point, this.set is a 2d array of partial
    // pattern strings, or "**".
    //
    // It's better to use .match().  This function shouldn't
    // be used, really, but it's pretty convenient sometimes,
    // when you just want to work with a regex.
    var set = this.set;
    if (!set.length) {
        this.regexp = false;
        return this.regexp;
    }
    var options = this.options;
    var twoStar = options.noglobstar ? star
        : options.dot ? twoStarDot
            : twoStarNoDot;
    var flags = options.nocase ? 'i' : '';
    var re = set.map(function (pattern) {
        return pattern.map(function (p) {
            return (p === GLOBSTAR) ? twoStar
                : (typeof p === 'string') ? regExpEscape(p)
                    : p._src;
        }).join('\\\/');
    }).join('|');
    // must match entire pattern
    // ending in a * or ** will make it less strict.
    re = '^(?:' + re + ')$';
    // can match anything, as long as it's not this.
    if (this.negate)
        re = '^(?!' + re + ').*$';
    try {
        this.regexp = new RegExp(re, flags);
    }
    catch (ex) {
        this.regexp = false;
    }
    return this.regexp;
}
minimatch$1.match = function (list, pattern, options) {
    options = options || {};
    var mm = new Minimatch(pattern, options);
    list = list.filter(function (f) {
        return mm.match(f);
    });
    if (mm.options.nonull && !list.length) {
        list.push(pattern);
    }
    return list;
};
Minimatch.prototype.match = match;
function match(f, partial) {
    this.debug('match', f, this.pattern);
    // short-circuit in the case of busted things.
    // comments, etc.
    if (this.comment)
        return false;
    if (this.empty)
        return f === '';
    if (f === '/' && partial)
        return true;
    var options = this.options;
    // windows: need to use /, not \
    if (path$5.sep !== '/') {
        f = f.split(path$5.sep).join('/');
    }
    // treat the test path as a set of pathparts.
    f = f.split(slashSplit);
    this.debug(this.pattern, 'split', f);
    // just ONE of the pattern sets in this.set needs to match
    // in order for it to be valid.  If negating, then just one
    // match means that we have failed.
    // Either way, return on the first hit.
    var set = this.set;
    this.debug(this.pattern, 'set', set);
    // Find the basename of the path by looking for the last non-empty segment
    var filename;
    var i;
    for (i = f.length - 1; i >= 0; i--) {
        filename = f[i];
        if (filename)
            break;
    }
    for (i = 0; i < set.length; i++) {
        var pattern = set[i];
        var file = f;
        if (options.matchBase && pattern.length === 1) {
            file = [filename];
        }
        var hit = this.matchOne(file, pattern, partial);
        if (hit) {
            if (options.flipNegate)
                return true;
            return !this.negate;
        }
    }
    // didn't get any hits.  this is success if it's a negative
    // pattern, failure otherwise.
    if (options.flipNegate)
        return false;
    return this.negate;
}
// set partial to true to test if, for example,
// "/a/b" matches the start of "/*/b/*/d"
// Partial means, if you run out of file before you run
// out of pattern, then that's fine, as long as all
// the parts match.
Minimatch.prototype.matchOne = function (file, pattern, partial) {
    var options = this.options;
    this.debug('matchOne', { 'this': this, file: file, pattern: pattern });
    this.debug('matchOne', file.length, pattern.length);
    for (var fi = 0, pi = 0, fl = file.length, pl = pattern.length; (fi < fl) && (pi < pl); fi++, pi++) {
        this.debug('matchOne loop');
        var p = pattern[pi];
        var f = file[fi];
        this.debug(pattern, p, f);
        // should be impossible.
        // some invalid regexp stuff in the set.
        if (p === false)
            return false;
        if (p === GLOBSTAR) {
            this.debug('GLOBSTAR', [pattern, p, f]);
            // "**"
            // a/**/b/**/c would match the following:
            // a/b/x/y/z/c
            // a/x/y/z/b/c
            // a/b/x/b/x/c
            // a/b/c
            // To do this, take the rest of the pattern after
            // the **, and see if it would match the file remainder.
            // If so, return success.
            // If not, the ** "swallows" a segment, and try again.
            // This is recursively awful.
            //
            // a/**/b/**/c matching a/b/x/y/z/c
            // - a matches a
            // - doublestar
            //   - matchOne(b/x/y/z/c, b/**/c)
            //     - b matches b
            //     - doublestar
            //       - matchOne(x/y/z/c, c) -> no
            //       - matchOne(y/z/c, c) -> no
            //       - matchOne(z/c, c) -> no
            //       - matchOne(c, c) yes, hit
            var fr = fi;
            var pr = pi + 1;
            if (pr === pl) {
                this.debug('** at the end');
                // a ** at the end will just swallow the rest.
                // We have found a match.
                // however, it will not swallow /.x, unless
                // options.dot is set.
                // . and .. are *never* matched by **, for explosively
                // exponential reasons.
                for (; fi < fl; fi++) {
                    if (file[fi] === '.' || file[fi] === '..' ||
                        (!options.dot && file[fi].charAt(0) === '.'))
                        return false;
                }
                return true;
            }
            // ok, let's see if we can swallow whatever we can.
            while (fr < fl) {
                var swallowee = file[fr];
                this.debug('\nglobstar while', file, fr, pattern, pr, swallowee);
                // XXX remove this slice.  Just pass the start index.
                if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
                    this.debug('globstar found match!', fr, fl, swallowee);
                    // found a match.
                    return true;
                }
                else {
                    // can't swallow "." or ".." ever.
                    // can only swallow ".foo" when explicitly asked.
                    if (swallowee === '.' || swallowee === '..' ||
                        (!options.dot && swallowee.charAt(0) === '.')) {
                        this.debug('dot detected!', file, fr, pattern, pr);
                        break;
                    }
                    // ** swallows a segment, and continue.
                    this.debug('globstar swallow a segment, and continue');
                    fr++;
                }
            }
            // no match was found.
            // However, in partial mode, we can't say this is necessarily over.
            // If there's more *pattern* left, then
            if (partial) {
                // ran out of file
                this.debug('\n>>> no match, partial?', file, fr, pattern, pr);
                if (fr === fl)
                    return true;
            }
            return false;
        }
        // something other than **
        // non-magic patterns just have to match exactly
        // patterns with magic have been turned into regexps.
        var hit;
        if (typeof p === 'string') {
            if (options.nocase) {
                hit = f.toLowerCase() === p.toLowerCase();
            }
            else {
                hit = f === p;
            }
            this.debug('string match', p, f, hit);
        }
        else {
            hit = f.match(p);
            this.debug('pattern match', p, f, hit);
        }
        if (!hit)
            return false;
    }
    // Note: ending in / means that we'll get a final ""
    // at the end of the pattern.  This can only match a
    // corresponding "" at the end of the file.
    // If the file ends in /, then it can only match a
    // a pattern that ends in /, unless the pattern just
    // doesn't have any more for it. But, a/b/ should *not*
    // match "a/b/*", even though "" matches against the
    // [^/]*? pattern, except in partial mode, where it might
    // simply not be reached yet.
    // However, a/b/ should still satisfy a/*
    // now either we fell off the end of the pattern, or we're done.
    if (fi === fl && pi === pl) {
        // ran out of pattern and filename at the same time.
        // an exact hit!
        return true;
    }
    else if (fi === fl) {
        // ran out of file, but still had pattern left.
        // this is ok if we're doing the match as part of
        // a glob fs traversal.
        return partial;
    }
    else if (pi === pl) {
        // ran out of pattern, still have file left.
        // this is only acceptable if we're on the very last
        // empty segment of a file with a trailing slash.
        // a/* should match a/b/
        var emptyFileEnd = (fi === fl - 1) && (file[fi] === '');
        return emptyFileEnd;
    }
    // should be unreachable.
    throw new Error('wtf?');
};
// replace stuff like \* with *
function globUnescape(s) {
    return s.replace(/\\(.)/g, '$1');
}
function regExpEscape(s) {
    return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
const cosmiconfig = index$48;
const minimatch = minimatch_1;
const path$1 = require$$0$1;
const withCache = cosmiconfig("prettier");
const noCache = cosmiconfig("prettier", { cache: false });
function resolveConfig(filePath, opts) {
    if (opts && opts.configFile === false) {
        // do not look for a config file
        return Promise.resolve(null);
    }
    const useCache = !(opts && opts.useCache === false);
    const fileDir = filePath ? path$1.dirname(filePath) : undefined;
    return ((useCache ? withCache : noCache)
        .load(fileDir, opts && opts.configFile)
        .then(result => {
        if (!result) {
            return null;
        }
        return mergeOverrides(result.config, filePath);
    }));
}
function clearCache() {
    withCache.clearCaches();
}
function resolveConfigFile(filePath) {
    return noCache.load(filePath).then(result => {
        if (result) {
            return result.filepath;
        }
        return null;
    });
}
function mergeOverrides(config, filePath) {
    const options = Object.assign({}, config);
    if (filePath && options.overrides) {
        for (const override of options.overrides) {
            if (pathMatchesGlobs(filePath, override.files, override.excludeFiles)) {
                Object.assign(options, override.options);
            }
        }
    }
    delete options.overrides;
    return options;
}
// Based on eslint: https://github.com/eslint/eslint/blob/master/lib/config/config-ops.js
function pathMatchesGlobs(filePath, patterns, excludedPatterns) {
    const patternList = [].concat(patterns);
    const excludedPatternList = [].concat(excludedPatterns || []);
    const opts = { matchBase: true };
    return (patternList.some(pattern => minimatch(filePath, pattern, opts)) &&
        !excludedPatternList.some(excludedPattern => minimatch(filePath, excludedPattern, opts)));
}
var resolveConfig_1 = {
    resolveConfig,
    resolveConfigFile,
    clearCache
};
var require$$2$19 = (_package$1 && _package$1['default']) || _package$1;
const stripBom = index$2;
const comments = comments$1;
const version = require$$2$19.version;
const printAstToDoc = printer.printAstToDoc;
const util$1 = util$3;
const printDocToString = docPrinter.printDocToString;
const normalizeOptions = options.normalize;
const parser = parser$1;
const printDocToDebug = docDebug.printDocToDebug;
const config = resolveConfig_1;
function guessLineEnding(text) {
    const index = text.indexOf("\n");
    if (index >= 0 && text.charAt(index - 1) === "\r") {
        return "\r\n";
    }
    return "\n";
}
function attachComments(text, ast, opts) {
    const astComments = ast.comments;
    if (astComments) {
        delete ast.comments;
        comments.attach(astComments, ast, text, opts);
    }
    ast.tokens = [];
    opts.originalText = text.trimRight();
    return astComments;
}
function ensureAllCommentsPrinted(astComments) {
    if (!astComments) {
        return;
    }
    for (let i = 0; i < astComments.length; ++i) {
        if (astComments[i].value.trim() === "prettier-ignore") {
            // If there's a prettier-ignore, we're not printing that sub-tree so we
            // don't know if the comments was printed or not.
            return;
        }
    }
    astComments.forEach(comment => {
        if (!comment.printed) {
            throw new Error('Comment "' +
                comment.value.trim() +
                '" was not printed. Please report this error!');
        }
        delete comment.printed;
    });
}
function formatWithCursor(text, opts, addAlignmentSize) {
    text = stripBom(text);
    addAlignmentSize = addAlignmentSize || 0;
    const ast = parser.parse(text, opts);
    const formattedRangeOnly = formatRange(text, opts, ast);
    if (formattedRangeOnly) {
        return { formatted: formattedRangeOnly };
    }
    let cursorOffset;
    if (opts.cursorOffset >= 0) {
        const cursorNodeAndParents = findNodeAtOffset(ast, opts.cursorOffset);
        const cursorNode = cursorNodeAndParents.node;
        if (cursorNode) {
            cursorOffset = opts.cursorOffset - util$1.locStart(cursorNode);
            opts.cursorNode = cursorNode;
        }
    }
    const astComments = attachComments(text, ast, opts);
    const doc = printAstToDoc(ast, opts, addAlignmentSize);
    opts.newLine = guessLineEnding(text);
    const toStringResult = printDocToString(doc, opts);
    const str = toStringResult.formatted;
    const cursorOffsetResult = toStringResult.cursor;
    ensureAllCommentsPrinted(astComments);
    // Remove extra leading indentation as well as the added indentation after last newline
    if (addAlignmentSize > 0) {
        return { formatted: str.trim() + opts.newLine };
    }
    if (cursorOffset !== undefined) {
        return {
            formatted: str,
            cursorOffset: cursorOffsetResult + cursorOffset
        };
    }
    return { formatted: str };
}
function format(text, opts, addAlignmentSize) {
    return formatWithCursor(text, opts, addAlignmentSize).formatted;
}
function findSiblingAncestors(startNodeAndParents, endNodeAndParents) {
    let resultStartNode = startNodeAndParents.node;
    let resultEndNode = endNodeAndParents.node;
    if (resultStartNode === resultEndNode) {
        return {
            startNode: resultStartNode,
            endNode: resultEndNode
        };
    }
    for (const endParent of endNodeAndParents.parentNodes) {
        if (endParent.type !== "Program" &&
            endParent.type !== "File" &&
            util$1.locStart(endParent) >= util$1.locStart(startNodeAndParents.node)) {
            resultEndNode = endParent;
        }
        else {
            break;
        }
    }
    for (const startParent of startNodeAndParents.parentNodes) {
        if (startParent.type !== "Program" &&
            startParent.type !== "File" &&
            util$1.locEnd(startParent) <= util$1.locEnd(endNodeAndParents.node)) {
            resultStartNode = startParent;
        }
        else {
            break;
        }
    }
    return {
        startNode: resultStartNode,
        endNode: resultEndNode
    };
}
function findNodeAtOffset(node, offset, predicate, parentNodes) {
    predicate = predicate || (() => true);
    parentNodes = parentNodes || [];
    const start = util$1.locStart(node);
    const end = util$1.locEnd(node);
    if (start <= offset && offset <= end) {
        for (const childNode of comments.getSortedChildNodes(node)) {
            const childResult = findNodeAtOffset(childNode, offset, predicate, [node].concat(parentNodes));
            if (childResult) {
                return childResult;
            }
        }
        if (predicate(node)) {
            return {
                node: node,
                parentNodes: parentNodes
            };
        }
    }
}
// See https://www.ecma-international.org/ecma-262/5.1/#sec-A.5
function isSourceElement(opts, node) {
    if (node == null) {
        return false;
    }
    switch (node.type || node.kind) {
        case "ObjectExpression": // JSON
        case "ArrayExpression": // JSON
        case "StringLiteral": // JSON
        case "NumericLiteral": // JSON
        case "BooleanLiteral": // JSON
        case "NullLiteral": // JSON
        case "json-identifier":
            return opts.parser === "json";
        case "FunctionDeclaration":
        case "BlockStatement":
        case "BreakStatement":
        case "ContinueStatement":
        case "DebuggerStatement":
        case "DoWhileStatement":
        case "EmptyStatement":
        case "ExpressionStatement":
        case "ForInStatement":
        case "ForStatement":
        case "IfStatement":
        case "LabeledStatement":
        case "ReturnStatement":
        case "SwitchStatement":
        case "ThrowStatement":
        case "TryStatement":
        case "VariableDeclaration":
        case "WhileStatement":
        case "WithStatement":
        case "ClassDeclaration": // ES 2015
        case "ImportDeclaration": // Module
        case "ExportDefaultDeclaration": // Module
        case "ExportNamedDeclaration": // Module
        case "ExportAllDeclaration": // Module
        case "TypeAlias": // Flow
        case "InterfaceDeclaration": // Flow, Typescript
        case "TypeAliasDeclaration": // Typescript
        case "ExportAssignment": // Typescript
        case "ExportDeclaration": // Typescript
        case "OperationDefinition": // GraphQL
        case "FragmentDefinition": // GraphQL
        case "VariableDefinition": // GraphQL
        case "TypeExtensionDefinition": // GraphQL
        case "ObjectTypeDefinition": // GraphQL
        case "FieldDefinition": // GraphQL
        case "DirectiveDefinition": // GraphQL
        case "EnumTypeDefinition": // GraphQL
        case "EnumValueDefinition": // GraphQL
        case "InputValueDefinition": // GraphQL
        case "InputObjectTypeDefinition": // GraphQL
        case "SchemaDefinition": // GraphQL
        case "OperationTypeDefinition": // GraphQL
        case "InterfaceTypeDefinition": // GraphQL
        case "UnionTypeDefinition": // GraphQL
        case "ScalarTypeDefinition":
            return true;
    }
    return false;
}
function calculateRange(text, opts, ast) {
    // Contract the range so that it has non-whitespace characters at its endpoints.
    // This ensures we can format a range that doesn't end on a node.
    const rangeStringOrig = text.slice(opts.rangeStart, opts.rangeEnd);
    const startNonWhitespace = Math.max(opts.rangeStart + rangeStringOrig.search(/\S/), opts.rangeStart);
    let endNonWhitespace;
    for (endNonWhitespace = opts.rangeEnd; endNonWhitespace > opts.rangeStart; --endNonWhitespace) {
        if (text[endNonWhitespace - 1].match(/\S/)) {
            break;
        }
    }
    const startNodeAndParents = findNodeAtOffset(ast, startNonWhitespace, node => isSourceElement(opts, node));
    const endNodeAndParents = findNodeAtOffset(ast, endNonWhitespace, node => isSourceElement(opts, node));
    if (!startNodeAndParents || !endNodeAndParents) {
        return {
            rangeStart: 0,
            rangeEnd: 0
        };
    }
    const siblingAncestors = findSiblingAncestors(startNodeAndParents, endNodeAndParents);
    const startNode = siblingAncestors.startNode;
    const endNode = siblingAncestors.endNode;
    const rangeStart = Math.min(util$1.locStart(startNode), util$1.locStart(endNode));
    const rangeEnd = Math.max(util$1.locEnd(startNode), util$1.locEnd(endNode));
    return {
        rangeStart: rangeStart,
        rangeEnd: rangeEnd
    };
}
function formatRange(text, opts, ast) {
    if (opts.rangeStart <= 0 && text.length <= opts.rangeEnd) {
        return;
    }
    const range = calculateRange(text, opts, ast);
    const rangeStart = range.rangeStart;
    const rangeEnd = range.rangeEnd;
    const rangeString = text.slice(rangeStart, rangeEnd);
    // Try to extend the range backwards to the beginning of the line.
    // This is so we can detect indentation correctly and restore it.
    // Use `Math.min` since `lastIndexOf` returns 0 when `rangeStart` is 0
    const rangeStart2 = Math.min(rangeStart, text.lastIndexOf("\n", rangeStart) + 1);
    const indentString = text.slice(rangeStart2, rangeStart);
    const alignmentSize = util$1.getAlignmentSize(indentString, opts.tabWidth);
    const rangeFormatted = format(rangeString, Object.assign({}, opts, {
        rangeStart: 0,
        rangeEnd: Infinity,
        printWidth: opts.printWidth - alignmentSize
    }), alignmentSize);
    // Since the range contracts to avoid trailing whitespace,
    // we need to remove the newline that was inserted by the `format` call.
    const rangeTrimmed = rangeFormatted.trimRight();
    return text.slice(0, rangeStart) + rangeTrimmed + text.slice(rangeEnd);
}
var index = {
    formatWithCursor: function (text, opts) {
        return formatWithCursor(text, normalizeOptions(opts));
    },
    format: function (text, opts) {
        return format(text, normalizeOptions(opts));
    },
    check: function (text, opts) {
        try {
            const formatted = format(text, normalizeOptions(opts));
            return formatted === text;
        }
        catch (e) {
            return false;
        }
    },
    resolveConfig: config.resolveConfig,
    clearConfigCache: config.clearCache,
    version,
    /* istanbul ignore next */
    __debug: {
        parse: function (text, opts) {
            return parser.parse(text, opts);
        },
        formatAST: function (ast, opts) {
            opts = normalizeOptions(opts);
            const doc = printAstToDoc(ast, opts);
            const str = printDocToString(doc, opts);
            return str;
        },
        // Doesn't handle shebang for now
        formatDoc: function (doc, opts) {
            opts = normalizeOptions(opts);
            const debug = printDocToDebug(doc);
            const str = format(debug, opts);
            return str;
        },
        printToDoc: function (text, opts) {
            opts = normalizeOptions(opts);
            const ast = parser.parse(text, opts);
            attachComments(text, ast, opts);
            const doc = printAstToDoc(ast, opts);
            return doc;
        },
        printDocToString: function (doc, opts) {
            opts = normalizeOptions(opts);
            const str = printDocToString(doc, opts);
            return str;
        }
    }
};
module.exports = index;
//# sourceMappingURL=index.js.map