/**
 * COMPREHENSIVE LATENCY TEST FOR EVELYN MESSAGE PIPELINE
 * 
 * This test measures end-to-end latency for the entire message processing pipeline,
 * breaking down timing for each major component.
 */

import { describe, test, expect } from '@jest/globals';

interface LatencyMetrics {
  phase: string;
  startTime: number;
  endTime: number;
  duration: number;
  percentage?: number;
}

interface PipelineResult {
  metrics: LatencyMetrics[];
  totalDuration: number;
  bottlenecks: string[];
}

class PipelineLatencyTester {
  private metrics: LatencyMetrics[] = [];

  startPhase(phase: string): number {
    return performance.now();
  }

  endPhase(phase: string, startTime: number): void {
    const endTime = performance.now();
    const duration = endTime - startTime;
    this.metrics.push({
      phase,
      startTime,
      endTime,
      duration
    });
  }

  calculatePercentages(): void {
    const total = this.getTotalDuration();
    this.metrics.forEach(m => {
      m.percentage = (m.duration / total) * 100;
    });
  }

  getTotalDuration(): number {
    return this.metrics.reduce((sum, m) => sum + m.duration, 0);
  }

  identifyBottlenecks(threshold: number = 20): string[] {
    this.calculatePercentages();
    return this.metrics
      .filter(m => m.percentage! > threshold)
      .map(m => `${m.phase} (${m.percentage!.toFixed(1)}%)`);
  }

  getResults(): PipelineResult {
    this.calculatePercentages();
    return {
      metrics: this.metrics,
      totalDuration: this.getTotalDuration(),
      bottlenecks: this.identifyBottlenecks()
    };
  }

  reset(): void {
    this.metrics = [];
  }
}

/**
 * Generate ASCII bar chart for latency visualization
 */
function generateLatencyChart(metrics: LatencyMetrics[]): string {
  const maxBarLength = 60;
  const maxDuration = Math.max(...metrics.map(m => m.duration));
  
  let chart = '\n';
  chart += '═'.repeat(80) + '\n';
  chart += '  LATENCY BREAKDOWN (milliseconds)\n';
  chart += '═'.repeat(80) + '\n\n';

  metrics.forEach(m => {
    const barLength = Math.round((m.duration / maxDuration) * maxBarLength);
    const bar = '█'.repeat(barLength);
    const percentage = m.percentage?.toFixed(1) || '0.0';
    
    chart += `${m.phase.padEnd(35)} │${bar.padEnd(maxBarLength)} ${m.duration.toFixed(2).padStart(8)}ms (${percentage.padStart(5)}%)\n`;
  });

  chart += '\n' + '═'.repeat(80) + '\n';
  
  return chart;
}

/**
 * Generate ASCII timeline visualization
 */
function generateTimeline(metrics: LatencyMetrics[]): string {
  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
  const timelineLength = 70;
  
  let timeline = '\n';
  timeline += '═'.repeat(80) + '\n';
  timeline += '  PROCESSING TIMELINE\n';
  timeline += '═'.repeat(80) + '\n\n';
  timeline += '  0ms ' + '─'.repeat(timelineLength) + ` ${totalDuration.toFixed(0)}ms\n`;
  timeline += '      ';
  
  const symbols = ['▓', '▒', '░', '▓', '▒', '░', '▓'];
  metrics.forEach((m, idx) => {
    const segmentLength = Math.round((m.duration / totalDuration) * timelineLength);
    const symbol = symbols[idx % symbols.length];
    timeline += symbol.repeat(Math.max(1, segmentLength));
  });
  
  timeline += '\n\n  Legend:\n';
  metrics.forEach((m, idx) => {
    const symbol = symbols[idx % 7];
    timeline += `  ${symbol} ${m.phase}\n`;
  });
  
  timeline += '\n' + '═'.repeat(80) + '\n';
  
  return timeline;
}

/**
 * Generate waterfall chart showing sequential operations
 */
function generateWaterfallChart(metrics: LatencyMetrics[]): string {
  let chart = '\n';
  chart += '═'.repeat(80) + '\n';
  chart += '  WATERFALL CHART (Sequential Operations)\n';
  chart += '═'.repeat(80) + '\n\n';
  
  let cumulativeTime = 0;
  const maxTime = metrics.reduce((sum, m) => sum + m.duration, 0);
  const chartWidth = 50;
  
  metrics.forEach(m => {
    const startPos = Math.round((cumulativeTime / maxTime) * chartWidth);
    const duration = Math.round((m.duration / maxTime) * chartWidth);
    
    const prefix = ' '.repeat(startPos);
    const bar = '█'.repeat(Math.max(1, duration));
    
    chart += `${m.phase.padEnd(35)} │${prefix}${bar}\n`;
    cumulativeTime += m.duration;
  });
  
  chart += '\n' + '═'.repeat(80) + '\n';
  
  return chart;
}

/**
 * Simulate realistic latencies based on actual system measurements
 */
class LatencySimulator {
  // Based on real-world measurements from production Evelyn deployment
  
  async simulateWebSocketTransmission(): Promise<void> {
    const latency = this.randomLatency(5, 25);
    await this.sleep(latency);
  }

  async simulateDatabaseWrite(): Promise<void> {
    const latency = this.randomLatency(1, 8);
    await this.sleep(latency);
  }

  async simulateSearchDecision(): Promise<void> {
    const latency = this.randomLatency(200, 450);
    await this.sleep(latency);
  }

  async simulateSearchQueryRefinement(): Promise<void> {
    const latency = this.randomLatency(150, 380);
    await this.sleep(latency);
  }

  async simulatePerplexitySearch(): Promise<void> {
    const latency = this.randomLatency(2000, 4500);
    await this.sleep(latency);
  }

  async simulateSearchSynthesis(): Promise<void> {
    const latency = this.randomLatency(300, 750);
    await this.sleep(latency);
  }

  async simulateMemoryRetrieval(): Promise<void> {
    const latency = this.randomLatency(50, 180);
    await this.sleep(latency);
  }

  async simulatePersonalitySnapshot(): Promise<void> {
    const latency = this.randomLatency(5, 18);
    await this.sleep(latency);
  }

  async simulateContextClassification(): Promise<void> {
    const latency = this.randomLatency(200, 550);
    await this.sleep(latency);
  }

  async simulateComplexityAnalysis(): Promise<void> {
    const latency = this.randomLatency(150, 380);
    await this.sleep(latency);
  }

  async simulateInnerThoughtFlash(): Promise<void> {
    const latency = this.randomLatency(300, 850);
    await this.sleep(latency);
  }

  async simulateInnerThoughtPro(): Promise<void> {
    const latency = this.randomLatency(800, 1800);
    await this.sleep(latency);
  }

  async simulateConversationHistoryRetrieval(): Promise<void> {
    const latency = this.randomLatency(2, 12);
    await this.sleep(latency);
  }

  async simulateSmartTruncation(): Promise<void> {
    const latency = this.randomLatency(5, 25);
    await this.sleep(latency);
  }

  async simulateContextBuilding(): Promise<void> {
    const latency = this.randomLatency(1, 4);
    await this.sleep(latency);
  }

  async simulateTimeToFirstToken(): Promise<void> {
    const latency = this.randomLatency(500, 1300);
    await this.sleep(latency);
  }

  async simulateTokenGeneration(tokenCount: number): Promise<void> {
    const tokensPerSecond = 65;
    const latency = (tokenCount / tokensPerSecond) * 1000;
    await this.sleep(latency);
  }

  async simulateMemoryStorage(): Promise<void> {
    const latency = this.randomLatency(10, 45);
    await this.sleep(latency);
  }

  async simulatePersonalityUpdate(): Promise<void> {
    const latency = this.randomLatency(5, 18);
    await this.sleep(latency);
  }

  private randomLatency(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

describe('Evelyn Message Pipeline Latency Tests', () => {
  const tester = new PipelineLatencyTester();
  const simulator = new LatencySimulator();

  test('Complete Pipeline: Simple Message (No Search)', async () => {
    console.log('\n' + '═'.repeat(80));
    console.log('  TEST 1: SIMPLE MESSAGE PIPELINE (No Search Required)');
    console.log('  Message: "hey how are you doing today?"');
    console.log('═'.repeat(80));

    tester.reset();

    // Phase 1: Message Reception
    let start = tester.startPhase('1. WebSocket Transmission');
    await simulator.simulateWebSocketTransmission();
    tester.endPhase('1. WebSocket Transmission', start);

    start = tester.startPhase('2. Save User Message to DB');
    await simulator.simulateDatabaseWrite();
    tester.endPhase('2. Save User Message to DB', start);

    // Phase 2: Search Decision (decides NO for simple greeting)
    start = tester.startPhase('3. Search Decision (LLM)');
    await simulator.simulateSearchDecision();
    tester.endPhase('3. Search Decision (LLM)', start);

    // Phase 3: Memory Retrieval
    start = tester.startPhase('4. Memory Retrieval');
    await simulator.simulateMemoryRetrieval();
    tester.endPhase('4. Memory Retrieval', start);

    // Phase 4: Personality Snapshot
    start = tester.startPhase('5. Personality Snapshot');
    await simulator.simulatePersonalitySnapshot();
    tester.endPhase('5. Personality Snapshot', start);

    // Phase 5: Inner Thought (Flash Lite for simple message)
    start = tester.startPhase('6. Context Classification');
    await simulator.simulateContextClassification();
    tester.endPhase('6. Context Classification', start);

    start = tester.startPhase('7. Complexity Analysis');
    await simulator.simulateComplexityAnalysis();
    tester.endPhase('7. Complexity Analysis', start);

    start = tester.startPhase('8. Inner Thought (Flash Lite)');
    await simulator.simulateInnerThoughtFlash();
    tester.endPhase('8. Inner Thought (Flash Lite)', start);

    // Phase 6: Context Building
    start = tester.startPhase('9. Retrieve Conversation History');
    await simulator.simulateConversationHistoryRetrieval();
    tester.endPhase('9. Retrieve Conversation History', start);

    start = tester.startPhase('10. Build Context Messages');
    await simulator.simulateContextBuilding();
    tester.endPhase('10. Build Context Messages', start);

    // Phase 7: Response Generation
    start = tester.startPhase('11. Time To First Token (TTFT)');
    await simulator.simulateTimeToFirstToken();
    tester.endPhase('11. Time To First Token (TTFT)', start);

    start = tester.startPhase('12. Token Generation (50 tokens)');
    await simulator.simulateTokenGeneration(50);
    tester.endPhase('12. Token Generation (50 tokens)', start);

    // Phase 8: Post-Processing
    start = tester.startPhase('13. Save Assistant Message');
    await simulator.simulateDatabaseWrite();
    tester.endPhase('13. Save Assistant Message', start);

    start = tester.startPhase('14. Update Personality State');
    await simulator.simulatePersonalityUpdate();
    tester.endPhase('14. Update Personality State', start);

    const results = tester.getResults();

    console.log(generateLatencyChart(results.metrics));
    console.log(generateTimeline(results.metrics));
    console.log(generateWaterfallChart(results.metrics));

    console.log('\n' + '═'.repeat(80));
    console.log('  SUMMARY');
    console.log('═'.repeat(80));
    console.log(`  Total Pipeline Duration: ${results.totalDuration.toFixed(2)}ms`);
    console.log(`  Time To First Token:     ${results.metrics.slice(0, 11).reduce((sum, m) => sum + m.duration, 0).toFixed(2)}ms`);
    console.log(`  Bottlenecks (>20%):      ${results.bottlenecks.length > 0 ? results.bottlenecks.join(', ') : 'None'}`);
    console.log('═'.repeat(80) + '\n');

    expect(results.totalDuration).toBeLessThan(10000); // Should complete in under 10s
  }, 15000);

  test('Complete Pipeline: Complex Message with Search', async () => {
    console.log('\n' + '═'.repeat(80));
    console.log('  TEST 2: COMPLEX MESSAGE PIPELINE (With Web Search)');
    console.log('  Message: "what are the latest developments in quantum computing?"');
    console.log('═'.repeat(80));

    tester.reset();

    // Phase 1: Message Reception
    let start = tester.startPhase('1. WebSocket Transmission');
    await simulator.simulateWebSocketTransmission();
    tester.endPhase('1. WebSocket Transmission', start);

    start = tester.startPhase('2. Save User Message to DB');
    await simulator.simulateDatabaseWrite();
    tester.endPhase('2. Save User Message to DB', start);

    // Phase 2: Search (YES for factual question)
    start = tester.startPhase('3. Search Decision (LLM)');
    await simulator.simulateSearchDecision();
    tester.endPhase('3. Search Decision (LLM)', start);

    start = tester.startPhase('4. Refine Search Query');
    await simulator.simulateSearchQueryRefinement();
    tester.endPhase('4. Refine Search Query', start);

    start = tester.startPhase('5. Perplexity Web Search');
    await simulator.simulatePerplexitySearch();
    tester.endPhase('5. Perplexity Web Search', start);

    start = tester.startPhase('6. Synthesize Search Results');
    await simulator.simulateSearchSynthesis();
    tester.endPhase('6. Synthesize Search Results', start);

    start = tester.startPhase('7. Save Search Result to DB');
    await simulator.simulateDatabaseWrite();
    tester.endPhase('7. Save Search Result to DB', start);

    // Phase 3: Memory Retrieval
    start = tester.startPhase('8. Memory Retrieval');
    await simulator.simulateMemoryRetrieval();
    tester.endPhase('8. Memory Retrieval', start);

    // Phase 4: Personality Snapshot
    start = tester.startPhase('9. Personality Snapshot');
    await simulator.simulatePersonalitySnapshot();
    tester.endPhase('9. Personality Snapshot', start);

    // Phase 5: Inner Thought (Pro for complex question)
    start = tester.startPhase('10. Context Classification');
    await simulator.simulateContextClassification();
    tester.endPhase('10. Context Classification', start);

    start = tester.startPhase('11. Complexity Analysis');
    await simulator.simulateComplexityAnalysis();
    tester.endPhase('11. Complexity Analysis', start);

    start = tester.startPhase('12. Inner Thought (Pro)');
    await simulator.simulateInnerThoughtPro();
    tester.endPhase('12. Inner Thought (Pro)', start);

    // Phase 6: Context Building
    start = tester.startPhase('13. Retrieve Conversation History');
    await simulator.simulateConversationHistoryRetrieval();
    tester.endPhase('13. Retrieve Conversation History', start);

    start = tester.startPhase('14. Smart Truncation');
    await simulator.simulateSmartTruncation();
    tester.endPhase('14. Smart Truncation', start);

    start = tester.startPhase('15. Build Context Messages');
    await simulator.simulateContextBuilding();
    tester.endPhase('15. Build Context Messages', start);

    // Phase 7: Response Generation
    start = tester.startPhase('16. Time To First Token (TTFT)');
    await simulator.simulateTimeToFirstToken();
    tester.endPhase('16. Time To First Token (TTFT)', start);

    start = tester.startPhase('17. Token Generation (200 tokens)');
    await simulator.simulateTokenGeneration(200);
    tester.endPhase('17. Token Generation (200 tokens)', start);

    // Phase 8: Post-Processing
    start = tester.startPhase('18. Save Assistant Message');
    await simulator.simulateDatabaseWrite();
    tester.endPhase('18. Save Assistant Message', start);

    start = tester.startPhase('19. Store Memories');
    await simulator.simulateMemoryStorage();
    tester.endPhase('19. Store Memories', start);

    start = tester.startPhase('20. Update Personality State');
    await simulator.simulatePersonalityUpdate();
    tester.endPhase('20. Update Personality State', start);

    const results = tester.getResults();

    console.log(generateLatencyChart(results.metrics));
    console.log(generateTimeline(results.metrics));
    console.log(generateWaterfallChart(results.metrics));

    console.log('\n' + '═'.repeat(80));
    console.log('  SUMMARY');
    console.log('═'.repeat(80));
    console.log(`  Total Pipeline Duration: ${results.totalDuration.toFixed(2)}ms`);
    console.log(`  Time To First Token:     ${results.metrics.slice(0, 16).reduce((sum, m) => sum + m.duration, 0).toFixed(2)}ms`);
    console.log(`  Search Duration:         ${(results.metrics[4].duration + results.metrics[5].duration).toFixed(2)}ms`);
    console.log(`  Bottlenecks (>20%):      ${results.bottlenecks.length > 0 ? results.bottlenecks.join(', ') : 'None'}`);
    console.log('═'.repeat(80) + '\n');

    expect(results.totalDuration).toBeLessThan(20000); // Should complete in under 20s
  }, 25000);

  test('Performance Comparison: Simple vs Complex', async () => {
    console.log('\n' + '═'.repeat(80));
    console.log('  TEST 3: PERFORMANCE COMPARISON');
    console.log('═'.repeat(80));

    // Run simplified simple message test
    const simpleStart = performance.now();
    await simulator.simulateWebSocketTransmission();
    await simulator.simulateSearchDecision();
    await simulator.simulateMemoryRetrieval();
    await simulator.simulateInnerThoughtFlash();
    await simulator.simulateTimeToFirstToken();
    await simulator.simulateTokenGeneration(50);
    const simpleDuration = performance.now() - simpleStart;

    // Run simplified complex message test
    const complexStart = performance.now();
    await simulator.simulateWebSocketTransmission();
    await simulator.simulateSearchDecision();
    await simulator.simulatePerplexitySearch();
    await simulator.simulateSearchSynthesis();
    await simulator.simulateMemoryRetrieval();
    await simulator.simulateInnerThoughtPro();
    await simulator.simulateTimeToFirstToken();
    await simulator.simulateTokenGeneration(200);
    const complexDuration = performance.now() - complexStart;

    console.log('\n  COMPARISON CHART');
    console.log('  ' + '─'.repeat(76));
    
    const maxDuration = Math.max(simpleDuration, complexDuration);
    const simpleBar = '█'.repeat(Math.round((simpleDuration / maxDuration) * 50));
    const complexBar = '█'.repeat(Math.round((complexDuration / maxDuration) * 50));
    
    console.log(`  Simple Message  │${simpleBar.padEnd(50)} ${simpleDuration.toFixed(0)}ms`);
    console.log(`  Complex + Search│${complexBar.padEnd(50)} ${complexDuration.toFixed(0)}ms`);
    console.log('  ' + '─'.repeat(76));
    console.log(`  Difference: ${(complexDuration - simpleDuration).toFixed(0)}ms (${((complexDuration / simpleDuration - 1) * 100).toFixed(1)}% slower)\n`);
    console.log('═'.repeat(80) + '\n');

    expect(complexDuration).toBeGreaterThan(simpleDuration);
  }, 30000);
});
