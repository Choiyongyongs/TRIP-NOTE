// Supabase Edge Function: secretary-briefing
// 충남 아산시 실시간 날씨 + 무료 경제 뉴스 RSS + DB(어린이집 식단 & 일정) 수집 후
// Gemini 3.8 Flash(gemini-3.8-flash)로 1회 종합 브리핑 생성 및 DB 캐싱

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 충남 아산시 좌표
const ASAN_LAT = 36.7898
const ASAN_LNG = 127.0018
const GEMINI_MODEL = 'gemini-3.8-flash'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function getTodayKst(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim()
}

// 1. 충남 아산시 날씨 수집 (OpenWeatherMap 무료 API 우선 -> 미설정/오류 시 무료 Open-Meteo 자동 폴백)
async function fetchAsanWeather() {
  const owmKey = Deno.env.get('OPENWEATHER_API_KEY')?.trim()

  if (owmKey) {
    try {
      const [curRes, fcRes] = await Promise.all([
        fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${ASAN_LAT}&lon=${ASAN_LNG}&appid=${encodeURIComponent(
            owmKey
          )}&units=metric&lang=kr`
        ),
        fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${ASAN_LAT}&lon=${ASAN_LNG}&appid=${encodeURIComponent(
            owmKey
          )}&units=metric&lang=kr&cnt=8`
        ),
      ])

      if (curRes.ok) {
        const cur = await curRes.json()
        let pop = 0
        let tempMin = Math.round(cur.main?.temp_min ?? cur.main?.temp ?? 0)
        let tempMax = Math.round(cur.main?.temp_max ?? cur.main?.temp ?? 0)

        if (fcRes.ok) {
          const fc = await fcRes.json()
          const list = Array.isArray(fc.list) ? fc.list : []
          if (list.length > 0) {
            pop = Math.round(Math.max(...list.map((x: { pop?: number }) => Number(x.pop || 0))) * 100)
            const temps = list.map((x: { main?: { temp?: number } }) => Number(x.main?.temp ?? cur.main?.temp ?? 0))
            tempMin = Math.round(Math.min(tempMin, ...temps))
            tempMax = Math.round(Math.max(tempMax, ...temps))
          }
        }

        return {
          location: '충남 아산시',
          temp: Math.round(cur.main?.temp ?? 0),
          feels_like: Math.round(cur.main?.feels_like ?? cur.main?.temp ?? 0),
          temp_min: tempMin,
          temp_max: tempMax,
          humidity: Math.round(cur.main?.humidity ?? 0),
          rain_prob: pop,
          condition: cur.weather?.[0]?.description || '맑음',
          weather_code: cur.weather?.[0]?.main || 'Clear',
          source: 'OpenWeatherMap',
        }
      }
    } catch (err) {
      console.warn('OpenWeatherMap 호출 실패, Open-Meteo 폴백:', err)
    }
  }

  // Open-Meteo 무료 API 폴백 (API 키 불필요)
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${ASAN_LAT}&longitude=${ASAN_LNG}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Asia%2FSeoul&forecast_days=1`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const code = Number(data.current?.weather_code ?? 0)
      const conditionMap = (c: number) => {
        if (c === 0) return { desc: '맑음', main: 'Clear' }
        if (c <= 3) return { desc: '구름 조금 / 흐림', main: 'Clouds' }
        if (c <= 48) return { desc: '안개', main: 'Mist' }
        if (c <= 67) return { desc: '비', main: 'Rain' }
        if (c <= 77) return { desc: '눈', main: 'Snow' }
        if (c <= 82) return { desc: '소나기', main: 'Rain' }
        return { desc: '뇌우 / 흐림', main: 'Thunderstorm' }
      }
      const mapped = conditionMap(code)
      return {
        location: '충남 아산시',
        temp: Math.round(data.current?.temperature_2m ?? 0),
        feels_like: Math.round(data.current?.apparent_temperature ?? 0),
        temp_min: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
        temp_max: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
        humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
        rain_prob: Math.round(data.daily?.precipitation_probability_max?.[0] ?? 0),
        condition: mapped.desc,
        weather_code: mapped.main,
        source: 'Open-Meteo',
      }
    }
  } catch (err) {
    console.warn('Open-Meteo 호출 실패:', err)
  }

  return {
    location: '충남 아산시',
    temp: null,
    feels_like: null,
    temp_min: null,
    temp_max: null,
    humidity: null,
    rain_prob: 0,
    condition: '날씨 정보 수집 지연',
    weather_code: 'Unknown',
    source: 'fallback',
  }
}

// 2. 무료 국내외 경제 뉴스 RSS 수집 (Google News RSS)
async function fetchEconomyHeadlines() {
  const feeds = [
    'https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC+%EA%B2%BD%EC%A0%9C+%EC%A6%9D%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss/search?q=%EB%AF%B8%EA%B5%AD+%EC%A6%9D%EC%8B%9C+%EB%82%98%EC%8A%A4%EB%8B%A5+%ED%99%98%EC%9C%A8+%EA%B8%88%EB%A6%AC&hl=ko&gl=KR&ceid=KR:ko',
  ]

  const headlines: Array<{ title: string; link: string; source: string }> = []
  const seen = new Set<string>()

  await Promise.all(
    feeds.map(async (feedUrl) => {
      try {
        const res = await fetch(feedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SecretaryBot/1.0)' },
        })
        if (!res.ok) return
        const xml = await res.text()
        const itemRegex = /<item>([\s\S]*?)<\/item>/g
        let match: RegExpExecArray | null
        let count = 0
        while ((match = itemRegex.exec(xml)) !== null && count < 6) {
          const block = match[1]
          const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/)
          const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/)
          const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)
          const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : ''
          const link = linkMatch ? decodeHtmlEntities(linkMatch[1]) : ''
          const source = sourceMatch ? decodeHtmlEntities(sourceMatch[1]) : '경제뉴스'
          if (title && !seen.has(title)) {
            seen.add(title)
            headlines.push({ title, link, source })
            count++
          }
        }
      } catch (err) {
        console.warn('RSS 수집 실패:', feedUrl, err)
      }
    })
  )

  return headlines.slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim()

    const body = await req.json().catch(() => ({}))
    const targetDate = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : getTodayKst()
    const force = Boolean(body?.force)

    const dbHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    }

    // 0. 캐시 조회 (force=false 이고 오늘자 브리핑이 이미 있으면 즉시 반환)
    if (!force) {
      const cacheRes = await fetch(
        `${supabaseUrl}/rest/v1/secretary_briefings?briefing_date=eq.${targetDate}&select=*`,
        { headers: dbHeaders }
      )
      if (cacheRes.ok) {
        const rows = await cacheRes.json()
        if (Array.isArray(rows) && rows.length > 0) {
          return jsonResponse({ cached: true, data: rows[0] })
        }
      }
    }

    if (!geminiApiKey) {
      return jsonResponse(
        { error: 'GEMINI_API_KEY Secret이 Supabase Edge Functions에 설정되지 않았습니다.' },
        500
      )
    }

    // 1. 날씨, 경제 RSS, 오늘 식단, 오늘 일정을 병렬 수집
    const [weather, headlines, mealRes, schedRes] = await Promise.all([
      fetchAsanWeather(),
      fetchEconomyHeadlines(),
      fetch(`${supabaseUrl}/rest/v1/secretary_meals?meal_date=eq.${targetDate}&select=*`, {
        headers: dbHeaders,
      }),
      fetch(
        `${supabaseUrl}/rest/v1/secretary_schedules?schedule_date=eq.${targetDate}&order=schedule_time.asc&select=*`,
        { headers: dbHeaders }
      ),
    ])

    const meals = mealRes.ok ? await mealRes.json() : []
    const todayMeal = Array.isArray(meals) && meals.length > 0 ? meals[0] : null
    const schedules = schedRes.ok ? await schedRes.json() : []

    // 2. Gemini 3.8 Flash 단 1회 호출로 종합 브리핑 JSON 생성
    const prompt = `
당신은 한국 가정의 유능하고 다정한 개인 일상 비서입니다.
아래 오늘(${targetDate})의 데이터를 종합 분석하여 반드시 유효한 JSON 객체만 반환하세요.

[1. 오늘의 날씨 - 충남 아산시]
${JSON.stringify(weather, null, 2)}

[2. 오늘의 아이 어린이집 식단]
${todayMeal ? JSON.stringify(todayMeal, null, 2) : '등록된 식단 없음 (일반 유아 균형 저녁 식단 기준으로 추천)'}

[3. 오늘의 개인 및 육아 일정]
${schedules.length > 0 ? JSON.stringify(schedules, null, 2) : '등록된 일정 없음'}

[4. 오늘의 국내외 경제·증시 뉴스 헤드라인]
${headlines.length > 0 ? headlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title}`).join('\n') : '수집된 뉴스 없음'}

반드시 아래 JSON 스키마를 정확히 지켜서 한국어로 작성하세요:
{
  "greeting": "오늘 하루를 여는 한 줄 핵심 인사 및 요약 (50자 이내)",
  "outfit_tip": "충남 아산시 기온/일교차/강수확률에 맞춘 성인 및 아이 옷차림과 우산 챙김 여부 안내 (2~3문장)",
  "nutrition_analysis": "어린이집 점심·간식을 분석해 부족하거나 보충하면 좋은 영양 균형 체크 (2~3문장)",
  "recommended_nutrients": ["보충 필요 영양소 1", "영양소 2", "영양소 3"],
  "recommended_ingredients": ["추천 저녁 재료 1", "재료 2", "재료 3", "재료 4", "재료 5"],
  "recommended_dinner_menus": [
    { "name": "추천 저녁 메뉴 1", "reason": "추천 이유 (한 문장)" },
    { "name": "추천 저녁 메뉴 2", "reason": "추천 이유 (한 문장)" }
  ],
  "schedule_summary": "오늘의 주요 개인/어린이집 일정 및 준비물 리마인드 (일정이 없으면 여유로운 하루 안내)",
  "economy_summary": [
    "국내외 시황 및 경제 리서치 핵심 요약 1",
    "핵심 요약 2",
    "핵심 요약 3",
    "핵심 요약 4"
  ]
}
`.trim()

    const geminiBody = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    })

    const modelsToTry = [GEMINI_MODEL, 'gemini-2.5-flash']
    let geminiRes: Response | null = null
    let usedModel = GEMINI_MODEL

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
        usedModel = model
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
      return jsonResponse({ error: `Gemini API 오류 (${geminiRes.status}): ${errText}` }, 502)
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    let aiBriefing: Record<string, unknown> = {}
    try {
      aiBriefing = JSON.parse(rawText)
    } catch {
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      aiBriefing = JSON.parse(cleaned)
    }

    const economyJson = {
      summary_bullets: Array.isArray(aiBriefing.economy_summary) ? aiBriefing.economy_summary : [],
      headlines,
    }

    const rowPayload = {
      briefing_date: targetDate,
      weather_json: weather,
      economy_json: economyJson,
      ai_briefing_json: aiBriefing,
      model_used: usedModel,
      updated_at: new Date().toISOString(),
    }

    // 3. Supabase DB (secretary_briefings)에 날짜별 캐시 저장 (Upsert)
    const upsertRes = await fetch(
      `${supabaseUrl}/rest/v1/secretary_briefings?on_conflict=briefing_date`,
      {
        method: 'POST',
        headers: {
          ...dbHeaders,
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify([rowPayload]),
      }
    )

    if (!upsertRes.ok) {
      const errText = await upsertRes.text()
      return jsonResponse({ error: `DB 저장 실패: ${errText}` }, 500)
    }

    const savedRows = await upsertRes.json()
    return jsonResponse({ cached: false, data: savedRows?.[0] || rowPayload })
  } catch (err) {
    console.error('secretary-briefing error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : '알 수 없는 오류' }, 500)
  }
})
