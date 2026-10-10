"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var z_options_1 = require("./z_options");
var index = function (_a) {
    var piece = _a.piece, strokeColor = _a.strokeColor, backgroundColor = _a.backgroundColor;
    return react_1.default.createElement(z_options_1.Accessories[piece], {
        strokeColor: strokeColor,
        backgroundColor: backgroundColor
    });
};
exports.default = index;
//# sourceMappingURL=index.js.map