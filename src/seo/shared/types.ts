import type {Feature, FeatureCollection} from 'geojson';

// --- Preset types ---
export type PointPreset = 'restaurant' | 'hotel' | 'store' | 'parking' | 'poi' | 'property' | 'ev-charger';
export type LinePreset = 'route' | 'cycling' | 'transit' | 'trail';
export type PolygonPreset = 'serviceArea' | 'neighborhood' | 'zone' | 'coverage';
export type PresetType = PointPreset | LinePreset | PolygonPreset;

// --- Config types ---
export type SeoConfig = {
    enabled: boolean;
    autoMetadata?: boolean;
    indexSources?: string[];
    featureLimit?: number;
    propertyMap?: Record<string, SourcePropertyMap>;
    staticImage?: boolean | StaticImageConfig;
    altText?: string;
    aeo?: AeoConfig;
    privacy?: PrivacyConfig;
    provenance?: ProvenanceConfig;
    trustLevel?: 'basic' | 'verified';
    skipIfVisibleInDOM?: boolean;
    clusterSummary?: boolean;
    clusterBy?: 'spatial' | 'property';
    provider?: ProviderConfig | false;
};

export type SourcePropertyMap = {
    nameProperty?: string;
    addressProperty?: string;
    categoryProperty?: string;
    ratingProperty?: string;
    ratingCountProperty?: string;
    schemaType?: PresetType;
};

export type SourceConfig = {
    id: string;
    schemaType?: PresetType;
    featureLimit?: number;
    propertyMap?: Record<string, string>;
};

export type AeoConfig = {
    generateFAQ?: boolean;
    generateSummary?: boolean;
    questionTemplates?: Record<string, string[]>;
};

export interface PrivacyConfig {
    excludeProperties?: string[];
    excludeFeatures?: (feature: Feature) => boolean;
    roundCoordinates?: number;
}

export type ProvenanceConfig = {
    source?: string;
    license?: string;
    organization?: string;
    updated?: string;
};

export type StaticImageConfig = {
    enabled?: boolean;
    width?: number;
    height?: number;
    style?: string;
    apiKey?: string;
    baseUrl?: string;
};

export type ProviderConfig = {
    name: string;
};

// --- Server input/output ---
export type GenerateMapSEOInput = {
    geojson: FeatureCollection | Record<string, FeatureCollection>;
    center: [number, number];
    bounds: [[number, number], [number, number]];
    zoom?: number;
    area?: string;
    sources: SourceConfig[];
    options?: GenerateMapSEOOptions;
};

export type GenerateMapSEOOptions = {
    generateFAQ?: boolean;
    generateSummary?: boolean;
    staticImage?: StaticImageConfig;
    provenance?: ProvenanceConfig;
    privacy?: PrivacyConfig;
    trustLevel?: 'basic' | 'verified';
    provider?: ProviderConfig | false;
    featureLimit?: number;
    clusterSummary?: boolean;
    clusterBy?: 'spatial' | 'property';
};

export type GenerateMapSEOResult = {
    jsonLd: string;
    noscriptHtml: string;
    metaTags: string;
    staticImageUrl: string | null;
    schema: Record<string, unknown>;
    stats: SeoStats;
};

export type SeoStats = {
    featuresIndexed: number;
    routesIndexed: number;
    zonesIndexed: number;
    estimatedHtmlSize: string;
    schemaTypes: string[];
};

// --- Schema preset definition ---
export interface SchemaPreset {
    schemaType: string;
    geometryTypes: string[];
    propertyMappings: Record<string, string>;
    requiredProperties: string[];
    trustGated: string[];
    postProcess?: (schema: Record<string, unknown>, feature: Feature) => Record<string, unknown>;
}
