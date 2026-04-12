import path from 'path';
import { WazuhConnector } from '../connectors/wazuh.connector';

export const wazuhSyncService = {
  async syncSampleTelemetry() {
    const connector = new WazuhConnector({
      id: 'local-wazuh-sample',
      name: 'wazuh_local_sample',
      type: 'siem',
      baseUrl: process.env.WAZUH_API_URL || 'http://localhost:55000',
      enabled: true,
      syncInterval: 5,
      config: {
        sample_mode: true,
        sample_file_path:
          process.env.WAZUH_SAMPLE_FILE ||
          path.join(process.cwd(), 'sample-data', 'wazuh', 'alerts.ndjson'),
      },
    });

    return connector.syncAssets();
  },
};
