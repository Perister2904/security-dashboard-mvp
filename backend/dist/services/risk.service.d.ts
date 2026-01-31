interface RiskFilters {
    status?: string;
    priority?: string;
}
export declare const riskService: {
    getRisks(filters: RiskFilters): Promise<any[]>;
    getRiskById(id: string): Promise<any | null>;
    createRisk(riskData: any, userId: string): Promise<any>;
    updateRisk(id: string, updates: any): Promise<any>;
    deleteRisk(id: string): Promise<void>;
};
export {};
//# sourceMappingURL=risk.service.d.ts.map