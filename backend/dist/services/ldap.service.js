"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ldapService = void 0;
const ldapjs_1 = __importDefault(require("ldapjs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class LDAPService {
    config;
    constructor() {
        this.config = {
            url: process.env.LDAP_URL || 'ldap://localhost:389',
            bindDN: process.env.LDAP_BIND_DN || '',
            bindPassword: process.env.LDAP_BIND_PASSWORD || '',
            baseDN: process.env.LDAP_BASE_DN || 'DC=company,DC=local',
            userSearchBase: process.env.LDAP_USER_SEARCH_BASE || 'OU=Users,DC=company,DC=local',
            userSearchFilter: process.env.LDAP_USER_SEARCH_FILTER || '(sAMAccountName={{username}})',
        };
    }
    createClient() {
        const client = ldapjs_1.default.createClient({
            url: this.config.url,
            tlsOptions: { rejectUnauthorized: false },
            timeout: 5000,
            connectTimeout: 10000,
        });
        client.on('error', (err) => {
            console.error('LDAP Client Error:', err);
        });
        return client;
    }
    async authenticate(username, password) {
        return new Promise((resolve, reject) => {
            const client = this.createClient();
            // First, bind with service account to search for user
            client.bind(this.config.bindDN, this.config.bindPassword, (err) => {
                if (err) {
                    console.error('LDAP bind error:', err);
                    client.unbind();
                    return resolve(null);
                }
                // Search for user
                const searchFilter = this.config.userSearchFilter.replace('{{username}}', username);
                const searchOptions = {
                    filter: searchFilter,
                    scope: 'sub',
                    attributes: ['dn', 'sAMAccountName', 'mail', 'displayName', 'cn', 'department', 'memberOf'],
                };
                client.search(this.config.userSearchBase, searchOptions, (err, res) => {
                    if (err) {
                        console.error('LDAP search error:', err);
                        client.unbind();
                        return resolve(null);
                    }
                    let userDN = null;
                    let userAttributes = {};
                    res.on('searchEntry', (entry) => {
                        userDN = entry.objectName;
                        userAttributes = entry.object;
                    });
                    res.on('error', (err) => {
                        console.error('LDAP search result error:', err);
                        client.unbind();
                        resolve(null);
                    });
                    res.on('end', () => {
                        if (!userDN) {
                            console.log('User not found in LDAP:', username);
                            client.unbind();
                            return resolve(null);
                        }
                        // Now authenticate with user's credentials
                        const userClient = this.createClient();
                        userClient.bind(userDN, password, (err) => {
                            if (err) {
                                console.error('LDAP user authentication failed:', err);
                                userClient.unbind();
                                client.unbind();
                                return resolve(null);
                            }
                            // Authentication successful
                            const ldapUser = {
                                dn: userDN,
                                username: userAttributes.sAMAccountName || username,
                                email: userAttributes.mail || `${username}@company.local`,
                                fullName: userAttributes.displayName || userAttributes.cn || username,
                                department: userAttributes.department,
                                memberOf: Array.isArray(userAttributes.memberOf)
                                    ? userAttributes.memberOf
                                    : userAttributes.memberOf ? [userAttributes.memberOf] : [],
                            };
                            userClient.unbind();
                            client.unbind();
                            resolve(ldapUser);
                        });
                    });
                });
            });
        });
    }
    async searchUser(username) {
        return new Promise((resolve, reject) => {
            const client = this.createClient();
            client.bind(this.config.bindDN, this.config.bindPassword, (err) => {
                if (err) {
                    console.error('LDAP bind error:', err);
                    client.unbind();
                    return resolve(null);
                }
                const searchFilter = this.config.userSearchFilter.replace('{{username}}', username);
                const searchOptions = {
                    filter: searchFilter,
                    scope: 'sub',
                    attributes: ['dn', 'sAMAccountName', 'mail', 'displayName', 'cn', 'department', 'memberOf'],
                };
                client.search(this.config.userSearchBase, searchOptions, (err, res) => {
                    if (err) {
                        console.error('LDAP search error:', err);
                        client.unbind();
                        return resolve(null);
                    }
                    let userFound = false;
                    res.on('searchEntry', (entry) => {
                        userFound = true;
                        const attrs = entry.object;
                        const ldapUser = {
                            dn: entry.objectName,
                            username: attrs.sAMAccountName || username,
                            email: attrs.mail || `${username}@company.local`,
                            fullName: attrs.displayName || attrs.cn || username,
                            department: attrs.department,
                            memberOf: Array.isArray(attrs.memberOf)
                                ? attrs.memberOf
                                : attrs.memberOf ? [attrs.memberOf] : [],
                        };
                        resolve(ldapUser);
                    });
                    res.on('error', (err) => {
                        console.error('LDAP search result error:', err);
                        client.unbind();
                        resolve(null);
                    });
                    res.on('end', () => {
                        if (!userFound) {
                            resolve(null);
                        }
                        client.unbind();
                    });
                });
            });
        });
    }
    async testConnection() {
        return new Promise((resolve) => {
            const client = this.createClient();
            client.bind(this.config.bindDN, this.config.bindPassword, (err) => {
                if (err) {
                    console.error('❌ LDAP connection test failed:', err.message);
                    client.unbind();
                    resolve(false);
                }
                else {
                    console.log('✅ LDAP connection test successful');
                    client.unbind();
                    resolve(true);
                }
            });
        });
    }
    // Map AD groups to application roles
    mapGroupsToRole(memberOf) {
        // Example group to role mapping
        const roleMapping = {
            'CN=SecurityCEO,OU=Groups,DC=company,DC=local': 'ceo',
            'CN=SecurityCISO,OU=Groups,DC=company,DC=local': 'ciso',
            'CN=SOCAnalysts,OU=Groups,DC=company,DC=local': 'soc_analyst',
            'CN=SecurityAuditors,OU=Groups,DC=company,DC=local': 'auditor',
            'CN=SecurityAdmins,OU=Groups,DC=company,DC=local': 'admin',
        };
        for (const group of memberOf) {
            if (roleMapping[group]) {
                return roleMapping[group];
            }
        }
        // Default role if no mapping found
        return 'soc_analyst';
    }
}
exports.ldapService = new LDAPService();
//# sourceMappingURL=ldap.service.js.map