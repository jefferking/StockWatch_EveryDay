import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { apiKey, promptContext } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing" }, { status: 400 });
    }

    // [修正] 初始化時指定使用 v1beta 版本，這對新模型支援度較好
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      apiVersion: 'v1beta'
    });

    const prompt = `
      You are a financial analyst.
      Target Keyword: "${promptContext || 'US Stock Market'}".
      Analyze current market news based on this keyword.

      Return a STRICT JSON object with this exact structure (no markdown, just raw JSON):
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
    `;

    // [修正] 呼叫 generateContent
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    let text = response.text;

    // 清理 Markdown
    if (text) {
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("JSON Parse Error:", text);
      return NextResponse.json({
        error: "AI 回傳格式錯誤",
        rawText: text
      }, { status: 500 });
    }

  } catch (error) {
    console.error("SDK Error:", error);

    // 如果錯誤包含 404，給予更明確的提示
    if (error.message?.includes("404") || error.message?.includes("not found")) {
        return NextResponse.json({
          error: "API Key 權限不足或模型不存在。請務必在 Google AI Studio 建立『新專案』的金鑰。"
        }, { status: 404 });
    }

    return NextResponse.json({
      error: error.message || "Internal Server Error"
    }, { status: 500 });
  }
}
