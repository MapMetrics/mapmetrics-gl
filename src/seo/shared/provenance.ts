import type {ProvenanceConfig} from './types';

const LICENSE_URLS: Record<string, string> = {
    'odbl': 'https://opendatacommons.org/licenses/odbl/',
    'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
    'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

function resolveLicense(license: string): string {
    const key = license.toLowerCase();
    return LICENSE_URLS[key] ?? license;
}

function currentDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function generateProvenanceSchema(
    config: Partial<ProvenanceConfig>,
    areaName: string
): Record<string, unknown> {
    const schema: Record<string, unknown> = {
        '@type': 'Dataset',
        'dateModified': config.updated ?? currentDate(),
    };

    if (areaName) {
        schema['spatialCoverage'] = {
            '@type': 'Place',
            'name': areaName,
        };
    }

    if (config.source) {
        schema['provider'] = {
            '@type': 'Organization',
            'name': config.source,
        };
    }

    if (config.organization) {
        schema['creator'] = {
            '@type': 'Organization',
            'name': config.organization,
        };
    }

    if (config.license) {
        schema['license'] = resolveLicense(config.license);
    }

    return schema;
}
