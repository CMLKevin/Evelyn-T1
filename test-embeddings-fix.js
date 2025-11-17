// Test script to verify the embeddings fix
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'server', '.env') });

// Set environment variables explicitly
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
process.env.EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'qwen/qwen3-embedding-8b';

console.log('Using embedding model:', process.env.EMBEDDING_MODEL);

import { openRouterClient } from './server/dist/providers/openrouter.js';

async function testEmbeddings() {
  console.log('Testing embeddings API fix...');
  
  try {
    // Test single embedding
    console.log('\n1. Testing single embedding...');
    const singleEmbedding = await openRouterClient.embed('This is a test message for embedding.');
    console.log(`✅ Single embedding success: dimension ${singleEmbedding.length}`);
    
    // Test batch embedding
    console.log('\n2. Testing batch embedding...');
    const batchEmbeddings = await openRouterClient.embedBatch([
      'First test message',
      'Second test message', 
      'Third test message'
    ]);
    console.log(`✅ Batch embedding success: ${batchEmbeddings.length} embeddings`);
    console.log(`   - Embedding 1 dimension: ${batchEmbeddings[0].length}`);
    console.log(`   - Embedding 2 dimension: ${batchEmbeddings[1].length}`);
    console.log(`   - Embedding 3 dimension: ${batchEmbeddings[2].length}`);
    
    // Test with the memory system
    console.log('\n3. Testing with memory system...');
    const { embed } = await import('./server/dist/providers/embeddings.js');
    const memoryEmbedding = await embed('User said they love TypeScript and React');
    console.log(`✅ Memory system embedding success: dimension ${memoryEmbedding.length}`);
    
    console.log('\n🎉 All tests passed! Embeddings API is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testEmbeddings();
