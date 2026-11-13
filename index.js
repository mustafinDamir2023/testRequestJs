const https = require('https')
const http = require('http')
const { performance } = require('perf_hooks')

// Получаем URL из аргументов командной строки
const urlArg = process.argv[2]

if (!urlArg) {
  console.error('Ошибка: Укажите URL для тестирования.')
  console.error('Пример: node index.js https://example.com/image.jpg')
  process.exit(1)
}

// Выбираем модуль в зависимости от протокола
const client = urlArg.startsWith('https') ? https : http
const REQUESTS_COUNT = 10
const TIMEOUT_MS = 15000 // Таймаут на один запрос (15 секунд)

/**
 * Выполняет один GET-запрос и возвращает время и размер данных
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now()
    let bytesReceived = 0

    const req = client.get(url, { timeout: TIMEOUT_MS }, (res) => {
      // Если статус не 200 (OK), прерываем
      if (res.statusCode !== 200) {
        req.destroy()
        return reject(new Error(`HTTP Status: ${res.statusCode}`))
      }

      // Считаем байты по мере поступления данных
      res.on('data', (chunk) => {
        bytesReceived += chunk.length
      })

      res.on('end', () => {
        const endTime = performance.now()
        resolve({
          timeMs: endTime - startTime,
          bytes: bytesReceived
        })
      })
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Timeout exceeded'))
    })

    req.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Основная функция запуска тестов
 */
async function runTest() {
  console.log(`🚀 Начинаем тестирование скорости для: ${urlArg}`)
  console.log(`Количество запросов: ${REQUESTS_COUNT}\n`)

  let totalTimeMs = 0
  let totalBytes = 0

  // Запускаем запросы строго последовательно
  for (let i = 1; i <= REQUESTS_COUNT; i++) {
    try {
      process.stdout.write(`Запрос ${i}/${REQUESTS_COUNT}... `)

      const result = await makeRequest(urlArg)

      totalTimeMs += result.timeMs
      totalBytes += result.bytes

      const sizeMB = (result.bytes / (1024 * 1024)).toFixed(2)
      console.log(
        `✅ Успешно. Время: ${(result.timeMs / 1000).toFixed(2)} сек. Размер: ${sizeMB} МБ`
      )
    } catch (error) {
      console.log(`❌ Ошибка: ${error.message}`)
      // При ошибке прерываем тест, чтобы не искажать статистику
      process.exit(1)
    }
  }

  // Вычисляем итоговые метрики
  const avgTimeMs = totalTimeMs / REQUESTS_COUNT
  const avgTimeSec = avgTimeMs / 1000

  // Скорость считаем в Мегабитах в секунду (Mbps)
  // Формула: (Байты * 8) / (1024 * 1024) / (миллисекунды / 1000)
  const avgSpeedMbps = (totalBytes * 8) / (1024 * 1024) / (totalTimeMs / 1000)

  const avgSizeMB = totalBytes / REQUESTS_COUNT / (1024 * 1024)

  console.log('\n=========================================')
  console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ')
  console.log('=========================================')
  console.log(`Среднее время запроса:  ${avgTimeSec.toFixed(2)} сек`)
  console.log(`Средний размер файла:   ${avgSizeMB.toFixed(2)} МБ`)
  console.log(
    `Общий скачанный объём:  ${(totalBytes / (1024 * 1024)).toFixed(2)} МБ`
  )
  console.log(
    `Средняя скорость:       ${avgSpeedMbps.toFixed(2)} Мбит/с (Mbps)`
  )
  console.log('=========================================\n')
}

runTest()
