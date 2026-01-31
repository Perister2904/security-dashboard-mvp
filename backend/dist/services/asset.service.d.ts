interface AssetFilters {
    department?: string;
    criticality?: string;
    page?: number;
    limit?: number;
}
export declare const assetService: {
    getAssets(filters: AssetFilters): Promise<{
        assets: any[];
        total: number;
        page: number;
        limit: number;
    }>;
    getAssetById(id: string): Promise<any | null>;
    getCoverageStats(): Promise<any>;
    getRiskPosture(): Promise<any>;
    getCoverageGaps(): Promise<any[]>;
    updateAsset(id: string, updates: any): Promise<any>;
};
export {};
//# sourceMappingURL=asset.service.d.ts.map