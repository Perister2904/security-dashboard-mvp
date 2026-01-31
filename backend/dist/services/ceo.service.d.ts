export declare const ceoService: {
    getExecutiveSummary(): Promise<any>;
    getFinancialImpact(days?: number): Promise<any>;
    getTopRisks(limit?: number): Promise<any[]>;
    getCompliancePosture(): Promise<any>;
    sendExecutiveReport(email: string, reportType: string): Promise<void>;
};
//# sourceMappingURL=ceo.service.d.ts.map