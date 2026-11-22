// Supabase Edge Function: secretary-parse-meal
// Supabase Storage (secretary-meals 버킷)에 업로드된 어린이집 월간 식단표 이미지/PDF를
// Gemini 3.8 Flash 멀티모달로 분석하여 날짜별 점심·간식 JSON을 secretary_meals 테이블에 일괄 저장

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_MODEL = 'gemini-3.8-flash'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim()

    if (!geminiApiKey) {
      return jsonResponse(
        { error: 'GEMINI_API_KEY Secret이 Supabase Edge Functions에 설정되지 않았습니다.' },
        500
      )
    }

    const body = await req.json().catch(() => ({}))
    const filePath = typeof body?.filePath === 'string' ? body.filePath.trim() : ''
    const mimeType = typeof body?.mimeType === 'string' && body.mimeType ? body.mimeType : 'image/jpeg'
    const fallbackYearMonth =
      typeof body?.yearMonth === 'string' && /^\d{4}-\d{2}$/.test(body.yearMonth)
        ? body.yearMonth
        : new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7)

    if (!filePath) {
      return jsonResponse({ error: 'filePath 파라미터가 필요합니다.' }, 400)
    }

    // 1. Supabase Storage에서 식단표 파일 다운로드
    const encodedPath = filePath
      .split('/')
      .map((seg: string) => encodeURIComponent(seg))
      .join('/')

    const storageRes = await fetch(
      `${supabaseUrl}/storage/v1/object/secretary-meals/${encodedPath}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    )

    if (!storageRes.ok) {
      const errText = await storageRes.text()
      return jsonResponse({ error: `Storage 파일 로드 실패 (${storageRes.status}): ${errText}` }, 404)
    }

    const arrayBuffer = await storageRes.arrayBuffer()
    const base64Data = uint8ToBase64(new Uint8Array(arrayBuffer))

    // 2. Gemini 3.8 Flash 멀티모달로 날짜별 점심/간식 JSON 추출
    const prompt = `
이 파일은 한국 어린이집의 월간 식단표입니다.
식단표에 적힌 모든 날짜의 점심 메뉴, 오전 간식, 오후 간식을 정확히 읽어 JSON으로 추출하세요.
연도/월이 명확히 안 보이면 기본 기준 월(${fallbackYearMonth})을 사용하세요.

반드시 아래 JSON 스키마만 반환하세요:
{
  "meals": [
    {
      "meal_date": "YYYY-MM-DD",
      "lunch_menu": ["밥", "국", "반찬1", "반찬2", "김치"],
      "morning_snack": "오전 간식 메뉴 (없으면 빈 문자열)",
      "afternoon_snack": "오후 간식 메뉴 (없으면 빈 문자열)"
    }
  ]
}
규칙:
- 공휴일이나 식단이 비어있는 날은 제외하세요.
- 메뉴명에 붙은 알레르기 번호(예: ①②⑤, (1.2.5))는 깔끔하게 제거하세요.
- meal_date는 반드시 YYYY-MM-DD 형식이어야 합니다.
`.trim()

    const geminiBody = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    })

    const modelsToTry = [GEMINI_MODEL, 'gemini-2.5-flash']
    let geminiRes: Response | null = null

    for (const model of modelsToTry) {
      const primaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        geminiApiKey
      )}`
      const vertexUrl = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(
        geminiApiKey
      )}`

      let done = false
      for (let attempt = 0; attempt < 2; attempt++) {
        let res = await fetch(primaryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: geminiBody,
        })

        // Vertex AI Express 키(AQ. 등)인 경우 Vertex AI 엔드포인트로 자동 폴백
        if ((res.status === 400 || res.status === 401 || res.status === 403) && geminiApiKey.startsWith('AQ.')) {
          res = await fetch(vertexUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: geminiBody,
          })
        }

        geminiRes = res
        if (res.ok || res.status === 429) {
          done = true
          break
        }
        if (res.status === 503 || res.status === 502 || res.status === 500 || res.status === 404) {
          if (res.status === 404) break
          await new Promise((r) => setTimeout(r, 1200))
          continue
        }
        done = true
        break
      }
      if (done) break
    }

    if (!geminiRes) {
      return jsonResponse({ error: 'Gemini API 응답을 받지 못했습니다.' }, 502)
    }

    if (geminiRes.status === 429) {
      return jsonResponse(
        { error: 'Gemini 무료 API 호출 한도(429)에 도달했습니다. 잠시 후 다시 시도해주세요.' },
        429
      )
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return jsonResponse({ error: `Gemini 멀티모달 분석 오류 (${geminiRes.status}): ${errText}` }, 502)
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    let parsed: { meals?: Array<Record<string, unknown>> } = {}
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      parsed = JSON.parse(cleaned)
    }

    const extracted = Array.isArray(parsed.meals) ? parsed.meals : []
    const validRows = extracted
      .filter((m) => typeof m?.meal_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.meal_date))
      .map((m) => ({
        meal_date: String(m.meal_date),
        lunch_menu: Array.isArray(m.lunch_menu)
          ? m.lunch_menu.map((x) => String(x).trim()).filter(Boolean)
          : [],
        morning_snack: typeof m.morning_snack === 'string' ? m.morning_snack.trim() : '',
        afternoon_snack: typeof m.afternoon_snack === 'string' ? m.afternoon_snack.trim() : '',
        raw_text: '',
        source_file_path: filePath,
        updated_at: new Date().toISOString(),
      }))

    if (validRows.length === 0) {
      return jsonResponse(
        { error: '식단표에서 날짜별 메뉴를 인식하지 못했습니다. 선명한 이미지나 PDF로 다시 시도해주세요.' },
        422
      )
    }

    // 3. Supabase DB (secretary_meals)에 날짜별 Upsert
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/secretary_meals?on_conflict=meal_date`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(validRows),
      }
    )

    if (!upsertRes.ok) {
      const errText = await upsertRes.text()
      return jsonResponse({ error: `식단 DB 저장 실패: ${errText}` }, 500)
    }

    const saved = await upsertRes.json()
    return jsonResponse({ count: saved.length, meals: saved })
  } catch (err) {
    console.error('secretary-parse-meal error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : '알 수 없는 오류' }, 500)
  }
})
