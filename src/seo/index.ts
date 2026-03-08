// Server exports
export {generateMapSEO} from './server/index';
export {generateJsonLd} from './server/json-ld-generator';
export {generateNoscriptHtml} from './server/noscript-generator';
export {generateMetaTags} from './server/meta-tags-generator';
export {buildStaticImageUrl} from './server/static-image-url';

// Shared exports
export {getPreset, ALL_PRESETS} from './shared/schema-presets';
export {detectAICrawler} from './analytics/crawler-detector';

// Type exports
export type {
    SeoConfig,
    SourceConfig,
    GenerateMapSEOInput,
    GenerateMapSEOResult,
    SeoStats,
    PresetType,
    AeoConfig,
    PrivacyConfig,
    ProvenanceConfig,
    StaticImageConfig,
} from './shared/types';
