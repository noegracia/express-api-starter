const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const docstorePath = path.join(__dirname, "qna/docstore.json");
const dataPath = path.join(__dirname, "data/qna.csv");

require("dotenv").config();

/**
 * Load QnA data from CSV
 */
async function loadQnAData() {
    const qna = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream(dataPath)
            .pipe(csv())
            .on("data", (row) => {
                qna.push({ 
                    question: row.question.trim(), 
                    answer: row.answer.trim(), 
                    context: row.context ? row.context.trim() : "",
                    id: qna.length
                });
            })
            .on("end", resolve)
            .on("error", reject);
    });

    console.log(`✅ Loaded ${qna.length} QnA entries from CSV`);
    return qna;
}

/**
 * Store the QnA data
 */
async function embedAndStoreQnA() {
    console.log("📌 Loading QnA data...");
    const qnaData = await loadQnAData();

    // Convert QnA data into Documents
    const docs = qnaData.map((item, index) => ({
        id: index,
        pageContent: `Question: ${item.question}\n\nAnswer: ${item.answer}\n\nContext: ${item.context}\n\n`,
        metadata: { id: index }
    }));

    console.log("💾 Saving docstore.json...");
    fs.writeFileSync(docstorePath, JSON.stringify(docs, null, 2));

    console.log("✅ QnA data stored successfully!");
}

/**
 * Extract relevant information from a document
 */
function extractRelevantInfo(doc) {
    // Parse the document content
    const questionMatch = doc.pageContent.match(/Question: (.*?)(?:\n|$)/);
    const answerMatch = doc.pageContent.match(/Answer: (.*?)(?:\n\n|$)/s);
    const contextMatch = doc.pageContent.match(/Context: (.*?)(?:\n\n|$)/s);
    
    return {
        question: questionMatch ? questionMatch[1].trim() : "",
        answer: answerMatch ? answerMatch[1].trim() : "",
        context: contextMatch ? contextMatch[1].trim() : "",
        score: doc.score
    };
}

/**
 * Format context for the LLM
 */
function formatContextForLLM(results) {
    if (!results || results.length === 0) {
        return "No relevant information found.";
    }
    
    // Extract and format the information
    const formattedResults = results.map(result => {
        const info = extractRelevantInfo(result);
        return `Question: ${info.question}\nAnswer: ${info.answer}${info.context ? `\nContext: ${info.context}` : ''}`;
    });
    
    // Join with double newlines for better readability
    return formattedResults.join("\n\n");
}

/**
 * Perform simple text-based search with improved relevance
 */
async function searchQnA(query, topK = 3) {
    if (!query) {
        throw new Error("❌ Missing query");
    }

    // Load the docstore
    let docstoreData = [];
    if (fs.existsSync(docstorePath)) {
        docstoreData = JSON.parse(fs.readFileSync(docstorePath, "utf-8"));
    } else {
        throw new Error("❌ Docstore not found. Run embedAndStoreQnA() first.");
    }

    // Normalize query
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/);
    
    // Keywords that might indicate education-related queries
    const educationKeywords = ['study', 'education', 'degree', 'university', 'college', 'school', 'graduate', 'major', 'field'];
    const isEducationQuery = educationKeywords.some(keyword => normalizedQuery.includes(keyword));

    // Simple text-based search with improved scoring
    const searchResults = docstoreData
        .map(doc => {
            const content = doc.pageContent.toLowerCase();
            const question = content.match(/question: (.*?)(?:\n|$)/)?.[1] || '';
            const answer = content.match(/answer: (.*?)(?:\n\n|$)/s)?.[1] || '';
            
            // Calculate base score from word matches
            const wordMatches = queryWords.filter(word => 
                content.includes(word) || 
                question.includes(word) || 
                answer.includes(word)
            ).length;
            
            let score = wordMatches / queryWords.length;
            
            // Boost score for education-related content if query is about education
            if (isEducationQuery) {
                const educationContent = content.includes('education') || 
                                      content.includes('study') || 
                                      content.includes('degree') ||
                                      content.includes('university');
                if (educationContent) {
                    score *= 1.5;
                }
            }
            
            // Boost score for exact phrase matches
            if (content.includes(normalizedQuery)) {
                score *= 1.3;
            }
            
            // Boost score for question matches
            if (question.includes(normalizedQuery)) {
                score *= 1.2;
            }
            
            return {
                ...doc,
                score
            };
        })
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    if (searchResults.length === 0) {
        console.warn("⚠️ No results found. Returning generic response.");
        return "No relevant information found. If it is something easy to answer do it as Noé would do it.";
    }

    console.log("🎯 Returning top contextual responses...");
    return formatContextForLLM(searchResults);
}

// Export functions
module.exports = { embedAndStoreQnA, searchQnA };

// Run embedding process if executed directly
if (require.main === module) {
    embedAndStoreQnA().catch(console.error);
}
