"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = __importDefault(require("react"));
var hair_1 = __importDefault(require("../hair"));
var face_1 = __importDefault(require("../face"));
var facialHair_1 = __importDefault(require("../facialHair"));
var accessories_1 = __importDefault(require("../accessories"));
var index = function (_a) {
    var hairPiece = _a.hairPiece, facePiece = _a.facePiece, facialHairPiece = _a.facialHairPiece, accessoryPiece = _a.accessoryPiece, strokeColor = _a.strokeColor, backgroundColor = _a.backgroundColor;
    return (react_1.default.createElement("g", { transform: 'translate(225 0)' },
        react_1.default.createElement("g", null, hairPiece &&
            react_1.default.createElement(hair_1.default, {
                piece: hairPiece,
                strokeColor: strokeColor,
                backgroundColor: backgroundColor
            })),
        react_1.default.createElement("g", { transform: 'translate(159 186)' }, facePiece &&
            react_1.default.createElement(face_1.default, {
                piece: facePiece,
                strokeColor: strokeColor,
                backgroundColor: backgroundColor
            })),
        react_1.default.createElement("g", { transform: 'translate(123 338)' }, facialHairPiece &&
            react_1.default.createElement(facialHair_1.default, {
                piece: facialHairPiece,
                strokeColor: strokeColor,
                backgroundColor: backgroundColor
            })),
        react_1.default.createElement("g", { transform: 'translate(47 241)' }, accessoryPiece &&
            react_1.default.createElement(accessories_1.default, {
                piece: accessoryPiece,
                strokeColor: strokeColor,
                backgroundColor: backgroundColor
            }))));
};
exports.default = index;
//# sourceMappingURL=index.js.map