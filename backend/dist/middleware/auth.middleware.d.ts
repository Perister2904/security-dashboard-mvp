import { Request, Response, NextFunction } from 'express';
import { TokenPayload } from '../services/auth.service';
export interface AuthRequest extends Request {
    user?: TokenPayload;
    headers: any;
    query: any;
    params: any;
    body: any;
}
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function authorize(...allowedRoles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map