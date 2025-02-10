const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { Document } = require("langchain/document");

const docstorePath = path.join(__dirname, "qna/docstore.json");
const vectorStorePath = path.join(__dirname, "qna/vector_store"); // Ensure correct path

require("dotenv").config();

/**
 * Load QnA data from CSV
 */
async function loadQnAData() {
    const qna = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream("./data/qna.csv")
            .pipe(csv())
            .on("data", (row) => {
                qna.push({ 
                    question: row.question.trim(), 
                    answer: row.answer.trim(), 
                    context: row.context ? row.context.trim() : "",
                    id: qna.length // Assign an index-based ID
                });
            })
            .on("end", resolve)
            .on("error", reject);
    });

    console.log(`✅ Loaded ${qna.length} QnA entries from CSV`);
    return qna;
}

/**
 * Embed and store the QnA data into the vector store
 */
async function embedAndStoreQnA() {
    console.log("📌 Loading QnA data...");
    const qnaData = await loadQnAData();

    // Convert QnA data into Documents
    const docs = qnaData.map((item, index) => new Document({
        pageContent: `Question: ${item.question}\n\nAnswer: ${item.answer}\n\nContext: ${item.context}\n\n`,
        metadata: { id: index } // Ensure IDs are properly stored
    }));

    console.log("🔹 Generating embeddings...");
    const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });

    const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);

    console.log("💾 Saving vector store...");
    await vectorStore.save(vectorStorePath);

    console.log("💾 Saving docstore.json...");
    const docstoreData = docs.map((doc, index) => ({
        id: index,
        pageContent: doc.pageContent,
        metadata: doc.metadata
    }));
    fs.writeFileSync(docstorePath, JSON.stringify(docstoreData, null, 2));

    console.log("✅ QnA embeddings stored successfully!");
}

/**
 * Perform intelligent similarity search with ranking and threshold filtering
 */
async function searchQnA(query, topK = 10, scoreThreshold = 0.1) {
  if (!query) {
      throw new Error("❌ Missing query");
  }

  console.log("📌 Loading vector store...");
  const vectorStore = await HNSWLib.load(vectorStorePath, new OpenAIEmbeddings());

  // ✅ **Step 1: Convert Query to Embedding**
  console.log("🔹 Generating query embedding...");
  const embeddingModel = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  const queryEmbedding = await embeddingModel.embedQuery(query); // Get 1536-dim vector

  // ✅ **Step 2: Retrieve Top-K Similarity Results**
  console.log("🔍 Retrieving top", topK, "results for query:", query);
  const resultsWithScores = await vectorStore.similaritySearchVectorWithScore(queryEmbedding, topK); // Uses vector

  console.log("🔹 Raw results with scores:", resultsWithScores);

  // Ensure docstore.json exists
  let docstoreData = [];
  if (fs.existsSync(docstorePath)) {
      docstoreData = JSON.parse(fs.readFileSync(docstorePath, "utf-8"));
  } else {
      throw new Error("❌ Docstore not found. Run embedAndStoreQnA() first.");
  }

  // ✅ **Step 3: Filter results by similarity score threshold**
  const filteredResults = resultsWithScores
      .filter(([_, score]) => score >= scoreThreshold) // Keep only relevant results
      .map(([res, score]) => ({
          id: res.metadata.id,
          pageContent: res.pageContent,
          score: score
      }));

  console.log("✅ Filtered relevant results:", filteredResults.length);

  if (filteredResults.length === 0) {
      console.warn("⚠️ No results above the similarity threshold. Returning generic response.");
      return ["No relevant information found. If it is something easy to answer do it as Noé would do it."];
  }

  // ✅ **Step 4: Group and Merge Answers for More Context**
  let groupedAnswers = new Map();
  
  filteredResults.forEach((result) => {
      const foundDoc = docstoreData.find(doc => doc.metadata.id === result.id);
      if (foundDoc) {
          const key = foundDoc.metadata.id;
          if (!groupedAnswers.has(key)) {
              groupedAnswers.set(key, foundDoc.pageContent);
          }
      }
  });

  // ✅ **Step 5: Sort by Relevance Score**
  let finalAnswers = [...groupedAnswers.values()].sort((a, b) => {
      return filteredResults.find(res => res.pageContent === b).score -
             filteredResults.find(res => res.pageContent === a).score;
  });

  console.log("🎯 Returning top contextual responses...");
  return finalAnswers.slice(0, topK); // Return **top 3** most relevant responses
}

// Export functions
module.exports = { embedAndStoreQnA, searchQnA };

// Run embedding process if executed directly
if (require.main === module) {
    embedAndStoreQnA().catch(console.error);
}
