import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { ldapService } from './ldap.service';
import { cacheSet, cacheGet, cacheDel } from '../config/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change_this_refresh_secret';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  department: string | null;
  role: string;
  isActive: boolean;
  isADUser: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
}

class AuthService {
  async register(userData: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    department?: string;
  }): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [userData.email, userData.email.split('@')[0]]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      // Generate username from email
      const username = userData.email.split('@')[0];

      // Insert user
      const result = await query(
        `INSERT INTO users (email, username, password_hash, full_name, department, role, is_active, is_ad_user)
         VALUES ($1, $2, $3, $4, $5, $6, true, false)
         RETURNING *`,
        [
          userData.email,
          username,
          passwordHash,
          userData.fullName,
          userData.department || null,
          userData.role,
        ]
      );

      return this.mapUserFromDB(result.rows[0]);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(username: string, password: string, ipAddress?: string): Promise<{ user: User; tokens: AuthTokens } | null> {
    try {
      // Check if user is locked
      const lockCheck = await query(
        'SELECT locked_until FROM users WHERE username = $1',
        [username]
      );

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
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Cache user session
      await cacheSet(`user:${user.id}`, user, 900); // 15 minutes

      // Log successful login
      await this.logAudit({
        userId: user.id,
        username: user.username,
        action: 'login',
        ipAddress,
        success: true,
      });

      return { user, tokens };
    } catch (error) {
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

  private async authenticateWithLDAP(username: string, password: string): Promise<User | null> {
    try {
      const ldapUser = await ldapService.authenticate(username, password);
      if (!ldapUser) return null;

      // Check if user exists in local database
      let userResult = await query(
        'SELECT * FROM users WHERE username = $1',
        [ldapUser.username]
      );

      let user: User;

      if (userResult.rows.length === 0) {
        // Create new user from LDAP
        const role = ldapService.mapGroupsToRole(ldapUser.memberOf || []);
        
        const insertResult = await query(
          `INSERT INTO users (email, username, full_name, department, role, is_active, is_ad_user, ad_dn)
           VALUES ($1, $2, $3, $4, $5, true, true, $6)
           RETURNING *`,
          [ldapUser.email, ldapUser.username, ldapUser.fullName, ldapUser.department, role, ldapUser.dn]
        );

        user = this.mapUserFromDB(insertResult.rows[0]);
      } else {
        // Update existing user
        await query(
          `UPDATE users 
           SET email = $1, full_name = $2, department = $3, ad_dn = $4, is_active = true
           WHERE username = $5`,
          [ldapUser.email, ldapUser.fullName, ldapUser.department, ldapUser.dn, ldapUser.username]
        );

        user = this.mapUserFromDB(userResult.rows[0]);
      }

      return user;
    } catch (error) {
      console.error('LDAP authentication error:', error);
      return null;
    }
  }

  private async authenticateLocal(username: string, password: string): Promise<User | null> {
    const result = await query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true AND is_ad_user = false',
      [username]
    );

    if (result.rows.length === 0) return null;

    const userRow = result.rows[0];
    
    // Verify password
    const isValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isValid) return null;

    return this.mapUserFromDB(userRow);
  }

  private mapUserFromDB(row: any): User {
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

  private generateTokens(user: User): AuthTokens {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;

      // Get user from database
      const result = await query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [payload.userId]
      );

      if (result.rows.length === 0) return null;

      const user = this.mapUserFromDB(result.rows[0]);
      return this.generateTokens(user);
    } catch (error) {
      console.error('Refresh token error:', error);
      return null;
    }
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      
      // Check cache first
      const cachedUser = await cacheGet<User>(`user:${payload.userId}`);
      if (cachedUser && cachedUser.isActive) {
        return payload;
      }

      // Verify user is still active
      const result = await query(
        'SELECT is_active FROM users WHERE id = $1',
        [payload.userId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  async logout(userId: string): Promise<void> {
    // Remove user from cache
    await cacheDel(`user:${userId}`);
    
    // Log logout
    await this.logAudit({
      userId,
      username: 'unknown',
      action: 'logout',
      success: true,
    });
  }

  private async incrementLoginAttempts(username: string): Promise<void> {
    const result = await query(
      `UPDATE users 
       SET login_attempts = login_attempts + 1
       WHERE username = $1
       RETURNING login_attempts`,
      [username]
    );

    if (result.rows.length > 0 && result.rows[0].login_attempts >= 5) {
      // Lock account for 15 minutes
      await query(
        `UPDATE users 
         SET locked_until = NOW() + INTERVAL '15 minutes'
         WHERE username = $1`,
        [username]
      );
    }
  }

  private async resetLoginAttempts(userId: string): Promise<void> {
    await query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1',
      [userId]
    );
  }

  private async logAudit(data: {
    userId: string | null;
    username: string;
    action: string;
    ipAddress?: string;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO audit_logs (user_id, username, action, ip_address, success, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.userId, data.username, data.action, data.ipAddress, data.success, data.errorMessage || null]
    );
  }

  async createUser(userData: {
    email: string;
    username: string;
    password: string;
    fullName: string;
    department?: string;
    role: string;
  }): Promise<User> {
    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 10);

    const result = await query(
      `INSERT INTO users (email, username, password_hash, full_name, department, role, is_active, is_ad_user)
       VALUES ($1, $2, $3, $4, $5, $6, true, false)
       RETURNING *`,
      [
        userData.email,
        userData.username,
        passwordHash,
        userData.fullName,
        userData.department || null,
        userData.role,
      ]
    );

    return this.mapUserFromDB(result.rows[0]);
  }

  async getUserById(userId: string): Promise<User | null> {
    // Check cache first
    const cached = await cacheGet<User>(`user:${userId}`);
    if (cached) return cached;

    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) return null;

    const user = this.mapUserFromDB(result.rows[0]);
    
    // Cache for 15 minutes
    await cacheSet(`user:${userId}`, user, 900);
    
    return user;
  }

  hasRole(userRole: string, allowedRoles: string[]): boolean {
    return allowedRoles.includes(userRole);
  }
}

export const authService = new AuthService();
