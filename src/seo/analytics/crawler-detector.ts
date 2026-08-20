type CrawlerResult = {
    isBot: boolean;
    botName?: string;
    type?: 'training' | 'search';
};

const AI_CRAWLERS: Array<{pattern: string; name: string; type: 'training' | 'search'}> = [
    {pattern: 'GPTBot', name: 'GPTBot', type: 'training'},
    {pattern: 'OAI-SearchBot', name: 'OAI-SearchBot', type: 'search'},
    {pattern: 'ChatGPT-User', name: 'ChatGPT-User', type: 'search'},
    {pattern: 'ClaudeBot', name: 'ClaudeBot', type: 'training'},
    {pattern: 'PerplexityBot', name: 'PerplexityBot', type: 'search'},
    {pattern: 'Meta-ExternalAgent', name: 'Meta-ExternalAgent', type: 'training'},
    {pattern: 'Bytespider', name: 'Bytespider', type: 'training'},
    {pattern: 'Applebot', name: 'Applebot', type: 'search'},
    {pattern: 'Google-Extended', name: 'Google-Extended', type: 'training'},
];

/**
 * Detects whether a user-agent string belongs to a known AI crawler.
 * Returns bot identity and classification (training vs search).
 */
export function detectAICrawler(userAgent: string): CrawlerResult {
    for (const crawler of AI_CRAWLERS) {
        if (userAgent.includes(crawler.pattern)) {
            return {isBot: true, botName: crawler.name, type: crawler.type};
        }
    }
    return {isBot: false};
}
