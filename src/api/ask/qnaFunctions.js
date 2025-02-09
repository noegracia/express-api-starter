const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { Document } = require("langchain/document");

const docstorePath = path.join(__dirname, "qna/docstore.json");
const vectorStorePath = "qna"; // Directory where vector storage is saved

require("dotenv").config();

// Load QnA data from CSV
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
    return qna;
}

// Embed and store the QnA data
async function embedAndStoreQnA() {
    console.log("Loading QnA data...");
    const qnaData = await loadQnAData();

    // Convert each QnA pair into a formatted text document
    const docs = qnaData.map((item) => new Document({
        pageContent: `Question: ${item.question}\n\nAnswer: ${item.answer}\n\nContext: ${item.context}\n\n`,
        metadata: { id: item.id }
    }));

    console.log("API Key:", process.env.OPENAI_API_KEY);

    console.log("Generating embeddings...");
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY
    });
  
    const vectorStore = await HNSWLib.fromDocuments(docs, embeddings);

    console.log("Saving vector store...");
    await vectorStore.save(vectorStorePath);

    // Save docstore.json
    console.log("Saving docstore.json...");
    const docstoreData = docs.map((doc, index) => [
        index,
        { pageContent: doc.pageContent, metadata: doc.metadata }
    ]);
    fs.writeFileSync(docstorePath, JSON.stringify(docstoreData, null, 2));

    console.log("QnA embeddings stored successfully!");
}

// Search the QnA data
async function searchQnA(query) {
    if (!query) {
        throw new Error("Missing query");
    }

    console.log("Loading vector store...");
    const vectorStore = await HNSWLib.load(vectorStorePath, new OpenAIEmbeddings());

    console.log("Searching for query:", query);
    const results = await vectorStore.similaritySearch(query, 2); // Get top 2 matches

    console.log("Raw search results:", results);

    // Extract page content from search results
    return results.map(res => res.pageContent);
}

module.exports = { embedAndStoreQnA, searchQnA };

// Run embedding process if executed directly
if (require.main === module) {
    embedAndStoreQnA().catch(console.error);
}
