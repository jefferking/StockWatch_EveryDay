import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { apiKey, promptContext } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 讓 Prompt 更明確，要求 JSON 格式
    const prompt = `
      You are a financial analyst.
      Target Keyword: "${promptContext || 'US Stock Market'}".
      Analyze current market news based on this keyword.

      Return a STRICT JSON object with this exact structure (no markdown code blocks, just raw JSON):
      {
        "summary": "Brief summary in Traditional Chinese (within 50 words)",
        "hot_sector": "Name of the hottest sector",
        "stocks": [
          { "symbol": "AAPL.US", "name": "Apple", "reason": "Why it's hot" },
          { "symbol": "NVDA.US", "name": "Nvidia", "reason": "Why it's hot" }
        ]
      }
      Important:
      1. Convert all US stock tickers to "TICKER.US".
      2. Do not include \`\`\`json or \`\`\` markers.
      3. Create believable mock news based on real-world trends if you cannot browse live web.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // [更強的清理邏輯] 移除可能存在的 Markdown 標記
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("JSON Parse Error:", text); // 在 Vercel Log 可以看到原始回應
      return NextResponse.json({
        error: "AI 回傳格式錯誤",
        rawText: text
      }, { status: 500 });
    }

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({
      error: error.message || "Internal Server Error"
    }, { status: 500 });
  }
}
