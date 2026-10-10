"use strict";
// 深色毛衣族的无花纹变体。原件不动。花纹是黑色 evenodd 路径里的镂空，白底从洞里露出来。
// 只删这些洞。外轮廓、手、袖口留在第一条子路径里；Paper 手里的纸和手是较大的洞，留下。
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var SweaterDots_1 = require("./SweaterDots");
var PointingUp_1 = require("./PointingUp");
var Paper_1 = require("./Paper");

function subpaths(d) {
    return String(d).split(/(?=[Mm])/).filter(function (part) { return part.trim(); });
}

function bbox(d) {
    var nums = String(d).match(/-?\d*\.?\d+/g);
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; nums && i + 1 < nums.length; i += 2) {
        var x = Number(nums[i]);
        var y = Number(nums[i + 1]);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return {w: maxX - minX, h: maxY - minY};
}

function withoutPattern(d, dropHole) {
    var parts = subpaths(d);
    if (parts.length < 2) return d;
    var kept = [parts[0]];
    for (var i = 1; i < parts.length; i += 1) {
        if (!dropHole(bbox(parts[i]))) kept.push(parts[i]);
    }
    return kept.join("");
}

function rewrite(node, ink, dropHole) {
    if (Array.isArray(node)) {
        return node.map(function (child, index) {
            var next = rewrite(child, ink, dropHole);
            if (react_1.default.isValidElement(next) && next.key == null) return react_1.default.cloneElement(next, {key: String(index)});
            return next;
        });
    }
    if (!node || typeof node !== "object" || !node.props) return node;
    var children = node.props.children == null ? null : rewrite(node.props.children, ink, dropHole);
    var nextProps = null;
    if (node.type === "path" && node.props.fill === ink && node.props.fillRule === "evenodd" && typeof node.props.d === "string") {
        nextProps = {d: withoutPattern(node.props.d, dropHole)};
    }
    if (!nextProps && children === node.props.children) return node;
    if (children == null) return react_1.default.cloneElement(node, nextProps || {});
    return react_1.default.cloneElement(node, nextProps || {}, children);
}

function plain(Component, dropHole) {
    return function (props) {
        var ink = props.strokeColor || "#000000";
        return rewrite(Component(props), ink, dropHole);
    };
}

var dropAllHoles = function () { return true; };
// 纸和手的短边都不小于 80。毛衣上的点、短线短边更小。
var dropPaperPrint = function (box) { return Math.min(box.w, box.h) < 80; };

exports.SweaterDotsPlain = plain(SweaterDots_1.SweaterDots, dropAllHoles);
exports.PointingUpPlain = plain(PointingUp_1.PointingUp, dropAllHoles);
exports.PaperPlain = plain(Paper_1.Paper, dropPaperPrint);
