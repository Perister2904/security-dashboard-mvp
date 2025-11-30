import ldap from 'ldapjs';
import dotenv from 'dotenv';

dotenv.config();

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

class LDAPService {
  private config: LDAPConfig;

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

  private createClient(): ldap.Client {
    const client = ldap.createClient({
      url: this.config.url,
      tlsOptions: { rejectUnauthorized: false },
      timeout: 5000,
      connectTimeout: 10000,
    });

    client.on('error', (err: Error) => {
      console.error('LDAP Client Error:', err);
    });

    return client;
  }

  async authenticate(username: string, password: string): Promise<LDAPUser | null> {
    return new Promise((resolve, reject) => {
      const client = this.createClient();

      // First, bind with service account to search for user
      client.bind(this.config.bindDN, this.config.bindPassword, (err: Error | null) => {
        if (err) {
          console.error('LDAP bind error:', err);
          client.unbind();
          return resolve(null);
        }

        // Search for user
        const searchFilter = this.config.userSearchFilter.replace('{{username}}', username);
        const searchOptions: ldap.SearchOptions = {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['dn', 'sAMAccountName', 'mail', 'displayName', 'cn', 'department', 'memberOf'],
        };

        client.search(this.config.userSearchBase, searchOptions, (err: Error | null, res: ldap.SearchCallbackResponse) => {
          if (err) {
            console.error('LDAP search error:', err);
            client.unbind();
            return resolve(null);
          }

          let userDN: string | null = null;
          let userAttributes: any = {};

          res.on('searchEntry', (entry: ldap.SearchEntry) => {
            userDN = entry.objectName!;
            userAttributes = entry.object;
          });

          res.on('error', (err: Error) => {
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
            userClient.bind(userDN, password, (err: Error | null) => {
              if (err) {
                console.error('LDAP user authentication failed:', err);
                userClient.unbind();
                client.unbind();
                return resolve(null);
              }

              // Authentication successful
              const ldapUser: LDAPUser = {
                dn: userDN!,
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

  async searchUser(username: string): Promise<LDAPUser | null> {
    return new Promise((resolve, reject) => {
      const client = this.createClient();

      client.bind(this.config.bindDN, this.config.bindPassword, (err: Error | null) => {
        if (err) {
          console.error('LDAP bind error:', err);
          client.unbind();
          return resolve(null);
        }

        const searchFilter = this.config.userSearchFilter.replace('{{username}}', username);
        const searchOptions: ldap.SearchOptions = {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['dn', 'sAMAccountName', 'mail', 'displayName', 'cn', 'department', 'memberOf'],
        };

        client.search(this.config.userSearchBase, searchOptions, (err: Error | null, res: ldap.SearchCallbackResponse) => {
          if (err) {
            console.error('LDAP search error:', err);
            client.unbind();
            return resolve(null);
          }

          let userFound = false;

          res.on('searchEntry', (entry: ldap.SearchEntry) => {
            userFound = true;
            const attrs = entry.object;
            const ldapUser: LDAPUser = {
              dn: entry.objectName!,
              username: attrs.sAMAccountName as string || username,
              email: attrs.mail as string || `${username}@company.local`,
              fullName: attrs.displayName as string || attrs.cn as string || username,
              department: attrs.department as string,
              memberOf: Array.isArray(attrs.memberOf) 
                ? attrs.memberOf as string[]
                : attrs.memberOf ? [attrs.memberOf as string] : [],
            };
            resolve(ldapUser);
          });

          res.on('error', (err: Error) => {
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

  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const client = this.createClient();

      client.bind(this.config.bindDN, this.config.bindPassword, (err: Error | null) => {
        if (err) {
          console.error('❌ LDAP connection test failed:', err.message);
          client.unbind();
          resolve(false);
        } else {
          console.log('✅ LDAP connection test successful');
          client.unbind();
          resolve(true);
        }
      });
    });
  }

  // Map AD groups to application roles
  mapGroupsToRole(memberOf: string[]): string {
    // Example group to role mapping
    const roleMapping: Record<string, string> = {
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

export const ldapService = new LDAPService();
