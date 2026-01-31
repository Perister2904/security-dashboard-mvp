"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = require("../config/database");
const ldap_service_1 = require("./ldap.service");
const redis_1 = require("../config/redis");
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change_this_refresh_secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
class AuthService {
    async register(userData) {
        try {
            // Check if user already exists
            const existingUser = await (0, database_1.query)('SELECT id FROM users WHERE email = $1 OR username = $2', [userData.email, userData.email.split('@')[0]]);
            if (existingUser.rows.length > 0) {
                throw new Error('User with this email already exists');
            }
            // Hash password
            const passwordHash = await bcrypt_1.default.hash(userData.password, 10);
            // Generate username from email
            const username = userData.email.split('@')[0];
            // Insert user
            const result = await (0, database_1.query)(`INSERT INTO users (email, username, password_hash, full_name, department, role, is_active, is_ad_user)
         VALUES ($1, $2, $3, $4, $5, $6, true, false)
         RETURNING *`, [
                userData.email,
                username,
                passwordHash,
                userData.fullName,
                userData.department || null,
                userData.role,
            ]);
            return this.mapUserFromDB(result.rows[0]);
        }
        catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }
    async login(username, password, ipAddress) {
        try {
            // Check if user is locked
            const lockCheck = await (0, database_1.query)('SELECT locked_until FROM users WHERE username = $1', [username]);
            if (lockCheck.rows.length > 0 && lockCheck.rows[0].locked_until) {
                const lockedUntil = new Date(lockCheck.rows[0].locked_until);
                if (lockedUntil > new Date()) {
                    throw new Error(`Account locked until ${lockedUntil.toISOString()}`);
                }
            }
            // Try LDAP authentication first
            let user = await this.authenticateWithLDAP(username, password);
            // If LDAP fails, try local authentication
            if (!user) {
                user = await this.authenticateLocal(username, password);
            }
            if (!user) {
                // Increment login attempts
                await this.incrementLoginAttempts(username);
                return null;
            }
            // Reset login attempts on successful login
            await this.resetLoginAttempts(user.id);
            // Update last login
            await (0, database_1.query)('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
            // Generate tokens
            const tokens = this.generateTokens(user);
            // Cache user session
            await (0, redis_1.cacheSet)(`user:${user.id}`, user, 900); // 15 minutes
            // Log successful login
            await this.logAudit({
                userId: user.id,
                username: user.username,
                action: 'login',
                ipAddress,
                success: true,
            });
            return { user, tokens };
        }
        catch (error) {
            console.error('Login error:', error);
            // Log failed login
            await this.logAudit({
                userId: null,
                username,
                action: 'login',
                ipAddress,
                success: false,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async authenticateWithLDAP(username, password) {
        try {
            const ldapUser = await ldap_service_1.ldapService.authenticate(username, password);
            if (!ldapUser)
                return null;
            // Check if user exists in local database
            let userResult = await (0, database_1.query)('SELECT * FROM users WHERE username = $1', [ldapUser.username]);
            let user;
            if (userResult.rows.length === 0) {
                // Create new user from LDAP
                const role = ldap_service_1.ldapService.mapGroupsToRole(ldapUser.memberOf || []);
                const insertResult = await (0, database_1.query)(`INSERT INTO users (email, username, full_name, department, role, is_active, is_ad_user, ad_dn)
           VALUES ($1, $2, $3, $4, $5, true, true, $6)
           RETURNING *`, [ldapUser.email, ldapUser.username, ldapUser.fullName, ldapUser.department, role, ldapUser.dn]);
                user = this.mapUserFromDB(insertResult.rows[0]);
            }
            else {
                // Update existing user
                await (0, database_1.query)(`UPDATE users 
           SET email = $1, full_name = $2, department = $3, ad_dn = $4, is_active = true
           WHERE username = $5`, [ldapUser.email, ldapUser.fullName, ldapUser.department, ldapUser.dn, ldapUser.username]);
                user = this.mapUserFromDB(userResult.rows[0]);
            }
            return user;
        }
        catch (error) {
            console.error('LDAP authentication error:', error);
            return null;
        }
    }
    async authenticateLocal(username, password) {
        const result = await (0, database_1.query)('SELECT * FROM users WHERE username = $1 AND is_active = true AND is_ad_user = false', [username]);
        if (result.rows.length === 0)
            return null;
        const userRow = result.rows[0];
        // Verify password
        const isValid = await bcrypt_1.default.compare(password, userRow.password_hash);
        if (!isValid)
            return null;
        return this.mapUserFromDB(userRow);
    }
    mapUserFromDB(row) {
        return {
            id: row.id,
            email: row.email,
            username: row.username,
            fullName: row.full_name,
            department: row.department,
            role: row.role,
            isActive: row.is_active,
            isADUser: row.is_ad_user,
        };
    }
    generateTokens(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        return {
            accessToken,
            refreshToken,
            expiresIn: JWT_EXPIRES_IN,
        };
    }
    async refreshToken(refreshToken) {
        try {
            const payload = jsonwebtoken_1.default.verify(refreshToken, JWT_REFRESH_SECRET);
            // Get user from database
            const result = await (0, database_1.query)('SELECT * FROM users WHERE id = $1 AND is_active = true', [payload.userId]);
            if (result.rows.length === 0)
                return null;
            const user = this.mapUserFromDB(result.rows[0]);
            return this.generateTokens(user);
        }
        catch (error) {
            console.error('Refresh token error:', error);
            return null;
        }
    }
    async verifyToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            // Check cache first
            const cachedUser = await (0, redis_1.cacheGet)(`user:${payload.userId}`);
            if (cachedUser && cachedUser.isActive) {
                return payload;
            }
            // Verify user is still active
            const result = await (0, database_1.query)('SELECT is_active FROM users WHERE id = $1', [payload.userId]);
            if (result.rows.length === 0 || !result.rows[0].is_active) {
                return null;
            }
            return payload;
        }
        catch (error) {
            console.error('Token verification error:', error);
            return null;
        }
    }
    async logout(userId) {
        // Remove user from cache
        await (0, redis_1.cacheDel)(`user:${userId}`);
        // Log logout
        await this.logAudit({
            userId,
            username: 'unknown',
            action: 'logout',
            success: true,
        });
    }
    async incrementLoginAttempts(username) {
        const result = await (0, database_1.query)(`UPDATE users 
       SET login_attempts = login_attempts + 1
       WHERE username = $1
       RETURNING login_attempts`, [username]);
        if (result.rows.length > 0 && result.rows[0].login_attempts >= 5) {
            // Lock account for 15 minutes
            await (0, database_1.query)(`UPDATE users 
         SET locked_until = NOW() + INTERVAL '15 minutes'
         WHERE username = $1`, [username]);
        }
    }
    async resetLoginAttempts(userId) {
        await (0, database_1.query)('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1', [userId]);
    }
    async logAudit(data) {
        await (0, database_1.query)(`INSERT INTO audit_logs (user_id, username, action, ip_address, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`, [data.userId, data.username, data.action, data.ipAddress, data.success, data.errorMessage || null]);
    }
    async createUser(userData) {
        // Hash password
        const passwordHash = await bcrypt_1.default.hash(userData.password, 10);
        const result = await (0, database_1.query)(`INSERT INTO users (email, username, password_hash, full_name, department, role, is_active, is_ad_user)
       VALUES ($1, $2, $3, $4, $5, $6, true, false)
       RETURNING *`, [
            userData.email,
            userData.username,
            passwordHash,
            userData.fullName,
            userData.department || null,
            userData.role,
        ]);
        return this.mapUserFromDB(result.rows[0]);
    }
    async getUserById(userId) {
        // Check cache first
        const cached = await (0, redis_1.cacheGet)(`user:${userId}`);
        if (cached)
            return cached;
        const result = await (0, database_1.query)('SELECT * FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0)
            return null;
        const user = this.mapUserFromDB(result.rows[0]);
        // Cache for 15 minutes
        await (0, redis_1.cacheSet)(`user:${userId}`, user, 900);
        return user;
    }
    hasRole(userRole, allowedRoles) {
        return allowedRoles.includes(userRole);
    }
}
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map