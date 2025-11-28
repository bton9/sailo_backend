/**
 * Ollama AI 服務模組
 * 路徑: sailo_backend/src/services/ollamaService.js
 *
 * 功能說明:
 * - 與 Ollama API 互動
 * - 管理對話上下文
 * - 處理 AI 回應
 * - 錯誤處理與重試機制
 *
 * 核心功能:
 * 1. 生成 AI 回應
 * 2. 對話上下文管理
 * 3. 關鍵字偵測 (轉接人工)
 * 4. Token 使用統計
 *
 * 使用方式:
 * import { generateAIResponse, analyzeTransferIntent } from '@/services/ollamaService'
 */

import { OLLAMA_CONFIG } from '../config/ollama.js'
import { executeUserQuery, suggestQueryType } from './databaseQueryService.js'

/**
 * 呼叫 Ollama Chat API
 *
 * @param {Array} messages - 對話訊息陣列 [{role: 'user'|'assistant'|'system', content: '...'}]
 * @param {Object} options - 選項 {temperature, stream, etc.}
 * @returns {Promise<{response: string, tokens: number}>}
 */
export async function callOllamaChat(messages, options = {}) {
  try {
    const requestBody = {
      model: OLLAMA_CONFIG.MODEL,
      messages,
      stream: false, // 不使用串流模式
      options: {
        temperature:
          options.temperature || OLLAMA_CONFIG.PARAMETERS.temperature,
        top_p: options.top_p || OLLAMA_CONFIG.PARAMETERS.top_p,
        top_k: options.top_k || OLLAMA_CONFIG.PARAMETERS.top_k,
        num_predict:
          options.num_predict || OLLAMA_CONFIG.PARAMETERS.num_predict,
        repeat_penalty:
          options.repeat_penalty || OLLAMA_CONFIG.PARAMETERS.repeat_penalty,
      },
    }

    console.log('🤖 呼叫 Ollama API:', {
      model: requestBody.model,
      messagesCount: messages.length,
    })

    const response = await fetch(
      `${OLLAMA_CONFIG.BASE_URL}${OLLAMA_CONFIG.ENDPOINTS.CHAT}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(OLLAMA_CONFIG.TIMEOUT.CHAT),
      }
    )

    if (!response.ok) {
      throw new Error(`Ollama API 錯誤: HTTP ${response.status}`)
    }

    const data = await response.json()

    // 提取回應內容
    const aiResponse = data.message?.content || ''
    const tokensUsed = (data.eval_count || 0) + (data.prompt_eval_count || 0)

    console.log('✅ Ollama 回應成功:', {
      responseLength: aiResponse.length,
      tokensUsed,
    })

    return {
      response: aiResponse,
      tokens: tokensUsed,
    }
  } catch (error) {
    console.error(' Ollama API 呼叫失敗:', error)

    // 錯誤類型判斷
    if (error.name === 'AbortError') {
      throw new Error('AI 回應超時,請稍後再試')
    }

    throw new Error(`AI 服務異常: ${error.message}`)
  }
}

/**
 * 生成 AI 客服回應
 *
 * 🆕 v4.0.0: 新增資料庫查詢功能
 * - 自動偵測使用者是否需要查詢資料庫
 * - 執行安全的資料庫查詢
 * - 將查詢結果整合到 AI 回應中
 *
 * @param {string} userMessage - 使用者訊息
 * @param {Array} conversationHistory - 對話歷史 [{role, content}, ...]
 * @param {number} userId - 使用者 ID（用於資料庫查詢）
 * @returns {Promise<{response: string, tokens: number, shouldTransfer: boolean, queryExecuted: boolean}>}
 */
export async function generateAIResponse(
  userMessage,
  conversationHistory = [],
  userId = null
) {
  try {
    let queryResult = null
    let queryExecuted = false

    // 🆕 步驟 1: 檢查是否需要查詢資料庫
    if (userId) {
      const suggestedQuery = suggestQueryType(userMessage)

      if (suggestedQuery) {
        console.log('🔍 偵測到資料庫查詢需求:', suggestedQuery)

        try {
          queryResult = await executeUserQuery(suggestedQuery, userId)
          queryExecuted = true
          console.log('✅ 資料庫查詢成功')
        } catch (error) {
          console.error(' 資料庫查詢失敗:', error)
          queryResult = '抱歉，查詢資料時發生錯誤。'
        }
      }
    }

    // 步驟 2: 建構完整對話上下文
    const messages = [
      // 系統提示詞
      {
        role: 'system',
        content: queryResult
          ? `${OLLAMA_CONFIG.SYSTEM_PROMPT}\n\n【重要】以下是從資料庫查詢到的使用者資料，請根據這些資料回答使用者的問題：\n${queryResult}`
          : OLLAMA_CONFIG.SYSTEM_PROMPT,
      },
      // 歷史對話 (最多保留 10 輪)
      ...conversationHistory.slice(-20),
      // 當前使用者訊息
      {
        role: 'user',
        content: userMessage,
      },
    ]

    // 步驟 3: 呼叫 Ollama API
    const { response, tokens } = await callOllamaChat(messages)

    // 步驟 4: 分析是否需要轉接人工
    const shouldTransfer = analyzeTransferIntent(userMessage, response)

    return {
      response,
      tokens,
      shouldTransfer,
      queryExecuted, // 🆕 返回是否執行了資料庫查詢
    }
  } catch (error) {
    console.error(' 生成 AI 回應失敗:', error)
    throw error
  }
}

/**
 * 分析是否需要轉接人工客服
 *
 * 🆕 v3.2.0 修改:
 * - 只檢查用戶訊息，不檢查 AI 回應
 * - 避免 AI 回應中的「轉人工」關鍵字誤觸發轉接
 *
 * 觸發條件:
 * 1. 使用者明確要求真人客服
 * 2. 涉及敏感操作 (退款、修改資料等)
 *
 * @param {string} userMessage - 使用者訊息
 * @param {string} aiResponse - AI 回應 (暫不使用)
 * @returns {boolean}
 */
export function analyzeTransferIntent(userMessage, aiResponse) {
  // 使用者關鍵字
  const userKeywords = [
    '真人客服',
    '人工客服',
    '轉接客服',
    '找客服',
    '真人',
    '人工',
    '客服人員',
    'human',
    'agent',
    '不滿意',
    '投訴',
    '抱怨',
  ]

  // 敏感操作關鍵字
  const sensitiveKeywords = ['退款', '退錢', '退費', '信用卡']

  // 🆕 v3.2.0: 只檢查使用者訊息，不檢查 AI 回應
  const userWantsHuman = userKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword.toLowerCase())
  )

  // 檢查敏感操作
  const isSensitive = sensitiveKeywords.some((keyword) =>
    userMessage.includes(keyword)
  )

  //  移除 AI 回應檢測，避免誤觸發
  // const aiSuggestsTransfer = aiTransferKeywords.some((keyword) =>
  //   aiResponse.includes(keyword)
  // )

  return userWantsHuman || isSensitive
}

/**
 * 生成歡迎訊息
 *
 * @returns {string}
 */
export function getWelcomeMessage() {
  return `您好！我是 SailoTravel 的 AI 客服助手

我可以協助您:
• 查詢訂單狀態
• 了解退換貨政策
• 解答付款相關問題
• 推薦旅遊景點與行程

如有任何問題,歡迎隨時詢問！
若需要更詳細的協助,我也可以為您轉接真人客服。`
}

/**
 * 生成轉接確認訊息
 *
 * @returns {string}
 */
export function getTransferConfirmMessage() {
  return `我將為您轉接真人客服,請稍候...

您的對話記錄將會一併轉交給客服人員,以便提供更好的服務。`
}

/**
 * 生成錯誤訊息
 *
 * @param {Error} error - 錯誤物件
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (error.message.includes('超時')) {
    return '抱歉,AI 回應超時了。您可以:\n1. 重新發送您的問題\n2. 轉接真人客服獲得協助'
  }

  if (error.message.includes('連線')) {
    return '抱歉,AI 服務暫時無法使用。請轉接真人客服,我們將為您提供協助。'
  }

  return '抱歉,目前無法處理您的請求。建議您轉接真人客服以獲得更好的協助。'
}

export default {
  callOllamaChat,
  generateAIResponse,
  analyzeTransferIntent,
  getWelcomeMessage,
  getTransferConfirmMessage,
  getErrorMessage,
}
