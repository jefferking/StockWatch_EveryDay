import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { apiKey } = await req.json(); // 從前端傳入 API Key

    // 實際應用中，這裡可以使用 fetch 去抓取 Yahoo Finance 或 CNBC 的 RSS
    // 這裡我們模擬一段抓取到的美國財經新聞原文
    const rawNewsText = `
      Markets are watching NVIDIA (NVDA) closely as AI demand surges.
      Meanwhile, Apple (AAPL) announced new features for the iPhone.
      Tesla (TSLA) stock dropped slightly due to production delays.
      The technology sector remains the hottest area for investors.
    `;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are a financial analyst. Analyze the following news text.
      Return a STRICT JSON object (no markdown) with this structure:
      {
        "summary": "Brief summary in Traditional Chinese",
        "hot_sector": "Name of the hottest sector mentioned",
        "stocks": [
          { "symbol": "AAPL.US", "name": "Apple", "reason": "Why it's hot" },
          { "symbol": "NVDA.US", "name": "Nvidia", "reason": "Why it's hot" }
        ]
      }
      Important: Convert all US stock tickers to the format "TICKER.US" (e.g., TSLA.US).

      News Text: ${rawNewsText}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // 清理 Markdown 格式 (```json ... ```)
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
