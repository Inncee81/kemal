"use strict";
function createError$1(e, t) { const n = new SyntaxError(e + " (" + t.start.line + ":" + t.start.column + ")"); return n.loc = t, n; }
function createCommonjsModule(e, t) { return t = { exports: {} }, e(t, t.exports), t.exports; }
function parse(e) { const t = parse$1; try {
    const n = t(e);
    return toBabylon(n);
}
catch (e) {
    const t = e.message.indexOf("\n"), n = e.message.slice(0, t), r = n.lastIndexOf(" "), o = n.slice(0, r), l = n.slice(r + 1), a = l.split(":").map(Number);
    throw createError("(json-to-ast) " + o, { start: { line: a[0], column: a[1] } });
} }
function toBabylon(e) { const t = { type: { object: "ObjectExpression", property: "ObjectProperty", identifier: "json-identifier", array: "ArrayExpression" }[e.type], start: e.loc.start.offset, end: e.loc.end.offset, loc: e.loc }; switch (e.type) {
    case "object": return Object.assign(t, { properties: e.children.map(toBabylon) });
    case "property": return Object.assign(t, { key: toBabylon(e.key), value: toBabylon(e.value) });
    case "identifier": return Object.assign(t, { value: e.value });
    case "array": return Object.assign(t, { elements: e.children.map(toBabylon) });
    case "literal": {
        const n = { String: "StringLiteral", Number: "NumericLiteral", Boolean: "BooleanLiteral" }, r = JSON.parse(e.rawValue), o = null === r ? "NullLiteral" : n[r.constructor.name];
        return Object.assign(t, { type: o, value: r, extra: { raw: e.rawValue } });
    }
} }
var parserCreateError = createError$1, commonjsGlobal = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {}, parse$1 = createCommonjsModule(function (e, t) { !function (t, n) { n(e); }(0, function (e) { function t(e, t) { if (!(e instanceof t))
    throw new TypeError("Cannot call a class as a function"); } function n(e, t) { if (!e)
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return !t || "object" != typeof t && "function" != typeof t ? e : t; } function r(e, t) { if ("function" != typeof t && null !== t)
    throw new TypeError("Super expression must either be null or a function, not " + typeof t); e.prototype = Object.create(t && t.prototype, { constructor: { value: e, enumerable: !1, writable: !0, configurable: !0 } }), t && (Object.setPrototypeOf ? Object.setPrototypeOf(e, t) : e.__proto__ = t); } function o(e, t, n) { return e.split(/\n|\r\n?|\f/)[t - 1] + "\n" + (new Array(n).join(" ") + "^"); } function l(e) { return e >= "1" && e <= "9"; } function a(e) { return e >= "0" && e <= "9"; } function c(e) { return a(e) || e >= "a" && e <= "f" || e >= "A" && e <= "F"; } function s(e) { return "e" === e || "E" === e; } function u(e, t, n, r) { var o = e.charAt(t); if ("\r" === o)
    t++, n++, r = 1, "\n" === e.charAt(t) && t++;
else if ("\n" === o)
    t++, n++, r = 1;
else {
    if ("\t" !== o && " " !== o)
        return null;
    t++, r++;
} return { index: t, line: n, column: r }; } function i(e, t, n, r) { var o = e.charAt(t); return o in x ? { type: x[o], line: n, column: r + 1, index: t + 1, value: null } : null; } function f(e, t, n, r) { for (var o in S)
    if (S.hasOwnProperty(o) && e.substr(t, o.length) === o) {
        var l = S[o], a = l.type, c = l.value;
        return { type: a, line: n, column: r + o.length, index: t + o.length, value: c };
    } return null; } function p(e, t, n, r) { for (var o = t, l = "", a = N._START_; t < e.length;) {
    var s = e.charAt(t);
    switch (a) {
        case N._START_:
            if ('"' !== s)
                return null;
            a = N.START_QUOTE_OR_CHAR, t++;
            break;
        case N.START_QUOTE_OR_CHAR:
            if ("\\" === s)
                a = N.ESCAPE, l += s, t++;
            else {
                if ('"' === s)
                    return t++, { type: I.STRING, line: n, column: r + t - o, index: t, value: l };
                l += s, t++;
            }
            break;
        case N.ESCAPE:
            if (!(s in k))
                return null;
            if (l += s, t++, "u" === s)
                for (var u = 0; u < 4; u++) {
                    var i = e.charAt(t);
                    if (!i || !c(i))
                        return null;
                    l += i, t++;
                }
            a = N.START_QUOTE_OR_CHAR;
    }
} } function T(e, t, n, r) { var o = t, c = t, u = P._START_; e: for (; t < e.length;) {
    var i = e.charAt(t);
    switch (u) {
        case P._START_:
            if ("-" === i)
                u = P.MINUS;
            else if ("0" === i)
                c = t + 1, u = P.ZERO;
            else {
                if (!l(i))
                    return null;
                c = t + 1, u = P.DIGIT;
            }
            break;
        case P.MINUS:
            if ("0" === i)
                c = t + 1, u = P.ZERO;
            else {
                if (!l(i))
                    return null;
                c = t + 1, u = P.DIGIT;
            }
            break;
        case P.ZERO:
            if ("." === i)
                u = P.POINT;
            else {
                if (!s(i))
                    break e;
                u = P.EXP;
            }
            break;
        case P.DIGIT:
            if (a(i))
                c = t + 1;
            else if ("." === i)
                u = P.POINT;
            else {
                if (!s(i))
                    break e;
                u = P.EXP;
            }
            break;
        case P.POINT:
            if (!a(i))
                break e;
            c = t + 1, u = P.DIGIT_FRACTION;
            break;
        case P.DIGIT_FRACTION:
            if (a(i))
                c = t + 1;
            else {
                if (!s(i))
                    break e;
                u = P.EXP;
            }
            break;
        case P.EXP:
            if ("+" === i || "-" === i)
                u = P.EXP_DIGIT_OR_SIGN;
            else {
                if (!a(i))
                    break e;
                c = t + 1, u = P.EXP_DIGIT_OR_SIGN;
            }
            break;
        case P.EXP_DIGIT_OR_SIGN:
            if (!a(i))
                break e;
            c = t + 1;
    }
    t++;
} return c > 0 ? { type: I.NUMBER, line: n, column: r + c - o, index: c, value: parseFloat(e.substring(o, c)) } : null; } function d(e, t) { for (var n = 1, r = 1, o = 0, l = []; o < e.length;) {
    var a = [e, o, n, r], c = u.apply(void 0, a);
    if (c)
        o = c.index, n = c.line, r = c.column;
    else {
        var s = i.apply(void 0, a) || f.apply(void 0, a) || p.apply(void 0, a) || T.apply(void 0, a);
        if (s) {
            var d = { type: s.type, value: s.value, loc: b(n, r, o, s.line, s.column, s.index, t.source) };
            l.push(d), o = s.index, n = s.line, r = s.column;
        }
        else
            m(C.cannotTokenizeSymbol(e.charAt(o), n, r), e, n, r);
    }
} return l; } function v(e, t, n, r) { for (var o = void 0, l = { type: "object", children: [] }, a = w._START_; n < t.length;) {
    var c = t[n];
    switch (a) {
        case w._START_:
            if (c.type !== I.LEFT_BRACE)
                return null;
            o = c, a = w.OPEN_OBJECT, n++;
            break;
        case w.OPEN_OBJECT:
            if (c.type === I.RIGHT_BRACE) {
                if (r.verbose)
                    return l.loc = b(o.loc.start.line, o.loc.start.column, o.loc.start.offset, c.loc.end.line, c.loc.end.column, c.loc.end.offset, r.source), { value: l, index: n + 1 };
            }
            else {
                var s = E(e, t, n, r);
                l.children.push(s.value), a = w.PROPERTY, n = s.index;
            }
            break;
        case w.PROPERTY:
            if (c.type === I.RIGHT_BRACE)
                return r.verbose && (l.loc = b(o.loc.start.line, o.loc.start.column, o.loc.start.offset, c.loc.end.line, c.loc.end.column, c.loc.end.offset, r.source)), { value: l, index: n + 1 };
            c.type === I.COMMA ? (a = w.COMMA, n++) : m(h.unexpectedToken(e.substring(c.loc.start.offset, c.loc.end.offset), c.loc.start.line, c.loc.start.column), e, c.loc.start.line, c.loc.start.column);
            break;
        case w.COMMA:
            var u = E(e, t, n, r);
            u ? (n = u.index, l.children.push(u.value), a = w.PROPERTY) : m(h.unexpectedToken(e.substring(c.loc.start.offset, c.loc.end.offset), c.loc.start.line, c.loc.start.column), e, c.loc.start.line, c.loc.start.column);
    }
} m(h.unexpectedEnd()); } function E(e, t, n, r) { for (var o = void 0, l = { type: "property", key: null, value: null }, a = w._START_; n < t.length;) {
    var c = t[n];
    switch (a) {
        case L._START_:
            if (c.type !== I.STRING)
                return null;
            var s = { type: "identifier", value: c.value };
            r.verbose && (s.loc = c.loc), o = c, l.key = s, a = L.KEY, n++;
            break;
        case L.KEY:
            c.type === I.COLON ? (a = L.COLON, n++) : m(h.unexpectedToken(e.substring(c.loc.start.offset, c.loc.end.offset), c.loc.start.line, c.loc.start.column), e, c.loc.start.line, c.loc.start.column);
            break;
        case L.COLON:
            var u = O(e, t, n, r);
            return l.value = u.value, r.verbose && (l.loc = b(o.loc.start.line, o.loc.start.column, o.loc.start.offset, u.value.loc.end.line, u.value.loc.end.column, u.value.loc.end.offset, r.source)), { value: l, index: u.index };
    }
} } function R(e, t, n, r) { for (var o = void 0, l = { type: "array", children: [] }, a = M._START_, c = void 0; n < t.length;)
    switch (c = t[n], a) {
        case M._START_:
            if (c.type !== I.LEFT_BRACKET)
                return null;
            o = c, a = M.OPEN_ARRAY, n++;
            break;
        case M.OPEN_ARRAY:
            if (c.type === I.RIGHT_BRACKET)
                return r.verbose && (l.loc = b(o.loc.start.line, o.loc.start.column, o.loc.start.offset, c.loc.end.line, c.loc.end.column, c.loc.end.offset, r.source)), { value: l, index: n + 1 };
            var s = O(e, t, n, r);
            n = s.index, l.children.push(s.value), a = M.VALUE;
            break;
        case M.VALUE:
            if (c.type === I.RIGHT_BRACKET)
                return r.verbose && (l.loc = b(o.loc.start.line, o.loc.start.column, o.loc.start.offset, c.loc.end.line, c.loc.end.column, c.loc.end.offset, r.source)), n++, { value: l, index: n };
            c.type === I.COMMA ? (a = M.COMMA, n++) : m(h.unexpectedToken(e.substring(c.loc.start.offset, c.loc.end.offset), c.loc.start.line, c.loc.start.column), e, c.loc.start.line, c.loc.start.column);
            break;
        case M.COMMA:
            var u = O(e, t, n, r);
            n = u.index, l.children.push(u.value), a = M.VALUE;
    } m(h.unexpectedEnd()); } function _(e, t, n, r) { var o = t[n]; if (-1 !== g.indexOf(o.type)) {
    var l = { type: "literal", value: o.value, rawValue: e.substring(o.loc.start.offset, o.loc.end.offset) };
    return r.verbose && (l.loc = o.loc), { value: l, index: n + 1 };
} return null; } function O(e, t, n, r) { var o = t[n], l = _.apply(void 0, arguments) || v.apply(void 0, arguments) || R.apply(void 0, arguments); if (l)
    return l; m(h.unexpectedToken(e.substring(o.loc.start.offset, o.loc.end.offset), o.loc.start.line, o.loc.start.column), e, o.loc.start.line, o.loc.start.column); } var y = Object.assign || function (e) { for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n)
        Object.prototype.hasOwnProperty.call(n, r) && (e[r] = n[r]);
} return e; }, b = function (e, t, n, r, o, l, a) { return { start: { line: e, column: t, offset: n }, end: { line: r, column: o, offset: l }, source: a || null }; }, A = function (e) { function l(e, r, a, c) { t(this, l); var s = a ? e + "\n" + o(r, a, c) : e, u = n(this, (l.__proto__ || Object.getPrototypeOf(l)).call(this, s)); return u.rawMessage = e, u; } return r(l, e), l; }(SyntaxError), m = function (e, t, n, r) { throw new A(e, t, n, r); }, h = { unexpectedEnd: function () { return "Unexpected end of JSON input"; }, unexpectedToken: function (e, t, n) { return "Unexpected token <" + e + "> at " + t + ":" + n; } }, C = { cannotTokenizeSymbol: function (e, t, n) { return "Cannot tokenize symbol <" + e + "> at " + t + ":" + n; } }, I = { LEFT_BRACE: 0, RIGHT_BRACE: 1, LEFT_BRACKET: 2, RIGHT_BRACKET: 3, COLON: 4, COMMA: 5, STRING: 6, NUMBER: 7, TRUE: 8, FALSE: 9, NULL: 10 }, x = { "{": I.LEFT_BRACE, "}": I.RIGHT_BRACE, "[": I.LEFT_BRACKET, "]": I.RIGHT_BRACKET, ":": I.COLON, ",": I.COMMA }, S = { true: { type: I.TRUE, value: !0 }, false: { type: I.FALSE, value: !1 }, null: { type: I.NULL, value: null } }, N = { _START_: 0, START_QUOTE_OR_CHAR: 1, ESCAPE: 2 }, k = { '"': 0, "\\": 1, "/": 2, b: 3, f: 4, n: 5, r: 6, t: 7, u: 8 }, P = { _START_: 0, MINUS: 1, ZERO: 2, DIGIT: 3, POINT: 4, DIGIT_FRACTION: 5, EXP: 6, EXP_DIGIT_OR_SIGN: 7 }, g = [I.STRING, I.NUMBER, I.TRUE, I.FALSE, I.NULL], w = { _START_: 0, OPEN_OBJECT: 1, PROPERTY: 2, COMMA: 3 }, L = { _START_: 0, KEY: 1, COLON: 2 }, M = { _START_: 0, OPEN_ARRAY: 1, VALUE: 2, COMMA: 3 }, B = { verbose: !0, source: null }, G = function (e, t) { var n = d(e, t = y({}, B, t)); 0 === n.length && m(h.unexpectedEnd()); var r = O(e, n, 0, t); if (r.index === n.length)
    return r.value; var o = n[r.index]; m(h.unexpectedToken(e.substring(o.loc.start.offset, o.loc.end.offset), o.loc.start.line, o.loc.start.column), e, o.loc.start.line, o.loc.start.column); }; e.exports = G; }); });
const createError = parserCreateError;
var parserJson = parse;
module.exports = parserJson;
//# sourceMappingURL=parser-json.js.map