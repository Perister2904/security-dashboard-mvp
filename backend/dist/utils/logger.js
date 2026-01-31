"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
function createLogger(service) {
    return winston_1.default.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json()),
        defaultMeta: { service },
        transports: [
            new winston_1.default.transports.File({
                filename: path_1.default.join(logsDir, 'error.log'),
                level: 'error',
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 7,
            }),
            new winston_1.default.transports.File({
                filename: path_1.default.join(logsDir, 'combined.log'),
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 7,
            }),
        ],
    });
}
// Default logger instance
const logger = createLogger('app');
// Console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }));
}
exports.default = logger;
//# sourceMappingURL=logger.js.map