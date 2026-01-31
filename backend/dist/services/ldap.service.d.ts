export interface LDAPConfig {
    url: string;
    bindDN: string;
    bindPassword: string;
    baseDN: string;
    userSearchBase: string;
    userSearchFilter: string;
}
export interface LDAPUser {
    dn: string;
    username: string;
    email: string;
    fullName: string;
    department?: string;
    memberOf?: string[];
}
declare class LDAPService {
    private config;
    constructor();
    private createClient;
    authenticate(username: string, password: string): Promise<LDAPUser | null>;
    searchUser(username: string): Promise<LDAPUser | null>;
    testConnection(): Promise<boolean>;
    mapGroupsToRole(memberOf: string[]): string;
}
export declare const ldapService: LDAPService;
export {};
//# sourceMappingURL=ldap.service.d.ts.map