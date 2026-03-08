import {describe, it, expect} from 'vitest';
import {detectAICrawler} from '../../analytics/crawler-detector';

describe('detectAICrawler', () => {
    it('detects GPTBot', () => {
        const result = detectAICrawler('Mozilla/5.0 AppleWebKit/537.36 GPTBot/1.0');
        expect(result).toEqual({isBot: true, botName: 'GPTBot', type: 'training'});
    });

    it('detects PerplexityBot as search type', () => {
        const result = detectAICrawler('PerplexityBot/1.0');
        expect(result).toEqual({isBot: true, botName: 'PerplexityBot', type: 'search'});
    });

    it('detects ClaudeBot', () => {
        const result = detectAICrawler('ClaudeBot/1.0');
        expect(result).toEqual({isBot: true, botName: 'ClaudeBot', type: 'training'});
    });

    it('returns isBot false for normal browsers', () => {
        const result = detectAICrawler('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0');
        expect(result).toEqual({isBot: false});
    });

    it('detects all 9 known AI crawlers', () => {
        const agents = [
            'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot',
            'PerplexityBot', 'Meta-ExternalAgent', 'Bytespider',
            'Applebot', 'Google-Extended'
        ];
        for (const agent of agents) {
            expect(detectAICrawler(agent).isBot).toBe(true);
        }
    });
});
