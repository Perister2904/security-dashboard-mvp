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
declare class AuthService {
    register(userData: {
        email: string;
        password: string;
        fullName: string;
        role: string;
        department?: string;
    }): Promise<User>;
    login(username: string, password: string, ipAddress?: string): Promise<{
        user: User;
        tokens: AuthTokens;
    } | null>;
    private authenticateWithLDAP;
    private authenticateLocal;
    private mapUserFromDB;
    private generateTokens;
    refreshToken(refreshToken: string): Promise<AuthTokens | null>;
    verifyToken(token: string): Promise<TokenPayload | null>;
    logout(userId: string): Promise<void>;
    private incrementLoginAttempts;
    private resetLoginAttempts;
    private logAudit;
    createUser(userData: {
        email: string;
        username: string;
        password: string;
        fullName: string;
        department?: string;
        role: string;
    }): Promise<User>;
    getUserById(userId: string): Promise<User | null>;
    hasRole(userRole: string, allowedRoles: string[]): boolean;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=auth.service.d.ts.map