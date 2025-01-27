"use strict";
function createError$1(e, n) { const r = new SyntaxError(e + " (" + n.start.line + ":" + n.start.column + ")"); return r.loc = n, r; }
function createCommonjsModule(e, n) { return n = { exports: {} }, e(n, n.exports), n.exports; }
function parseComments(e) { const n = []; let r = e.loc.startToken.next; for (; "<EOF>" !== r.kind;)
    "Comment" === r.kind && (Object.assign(r, { column: r.column - 1 }), n.push(r)), r = r.next; return n; }
function removeTokens(e) { if (e && "object" == typeof e) {
    delete e.startToken, delete e.endToken, delete e.prev, delete e.next;
    for (const n in e)
        removeTokens(e[n]);
} return e; }
function parse(e) { const n = index; try {
    const r = n.parse(e);
    return r.comments = parseComments(r), removeTokens(r), r;
}
catch (e) {
    const n = index$2.GraphQLError;
    throw e instanceof n ? createError(e.message, { start: { line: e.locations[0].line, column: e.locations[0].column } }) : e;
} }
var parserCreateError = createError$1, location = createCommonjsModule(function (e, n) { function r(e, n) { for (var r = /\r\n|[\n\r]/g, t = 1, i = n + 1, o = void 0; (o = r.exec(e.body)) && o.index < n;)
    t += 1, i = n + 1 - (o.index + o[0].length); return { line: t, column: i }; } Object.defineProperty(n, "__esModule", { value: !0 }), n.getLocation = r; }), GraphQLError_1 = createCommonjsModule(function (e, n) { function r(e, n, i, o, a, u) { var c = i; if (!c && n && n.length > 0) {
    var s = n[0];
    c = s && s.loc && s.loc.source;
} var l = o; !l && n && (l = n.filter(function (e) { return Boolean(e.loc); }).map(function (e) { return e.loc.start; })), l && 0 === l.length && (l = void 0); var d = void 0, f = c; f && l && (d = l.map(function (e) { return (0, t.getLocation)(f, e); })), Object.defineProperties(this, { message: { value: e, enumerable: !0, writable: !0 }, locations: { value: d || void 0, enumerable: !0 }, path: { value: a || void 0, enumerable: !0 }, nodes: { value: n || void 0 }, source: { value: c || void 0 }, positions: { value: l || void 0 }, originalError: { value: u } }), u && u.stack ? Object.defineProperty(this, "stack", { value: u.stack, writable: !0, configurable: !0 }) : Error.captureStackTrace ? Error.captureStackTrace(this, r) : Object.defineProperty(this, "stack", { value: Error().stack, writable: !0, configurable: !0 }); } Object.defineProperty(n, "__esModule", { value: !0 }), n.GraphQLError = r; var t = location; r.prototype = Object.create(Error.prototype, { constructor: { value: r }, name: { value: "GraphQLError" } }); }), syntaxError_1 = createCommonjsModule(function (e, n) { function r(e, n, r) { var i = (0, o.getLocation)(e, n); return new a.GraphQLError("Syntax Error " + e.name + " (" + i.line + ":" + i.column + ") " + r + "\n\n" + t(e, i), void 0, e, [n]); } function t(e, n) { var r = n.line, t = (r - 1).toString(), o = r.toString(), a = (r + 1).toString(), u = a.length, c = e.body.split(/\r\n|[\n\r]/g); return (r >= 2 ? i(u, t) + ": " + c[r - 2] + "\n" : "") + i(u, o) + ": " + c[r - 1] + "\n" + Array(2 + u + n.column).join(" ") + "^\n" + (r < c.length ? i(u, a) + ": " + c[r] + "\n" : ""); } function i(e, n) { return Array(e - n.length + 1).join(" ") + n; } Object.defineProperty(n, "__esModule", { value: !0 }), n.syntaxError = r; var o = location, a = GraphQLError_1; }), locatedError_1 = createCommonjsModule(function (e, n) { function r(e, n, r) { if (e && e.path)
    return e; var i = e ? e.message || String(e) : "An unknown error occurred."; return new t.GraphQLError(i, e && e.nodes || n, e && e.source, e && e.positions, r, e); } Object.defineProperty(n, "__esModule", { value: !0 }), n.locatedError = r; var t = GraphQLError_1; }), invariant_1 = createCommonjsModule(function (e, n) { function r(e, n) { if (!e)
    throw new Error(n); } Object.defineProperty(n, "__esModule", { value: !0 }), n.default = r; }), formatError_1 = createCommonjsModule(function (e, n) { function r(e) { return (0, t.default)(e, "Received null or undefined error."), { message: e.message, locations: e.locations, path: e.path }; } Object.defineProperty(n, "__esModule", { value: !0 }), n.formatError = r; var t = function (e) { return e && e.__esModule ? e : { default: e }; }(invariant_1); }), index$2 = createCommonjsModule(function (e, n) { Object.defineProperty(n, "__esModule", { value: !0 }); var r = GraphQLError_1; Object.defineProperty(n, "GraphQLError", { enumerable: !0, get: function () { return r.GraphQLError; } }); var t = syntaxError_1; Object.defineProperty(n, "syntaxError", { enumerable: !0, get: function () { return t.syntaxError; } }); var i = locatedError_1; Object.defineProperty(n, "locatedError", { enumerable: !0, get: function () { return i.locatedError; } }); var o = formatError_1; Object.defineProperty(n, "formatError", { enumerable: !0, get: function () { return o.formatError; } }); }), lexer = createCommonjsModule(function (e, n) { function r(e, n) { var r = new o(k, 0, 0, 0, 0, null); return { source: e, options: n, lastToken: r, token: r, line: 1, lineStart: 0, advance: t }; } function t() { var e = this.lastToken = this.token; if (e.kind !== y) {
    do {
        e = e.next = u(this, e);
    } while (e.kind === j);
    this.token = e;
} return e; } function i(e) { var n = e.value; return n ? e.kind + ' "' + n + '"' : e.kind; } function o(e, n, r, t, i, o, a) { this.kind = e, this.start = n, this.end = r, this.line = t, this.column = i, this.value = a, this.prev = o, this.next = null; } function a(e) { return isNaN(e) ? y : e < 127 ? JSON.stringify(String.fromCharCode(e)) : '"\\u' + ("00" + e.toString(16).toUpperCase()).slice(-4) + '"'; } function u(e, n) { var r = e.source, t = r.body, i = t.length, u = s(t, n.end, e), f = e.line, p = 1 + u - e.lineStart; if (u >= i)
    return new o(y, i, i, f, p, n); var E = M.call(t, u); if (E < 32 && 9 !== E && 10 !== E && 13 !== E)
    throw (0, m.syntaxError)(r, u, "Cannot contain the invalid character " + a(E) + "."); switch (E) {
    case 33: return new o(N, u, u + 1, f, p, n);
    case 35: return l(r, u, f, p, n);
    case 36: return new o(I, u, u + 1, f, p, n);
    case 40: return new o(O, u, u + 1, f, p, n);
    case 41: return new o(_, u, u + 1, f, p, n);
    case 46:
        if (46 === M.call(t, u + 1) && 46 === M.call(t, u + 2))
            return new o(h, u, u + 3, f, p, n);
        break;
    case 58: return new o(A, u, u + 1, f, p, n);
    case 61: return new o(D, u, u + 1, f, p, n);
    case 64: return new o(g, u, u + 1, f, p, n);
    case 91: return new o(b, u, u + 1, f, p, n);
    case 93: return new o(L, u, u + 1, f, p, n);
    case 123: return new o(S, u, u + 1, f, p, n);
    case 124: return new o(C, u, u + 1, f, p, n);
    case 125: return new o(R, u, u + 1, f, p, n);
    case 65:
    case 66:
    case 67:
    case 68:
    case 69:
    case 70:
    case 71:
    case 72:
    case 73:
    case 74:
    case 75:
    case 76:
    case 77:
    case 78:
    case 79:
    case 80:
    case 81:
    case 82:
    case 83:
    case 84:
    case 85:
    case 86:
    case 87:
    case 88:
    case 89:
    case 90:
    case 95:
    case 97:
    case 98:
    case 99:
    case 100:
    case 101:
    case 102:
    case 103:
    case 104:
    case 105:
    case 106:
    case 107:
    case 108:
    case 109:
    case 110:
    case 111:
    case 112:
    case 113:
    case 114:
    case 115:
    case 116:
    case 117:
    case 118:
    case 119:
    case 120:
    case 121:
    case 122: return T(r, u, f, p, n);
    case 45:
    case 48:
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57: return d(r, u, E, f, p, n);
    case 34: return v(r, u, f, p, n);
} throw (0, m.syntaxError)(r, u, c(E)); } function c(e) { return 39 === e ? "Unexpected single quote character ('), did you mean to use a double quote (\")?" : "Cannot parse the unexpected character " + a(e) + "."; } function s(e, n, r) { for (var t = e.length, i = n; i < t;) {
    var o = M.call(e, i);
    if (9 === o || 32 === o || 44 === o || 65279 === o)
        ++i;
    else if (10 === o)
        ++i, ++r.line, r.lineStart = i;
    else {
        if (13 !== o)
            break;
        10 === M.call(e, i + 1) ? i += 2 : ++i, ++r.line, r.lineStart = i;
    }
} return i; } function l(e, n, r, t, i) { var a = e.body, u = void 0, c = n; do {
    u = M.call(a, ++c);
} while (null !== u && (u > 31 || 9 === u)); return new o(j, n, c, r, t, i, V.call(a, n + 1, c)); } function d(e, n, r, t, i, u) { var c = e.body, s = r, l = n, d = !1; if (45 === s && (s = M.call(c, ++l)), 48 === s) {
    if ((s = M.call(c, ++l)) >= 48 && s <= 57)
        throw (0, m.syntaxError)(e, l, "Invalid number, unexpected digit after 0: " + a(s) + ".");
}
else
    l = f(e, l, s), s = M.call(c, l); return 46 === s && (d = !0, s = M.call(c, ++l), l = f(e, l, s), s = M.call(c, l)), 69 !== s && 101 !== s || (d = !0, 43 !== (s = M.call(c, ++l)) && 45 !== s || (s = M.call(c, ++l)), l = f(e, l, s)), new o(d ? F : K, n, l, t, i, u, V.call(c, n, l)); } function f(e, n, r) { var t = e.body, i = n, o = r; if (o >= 48 && o <= 57) {
    do {
        o = M.call(t, ++i);
    } while (o >= 48 && o <= 57);
    return i;
} throw (0, m.syntaxError)(e, i, "Invalid number, expected digit but got: " + a(o) + "."); } function v(e, n, r, t, i) { for (var u = e.body, c = n + 1, s = c, l = 0, d = ""; c < u.length && null !== (l = M.call(u, c)) && 10 !== l && 13 !== l && 34 !== l;) {
    if (l < 32 && 9 !== l)
        throw (0, m.syntaxError)(e, c, "Invalid character within String: " + a(l) + ".");
    if (++c, 92 === l) {
        switch (d += V.call(u, s, c - 1), l = M.call(u, c)) {
            case 34:
                d += '"';
                break;
            case 47:
                d += "/";
                break;
            case 92:
                d += "\\";
                break;
            case 98:
                d += "\b";
                break;
            case 102:
                d += "\f";
                break;
            case 110:
                d += "\n";
                break;
            case 114:
                d += "\r";
                break;
            case 116:
                d += "\t";
                break;
            case 117:
                var f = p(M.call(u, c + 1), M.call(u, c + 2), M.call(u, c + 3), M.call(u, c + 4));
                if (f < 0)
                    throw (0, m.syntaxError)(e, c, "Invalid character escape sequence: \\u" + u.slice(c + 1, c + 5) + ".");
                d += String.fromCharCode(f), c += 4;
                break;
            default: throw (0, m.syntaxError)(e, c, "Invalid character escape sequence: \\" + String.fromCharCode(l) + ".");
        }
        s = ++c;
    }
} if (34 !== l)
    throw (0, m.syntaxError)(e, c, "Unterminated string."); return d += V.call(u, s, c), new o(w, n, c + 1, r, t, i, d); } function p(e, n, r, t) { return E(e) << 12 | E(n) << 8 | E(r) << 4 | E(t); } function E(e) { return e >= 48 && e <= 57 ? e - 48 : e >= 65 && e <= 70 ? e - 55 : e >= 97 && e <= 102 ? e - 87 : -1; } function T(e, n, r, t, i) { for (var a = e.body, u = a.length, c = n + 1, s = 0; c !== u && null !== (s = M.call(a, c)) && (95 === s || s >= 48 && s <= 57 || s >= 65 && s <= 90 || s >= 97 && s <= 122);)
    ++c; return new o(P, n, c, r, t, i, V.call(a, n, c)); } Object.defineProperty(n, "__esModule", { value: !0 }), n.TokenKind = void 0, n.createLexer = r, n.getTokenDesc = i; var m = index$2, k = "<SOF>", y = "<EOF>", N = "!", I = "$", O = "(", _ = ")", h = "...", A = ":", D = "=", g = "@", b = "[", L = "]", S = "{", C = "|", R = "}", P = "Name", K = "Int", F = "Float", w = "String", j = "Comment", M = (n.TokenKind = { SOF: k, EOF: y, BANG: N, DOLLAR: I, PAREN_L: O, PAREN_R: _, SPREAD: h, COLON: A, EQUALS: D, AT: g, BRACKET_L: b, BRACKET_R: L, BRACE_L: S, PIPE: C, BRACE_R: R, NAME: P, INT: K, FLOAT: F, STRING: w, COMMENT: j }, String.prototype.charCodeAt), V = String.prototype.slice; o.prototype.toJSON = o.prototype.inspect = function () { return { kind: this.kind, value: this.value, line: this.line, column: this.column }; }; }), source = createCommonjsModule(function (e, n) { function r(e, n) { if (!(e instanceof n))
    throw new TypeError("Cannot call a class as a function"); } Object.defineProperty(n, "__esModule", { value: !0 }); n.Source = function e(n, t) { r(this, e), this.body = n, this.name = t || "GraphQL request"; }; }), kinds = createCommonjsModule(function (e, n) { Object.defineProperty(n, "__esModule", { value: !0 }); n.NAME = "Name", n.DOCUMENT = "Document", n.OPERATION_DEFINITION = "OperationDefinition", n.VARIABLE_DEFINITION = "VariableDefinition", n.VARIABLE = "Variable", n.SELECTION_SET = "SelectionSet", n.FIELD = "Field", n.ARGUMENT = "Argument", n.FRAGMENT_SPREAD = "FragmentSpread", n.INLINE_FRAGMENT = "InlineFragment", n.FRAGMENT_DEFINITION = "FragmentDefinition", n.INT = "IntValue", n.FLOAT = "FloatValue", n.STRING = "StringValue", n.BOOLEAN = "BooleanValue", n.NULL = "NullValue", n.ENUM = "EnumValue", n.LIST = "ListValue", n.OBJECT = "ObjectValue", n.OBJECT_FIELD = "ObjectField", n.DIRECTIVE = "Directive", n.NAMED_TYPE = "NamedType", n.LIST_TYPE = "ListType", n.NON_NULL_TYPE = "NonNullType", n.SCHEMA_DEFINITION = "SchemaDefinition", n.OPERATION_TYPE_DEFINITION = "OperationTypeDefinition", n.SCALAR_TYPE_DEFINITION = "ScalarTypeDefinition", n.OBJECT_TYPE_DEFINITION = "ObjectTypeDefinition", n.FIELD_DEFINITION = "FieldDefinition", n.INPUT_VALUE_DEFINITION = "InputValueDefinition", n.INTERFACE_TYPE_DEFINITION = "InterfaceTypeDefinition", n.UNION_TYPE_DEFINITION = "UnionTypeDefinition", n.ENUM_TYPE_DEFINITION = "EnumTypeDefinition", n.ENUM_VALUE_DEFINITION = "EnumValueDefinition", n.INPUT_OBJECT_TYPE_DEFINITION = "InputObjectTypeDefinition", n.TYPE_EXTENSION_DEFINITION = "TypeExtensionDefinition", n.DIRECTIVE_DEFINITION = "DirectiveDefinition"; }), parser = createCommonjsModule(function (e, n) { function r(e, n) { var r = "string" == typeof e ? new ie.Source(e) : e; if (!(r instanceof ie.Source))
    throw new TypeError("Must provide Source. Received: " + String(r)); return a((0, ae.createLexer)(r, n || {})); } function t(e, n) { var r = "string" == typeof e ? new ie.Source(e) : e, t = (0, ae.createLexer)(r, n || {}); Z(t, ae.TokenKind.SOF); var i = I(t, !1); return Z(t, ae.TokenKind.EOF), i; } function i(e, n) { var r = "string" == typeof e ? new ie.Source(e) : e, t = (0, ae.createLexer)(r, n || {}); Z(t, ae.TokenKind.SOF); var i = L(t); return Z(t, ae.TokenKind.EOF), i; } function o(e) { var n = Z(e, ae.TokenKind.NAME); return { kind: ue.NAME, value: n.value, loc: W(e, n) }; } function a(e) { var n = e.token; Z(e, ae.TokenKind.SOF); var r = []; do {
    r.push(u(e));
} while (!z(e, ae.TokenKind.EOF)); return { kind: ue.DOCUMENT, definitions: r, loc: W(e, n) }; } function u(e) { if (X(e, ae.TokenKind.BRACE_L))
    return c(e); if (X(e, ae.TokenKind.NAME))
    switch (e.token.value) {
        case "query":
        case "mutation":
        case "subscription": return c(e);
        case "fragment": return y(e);
        case "schema":
        case "scalar":
        case "type":
        case "interface":
        case "union":
        case "enum":
        case "input":
        case "extend":
        case "directive": return C(e);
    } throw ne(e); } function c(e) { var n = e.token; if (X(e, ae.TokenKind.BRACE_L))
    return { kind: ue.OPERATION_DEFINITION, operation: "query", name: null, variableDefinitions: null, directives: [], selectionSet: v(e), loc: W(e, n) }; var r = s(e), t = void 0; return X(e, ae.TokenKind.NAME) && (t = o(e)), { kind: ue.OPERATION_DEFINITION, operation: r, name: t, variableDefinitions: l(e), directives: g(e), selectionSet: v(e), loc: W(e, n) }; } function s(e) { var n = Z(e, ae.TokenKind.NAME); switch (n.value) {
    case "query": return "query";
    case "mutation": return "mutation";
    case "subscription": return "subscription";
} throw ne(e, n); } function l(e) { return X(e, ae.TokenKind.PAREN_L) ? te(e, ae.TokenKind.PAREN_L, d, ae.TokenKind.PAREN_R) : []; } function d(e) { var n = e.token; return { kind: ue.VARIABLE_DEFINITION, variable: f(e), type: (Z(e, ae.TokenKind.COLON), L(e)), defaultValue: z(e, ae.TokenKind.EQUALS) ? I(e, !0) : null, loc: W(e, n) }; } function f(e) { var n = e.token; return Z(e, ae.TokenKind.DOLLAR), { kind: ue.VARIABLE, name: o(e), loc: W(e, n) }; } function v(e) { var n = e.token; return { kind: ue.SELECTION_SET, selections: te(e, ae.TokenKind.BRACE_L, p, ae.TokenKind.BRACE_R), loc: W(e, n) }; } function p(e) { return X(e, ae.TokenKind.SPREAD) ? k(e) : E(e); } function E(e) { var n = e.token, r = o(e), t = void 0, i = void 0; return z(e, ae.TokenKind.COLON) ? (t = r, i = o(e)) : (t = null, i = r), { kind: ue.FIELD, alias: t, name: i, arguments: T(e), directives: g(e), selectionSet: X(e, ae.TokenKind.BRACE_L) ? v(e) : null, loc: W(e, n) }; } function T(e) { return X(e, ae.TokenKind.PAREN_L) ? te(e, ae.TokenKind.PAREN_L, m, ae.TokenKind.PAREN_R) : []; } function m(e) { var n = e.token; return { kind: ue.ARGUMENT, name: o(e), value: (Z(e, ae.TokenKind.COLON), I(e, !1)), loc: W(e, n) }; } function k(e) { var n = e.token; if (Z(e, ae.TokenKind.SPREAD), X(e, ae.TokenKind.NAME) && "on" !== e.token.value)
    return { kind: ue.FRAGMENT_SPREAD, name: N(e), directives: g(e), loc: W(e, n) }; var r = null; return "on" === e.token.value && (e.advance(), r = S(e)), { kind: ue.INLINE_FRAGMENT, typeCondition: r, directives: g(e), selectionSet: v(e), loc: W(e, n) }; } function y(e) { var n = e.token; return ee(e, "fragment"), { kind: ue.FRAGMENT_DEFINITION, name: N(e), typeCondition: (ee(e, "on"), S(e)), directives: g(e), selectionSet: v(e), loc: W(e, n) }; } function N(e) { if ("on" === e.token.value)
    throw ne(e); return o(e); } function I(e, n) { var r = e.token; switch (r.kind) {
    case ae.TokenKind.BRACKET_L: return h(e, n);
    case ae.TokenKind.BRACE_L: return A(e, n);
    case ae.TokenKind.INT: return e.advance(), { kind: ue.INT, value: r.value, loc: W(e, r) };
    case ae.TokenKind.FLOAT: return e.advance(), { kind: ue.FLOAT, value: r.value, loc: W(e, r) };
    case ae.TokenKind.STRING: return e.advance(), { kind: ue.STRING, value: r.value, loc: W(e, r) };
    case ae.TokenKind.NAME: return "true" === r.value || "false" === r.value ? (e.advance(), { kind: ue.BOOLEAN, value: "true" === r.value, loc: W(e, r) }) : "null" === r.value ? (e.advance(), { kind: ue.NULL, loc: W(e, r) }) : (e.advance(), { kind: ue.ENUM, value: r.value, loc: W(e, r) });
    case ae.TokenKind.DOLLAR: if (!n)
        return f(e);
} throw ne(e); } function O(e) { return I(e, !0); } function _(e) { return I(e, !1); } function h(e, n) { var r = e.token, t = n ? O : _; return { kind: ue.LIST, values: re(e, ae.TokenKind.BRACKET_L, t, ae.TokenKind.BRACKET_R), loc: W(e, r) }; } function A(e, n) { var r = e.token; Z(e, ae.TokenKind.BRACE_L); for (var t = []; !z(e, ae.TokenKind.BRACE_R);)
    t.push(D(e, n)); return { kind: ue.OBJECT, fields: t, loc: W(e, r) }; } function D(e, n) { var r = e.token; return { kind: ue.OBJECT_FIELD, name: o(e), value: (Z(e, ae.TokenKind.COLON), I(e, n)), loc: W(e, r) }; } function g(e) { for (var n = []; X(e, ae.TokenKind.AT);)
    n.push(b(e)); return n; } function b(e) { var n = e.token; return Z(e, ae.TokenKind.AT), { kind: ue.DIRECTIVE, name: o(e), arguments: T(e), loc: W(e, n) }; } function L(e) { var n = e.token, r = void 0; return z(e, ae.TokenKind.BRACKET_L) ? (r = L(e), Z(e, ae.TokenKind.BRACKET_R), r = { kind: ue.LIST_TYPE, type: r, loc: W(e, n) }) : r = S(e), z(e, ae.TokenKind.BANG) ? { kind: ue.NON_NULL_TYPE, type: r, loc: W(e, n) } : r; } function S(e) { var n = e.token; return { kind: ue.NAMED_TYPE, name: o(e), loc: W(e, n) }; } function C(e) { if (X(e, ae.TokenKind.NAME))
    switch (e.token.value) {
        case "schema": return R(e);
        case "scalar": return K(e);
        case "type": return F(e);
        case "interface": return x(e);
        case "union": return B(e);
        case "enum": return G(e);
        case "input": return Q(e);
        case "extend": return J(e);
        case "directive": return q(e);
    } throw ne(e); } function R(e) { var n = e.token; ee(e, "schema"); var r = g(e), t = te(e, ae.TokenKind.BRACE_L, P, ae.TokenKind.BRACE_R); return { kind: ue.SCHEMA_DEFINITION, directives: r, operationTypes: t, loc: W(e, n) }; } function P(e) { var n = e.token, r = s(e); Z(e, ae.TokenKind.COLON); var t = S(e); return { kind: ue.OPERATION_TYPE_DEFINITION, operation: r, type: t, loc: W(e, n) }; } function K(e) { var n = e.token; ee(e, "scalar"); var r = o(e), t = g(e); return { kind: ue.SCALAR_TYPE_DEFINITION, name: r, directives: t, loc: W(e, n) }; } function F(e) { var n = e.token; ee(e, "type"); var r = o(e), t = w(e), i = g(e), a = re(e, ae.TokenKind.BRACE_L, j, ae.TokenKind.BRACE_R); return { kind: ue.OBJECT_TYPE_DEFINITION, name: r, interfaces: t, directives: i, fields: a, loc: W(e, n) }; } function w(e) { var n = []; if ("implements" === e.token.value) {
    e.advance();
    do {
        n.push(S(e));
    } while (X(e, ae.TokenKind.NAME));
} return n; } function j(e) { var n = e.token, r = o(e), t = M(e); Z(e, ae.TokenKind.COLON); var i = L(e), a = g(e); return { kind: ue.FIELD_DEFINITION, name: r, arguments: t, type: i, directives: a, loc: W(e, n) }; } function M(e) { return X(e, ae.TokenKind.PAREN_L) ? te(e, ae.TokenKind.PAREN_L, V, ae.TokenKind.PAREN_R) : []; } function V(e) { var n = e.token, r = o(e); Z(e, ae.TokenKind.COLON); var t = L(e), i = null; z(e, ae.TokenKind.EQUALS) && (i = O(e)); var a = g(e); return { kind: ue.INPUT_VALUE_DEFINITION, name: r, type: t, defaultValue: i, directives: a, loc: W(e, n) }; } function x(e) { var n = e.token; ee(e, "interface"); var r = o(e), t = g(e), i = re(e, ae.TokenKind.BRACE_L, j, ae.TokenKind.BRACE_R); return { kind: ue.INTERFACE_TYPE_DEFINITION, name: r, directives: t, fields: i, loc: W(e, n) }; } function B(e) { var n = e.token; ee(e, "union"); var r = o(e), t = g(e); Z(e, ae.TokenKind.EQUALS); var i = U(e); return { kind: ue.UNION_TYPE_DEFINITION, name: r, directives: t, types: i, loc: W(e, n) }; } function U(e) { var n = []; do {
    n.push(S(e));
} while (z(e, ae.TokenKind.PIPE)); return n; } function G(e) { var n = e.token; ee(e, "enum"); var r = o(e), t = g(e), i = te(e, ae.TokenKind.BRACE_L, Y, ae.TokenKind.BRACE_R); return { kind: ue.ENUM_TYPE_DEFINITION, name: r, directives: t, values: i, loc: W(e, n) }; } function Y(e) { var n = e.token, r = o(e), t = g(e); return { kind: ue.ENUM_VALUE_DEFINITION, name: r, directives: t, loc: W(e, n) }; } function Q(e) { var n = e.token; ee(e, "input"); var r = o(e), t = g(e), i = re(e, ae.TokenKind.BRACE_L, V, ae.TokenKind.BRACE_R); return { kind: ue.INPUT_OBJECT_TYPE_DEFINITION, name: r, directives: t, fields: i, loc: W(e, n) }; } function J(e) { var n = e.token; ee(e, "extend"); var r = F(e); return { kind: ue.TYPE_EXTENSION_DEFINITION, definition: r, loc: W(e, n) }; } function q(e) { var n = e.token; ee(e, "directive"), Z(e, ae.TokenKind.AT); var r = o(e), t = M(e); ee(e, "on"); var i = $(e); return { kind: ue.DIRECTIVE_DEFINITION, name: r, arguments: t, locations: i, loc: W(e, n) }; } function $(e) { var n = []; do {
    n.push(o(e));
} while (z(e, ae.TokenKind.PIPE)); return n; } function W(e, n) { if (!e.options.noLocation)
    return new H(n, e.lastToken, e.source); } function H(e, n, r) { this.start = e.start, this.end = n.end, this.startToken = e, this.endToken = n, this.source = r; } function X(e, n) { return e.token.kind === n; } function z(e, n) { var r = e.token.kind === n; return r && e.advance(), r; } function Z(e, n) { var r = e.token; if (r.kind === n)
    return e.advance(), r; throw (0, oe.syntaxError)(e.source, r.start, "Expected " + n + ", found " + (0, ae.getTokenDesc)(r)); } function ee(e, n) { var r = e.token; if (r.kind === ae.TokenKind.NAME && r.value === n)
    return e.advance(), r; throw (0, oe.syntaxError)(e.source, r.start, 'Expected "' + n + '", found ' + (0, ae.getTokenDesc)(r)); } function ne(e, n) { var r = n || e.token; return (0, oe.syntaxError)(e.source, r.start, "Unexpected " + (0, ae.getTokenDesc)(r)); } function re(e, n, r, t) { Z(e, n); for (var i = []; !z(e, t);)
    i.push(r(e)); return i; } function te(e, n, r, t) { Z(e, n); for (var i = [r(e)]; !z(e, t);)
    i.push(r(e)); return i; } Object.defineProperty(n, "__esModule", { value: !0 }), n.parse = r, n.parseValue = t, n.parseType = i, n.parseConstValue = O, n.parseTypeReference = L, n.parseNamedType = S; var ie = source, oe = index$2, ae = lexer, ue = kinds; H.prototype.toJSON = H.prototype.inspect = function () { return { start: this.start, end: this.end }; }; }), visitor = createCommonjsModule(function (e, n) { function r(e, n, r) { var i = r || u, o = void 0, s = Array.isArray(e), l = [e], d = -1, f = [], v = void 0, p = [], E = [], T = e; do {
    var m = ++d === l.length, k = void 0, y = void 0, N = m && 0 !== f.length;
    if (m) {
        if (k = 0 === E.length ? void 0 : p.pop(), y = v, v = E.pop(), N) {
            if (s)
                y = y.slice();
            else {
                var I = {};
                for (var O in y)
                    y.hasOwnProperty(O) && (I[O] = y[O]);
                y = I;
            }
            for (var _ = 0, h = 0; h < f.length; h++) {
                var A = f[h][0], D = f[h][1];
                s && (A -= _), s && null === D ? (y.splice(A, 1), _++) : y[A] = D;
            }
        }
        d = o.index, l = o.keys, f = o.edits, s = o.inArray, o = o.prev;
    }
    else {
        if (k = v ? s ? d : l[d] : void 0, null === (y = v ? v[k] : T) || void 0 === y)
            continue;
        v && p.push(k);
    }
    var g = void 0;
    if (!Array.isArray(y)) {
        if (!t(y))
            throw new Error("Invalid AST Node: " + JSON.stringify(y));
        var b = a(n, y.kind, m);
        if (b) {
            if ((g = b.call(n, y, k, v, p, E)) === c)
                break;
            if (!1 === g) {
                if (!m) {
                    p.pop();
                    continue;
                }
            }
            else if (void 0 !== g && (f.push([k, g]), !m)) {
                if (!t(g)) {
                    p.pop();
                    continue;
                }
                y = g;
            }
        }
    }
    void 0 === g && N && f.push([k, y]), m || (o = { inArray: s, index: d, keys: l, edits: f, prev: o }, l = (s = Array.isArray(y)) ? y : i[y.kind] || [], d = -1, f = [], v && E.push(v), v = y);
} while (void 0 !== o); return 0 !== f.length && (T = f[f.length - 1][1]), T; } function t(e) { return e && "string" == typeof e.kind; } function i(e) { var n = new Array(e.length); return { enter: function (r) { for (var t = 0; t < e.length; t++)
        if (!n[t]) {
            var i = a(e[t], r.kind, !1);
            if (i) {
                var o = i.apply(e[t], arguments);
                if (!1 === o)
                    n[t] = r;
                else if (o === c)
                    n[t] = c;
                else if (void 0 !== o)
                    return o;
            }
        } }, leave: function (r) { for (var t = 0; t < e.length; t++)
        if (n[t])
            n[t] === r && (n[t] = null);
        else {
            var i = a(e[t], r.kind, !0);
            if (i) {
                var o = i.apply(e[t], arguments);
                if (o === c)
                    n[t] = c;
                else if (void 0 !== o && !1 !== o)
                    return o;
            }
        } } }; } function o(e, n) { return { enter: function (r) { e.enter(r); var i = a(n, r.kind, !1); if (i) {
        var o = i.apply(n, arguments);
        return void 0 !== o && (e.leave(r), t(o) && e.enter(o)), o;
    } }, leave: function (r) { var t = a(n, r.kind, !0), i = void 0; return t && (i = t.apply(n, arguments)), e.leave(r), i; } }; } function a(e, n, r) { var t = e[n]; if (t) {
    if (!r && "function" == typeof t)
        return t;
    var i = r ? t.leave : t.enter;
    if ("function" == typeof i)
        return i;
}
else {
    var o = r ? e.leave : e.enter;
    if (o) {
        if ("function" == typeof o)
            return o;
        var a = o[n];
        if ("function" == typeof a)
            return a;
    }
} } Object.defineProperty(n, "__esModule", { value: !0 }), n.visit = r, n.visitInParallel = i, n.visitWithTypeInfo = o, n.getVisitFn = a; var u = n.QueryDocumentKeys = { Name: [], Document: ["definitions"], OperationDefinition: ["name", "variableDefinitions", "directives", "selectionSet"], VariableDefinition: ["variable", "type", "defaultValue"], Variable: ["name"], SelectionSet: ["selections"], Field: ["alias", "name", "arguments", "directives", "selectionSet"], Argument: ["name", "value"], FragmentSpread: ["name", "directives"], InlineFragment: ["typeCondition", "directives", "selectionSet"], FragmentDefinition: ["name", "typeCondition", "directives", "selectionSet"], IntValue: [], FloatValue: [], StringValue: [], BooleanValue: [], NullValue: [], EnumValue: [], ListValue: ["values"], ObjectValue: ["fields"], ObjectField: ["name", "value"], Directive: ["name", "arguments"], NamedType: ["name"], ListType: ["type"], NonNullType: ["type"], SchemaDefinition: ["directives", "operationTypes"], OperationTypeDefinition: ["type"], ScalarTypeDefinition: ["name", "directives"], ObjectTypeDefinition: ["name", "interfaces", "directives", "fields"], FieldDefinition: ["name", "arguments", "type", "directives"], InputValueDefinition: ["name", "type", "defaultValue", "directives"], InterfaceTypeDefinition: ["name", "directives", "fields"], UnionTypeDefinition: ["name", "directives", "types"], EnumTypeDefinition: ["name", "directives", "values"], EnumValueDefinition: ["name", "directives"], InputObjectTypeDefinition: ["name", "directives", "fields"], TypeExtensionDefinition: ["definition"], DirectiveDefinition: ["name", "arguments", "locations"] }, c = n.BREAK = {}; }), printer = createCommonjsModule(function (e, n) { function r(e) { return (0, u.visit)(e, { leave: c }); } function t(e, n) { return e ? e.filter(function (e) { return e; }).join(n || "") : ""; } function i(e) { return e && 0 !== e.length ? a("{\n" + t(e, "\n")) + "\n}" : "{}"; } function o(e, n, r) { return n ? e + n + (r || "") : ""; } function a(e) { return e && e.replace(/\n/g, "\n  "); } Object.defineProperty(n, "__esModule", { value: !0 }), n.print = r; var u = visitor, c = { Name: function (e) { return e.value; }, Variable: function (e) { return "$" + e.name; }, Document: function (e) { return t(e.definitions, "\n\n") + "\n"; }, OperationDefinition: function (e) { var n = e.operation, r = e.name, i = o("(", t(e.variableDefinitions, ", "), ")"), a = t(e.directives, " "), u = e.selectionSet; return r || a || i || "query" !== n ? t([n, t([r, i]), a, u], " ") : u; }, VariableDefinition: function (e) { return e.variable + ": " + e.type + o(" = ", e.defaultValue); }, SelectionSet: function (e) { return i(e.selections); }, Field: function (e) { var n = e.alias, r = e.name, i = e.arguments, a = e.directives, u = e.selectionSet; return t([o("", n, ": ") + r + o("(", t(i, ", "), ")"), t(a, " "), u], " "); }, Argument: function (e) { return e.name + ": " + e.value; }, FragmentSpread: function (e) { return "..." + e.name + o(" ", t(e.directives, " ")); }, InlineFragment: function (e) { var n = e.typeCondition, r = e.directives, i = e.selectionSet; return t(["...", o("on ", n), t(r, " "), i], " "); }, FragmentDefinition: function (e) { var n = e.name, r = e.typeCondition, i = e.directives, a = e.selectionSet; return "fragment " + n + " on " + r + " " + o("", t(i, " "), " ") + a; }, IntValue: function (e) { return e.value; }, FloatValue: function (e) { return e.value; }, StringValue: function (e) { var n = e.value; return JSON.stringify(n); }, BooleanValue: function (e) { var n = e.value; return JSON.stringify(n); }, NullValue: function () { return "null"; }, EnumValue: function (e) { return e.value; }, ListValue: function (e) { return "[" + t(e.values, ", ") + "]"; }, ObjectValue: function (e) { return "{" + t(e.fields, ", ") + "}"; }, ObjectField: function (e) { return e.name + ": " + e.value; }, Directive: function (e) { return "@" + e.name + o("(", t(e.arguments, ", "), ")"); }, NamedType: function (e) { return e.name; }, ListType: function (e) { return "[" + e.type + "]"; }, NonNullType: function (e) { return e.type + "!"; }, SchemaDefinition: function (e) { var n = e.directives, r = e.operationTypes; return t(["schema", t(n, " "), i(r)], " "); }, OperationTypeDefinition: function (e) { return e.operation + ": " + e.type; }, ScalarTypeDefinition: function (e) { return t(["scalar", e.name, t(e.directives, " ")], " "); }, ObjectTypeDefinition: function (e) { var n = e.name, r = e.interfaces, a = e.directives, u = e.fields; return t(["type", n, o("implements ", t(r, ", ")), t(a, " "), i(u)], " "); }, FieldDefinition: function (e) { var n = e.name, r = e.arguments, i = e.type, a = e.directives; return n + o("(", t(r, ", "), ")") + ": " + i + o(" ", t(a, " ")); }, InputValueDefinition: function (e) { var n = e.name, r = e.type, i = e.defaultValue, a = e.directives; return t([n + ": " + r, o("= ", i), t(a, " ")], " "); }, InterfaceTypeDefinition: function (e) { var n = e.name, r = e.directives, o = e.fields; return t(["interface", n, t(r, " "), i(o)], " "); }, UnionTypeDefinition: function (e) { var n = e.name, r = e.directives, i = e.types; return t(["union", n, t(r, " "), "= " + t(i, " | ")], " "); }, EnumTypeDefinition: function (e) { var n = e.name, r = e.directives, o = e.values; return t(["enum", n, t(r, " "), i(o)], " "); }, EnumValueDefinition: function (e) { return t([e.name, t(e.directives, " ")], " "); }, InputObjectTypeDefinition: function (e) { var n = e.name, r = e.directives, o = e.fields; return t(["input", n, t(r, " "), i(o)], " "); }, TypeExtensionDefinition: function (e) { return "extend " + e.definition; }, DirectiveDefinition: function (e) { var n = e.name, r = e.arguments, i = e.locations; return "directive @" + n + o("(", t(r, ", "), ")") + " on " + t(i, " | "); } }; }), index = createCommonjsModule(function (e, n) { Object.defineProperty(n, "__esModule", { value: !0 }), n.BREAK = n.getVisitFn = n.visitWithTypeInfo = n.visitInParallel = n.visit = n.Source = n.print = n.parseType = n.parseValue = n.parse = n.TokenKind = n.createLexer = n.Kind = n.getLocation = void 0; var r = location; Object.defineProperty(n, "getLocation", { enumerable: !0, get: function () { return r.getLocation; } }); var t = lexer; Object.defineProperty(n, "createLexer", { enumerable: !0, get: function () { return t.createLexer; } }), Object.defineProperty(n, "TokenKind", { enumerable: !0, get: function () { return t.TokenKind; } }); var i = parser; Object.defineProperty(n, "parse", { enumerable: !0, get: function () { return i.parse; } }), Object.defineProperty(n, "parseValue", { enumerable: !0, get: function () { return i.parseValue; } }), Object.defineProperty(n, "parseType", { enumerable: !0, get: function () { return i.parseType; } }); var o = printer; Object.defineProperty(n, "print", { enumerable: !0, get: function () { return o.print; } }); var a = source; Object.defineProperty(n, "Source", { enumerable: !0, get: function () { return a.Source; } }); var u = visitor; Object.defineProperty(n, "visit", { enumerable: !0, get: function () { return u.visit; } }), Object.defineProperty(n, "visitInParallel", { enumerable: !0, get: function () { return u.visitInParallel; } }), Object.defineProperty(n, "visitWithTypeInfo", { enumerable: !0, get: function () { return u.visitWithTypeInfo; } }), Object.defineProperty(n, "getVisitFn", { enumerable: !0, get: function () { return u.getVisitFn; } }), Object.defineProperty(n, "BREAK", { enumerable: !0, get: function () { return u.BREAK; } }); var c = function (e) { if (e && e.__esModule)
    return e; var n = {}; if (null != e)
    for (var r in e)
        Object.prototype.hasOwnProperty.call(e, r) && (n[r] = e[r]); return n.default = e, n; }(kinds); n.Kind = c; });
const createError = parserCreateError;
var parserGraphql = parse;
module.exports = parserGraphql;
//# sourceMappingURL=parser-graphql.js.map