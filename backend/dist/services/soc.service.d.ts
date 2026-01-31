interface SOCMetrics {
    activeIncidents: number;
    criticalIncidents: number;
    mttr: number;
    mtd: number;
    mtr: number;
    mtc: number;
    alertVolume: number;
    falsePositiveRate: number;
    coverageScore: number;
    avgSeverity: number;
}
interface IncidentFilters {
    status?: string;
    severity?: string;
    analyst?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
}
export declare const socService: {
    getCurrentMetrics(): Promise<SOCMetrics>;
    getMetricsHistory(days?: number): Promise<any[]>;
    getIncidents(filters: IncidentFilters): Promise<{
        incidents: any[];
        total: number;
        page: number;
        limit: number;
    }>;
    getIncidentById(id: string): Promise<any | null>;
    updateIncident(id: string, updates: any): Promise<any>;
    getRecentEvents(limit?: number): Promise<any[]>;
    getAnalystPerformance(): Promise<any[]>;
    getTasks(incidentId?: string): Promise<any[]>;
};
export {};
//# sourceMappingURL=soc.service.d.ts.map