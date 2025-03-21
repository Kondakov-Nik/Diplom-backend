const axios = require('axios');
const cron = require('node-cron');
const ApiError = require('../error/ApiError');
const { KpIndex } = require('../models/models');
const { Op } = require('sequelize');

class KpController {
  constructor() {
    // Настраиваем cron-задачу для обновления данных каждый день в 00:00 по UTC
    cron.schedule('0 0 * * *', async () => {
      console.log('Обновление данных KP-индексов в 00:00...');
      await this.updateKpData();
    });

    // Вызываем обновление данных при старте сервера, чтобы данные были сразу доступны
    this.updateKpData();
  }

  // Метод для обновления данных KP-индексов
  updateKpData = async () => {
    const today = new Date();
    const historicalStartDate = new Date(today);
    historicalStartDate.setDate(today.getDate() - 30); // Исторические данные за последние 30 дней
    const historicalEndDate = new Date(today);
    historicalEndDate.setDate(today.getDate() - 1); // До вчерашнего дня
    const forecastEndDate = new Date(today);
    forecastEndDate.setDate(today.getDate() + 25); // Прогноз на 25 дней вперед

    const startHistorical = historicalStartDate.toISOString().split('T')[0];
    const endHistorical = historicalEndDate.toISOString().split('T')[0];
    const startForecast = today.toISOString().split('T')[0];
    const endForecast = forecastEndDate.toISOString().split('T')[0];

    try {
      // Загружаем исторические данные
      const historicalData = await this.fetchKpIndexFromNOAA(startHistorical, endHistorical);
      for (const { date, kpIndex } of historicalData) {
        const roundedKpIndex = Math.round(kpIndex);
        await KpIndex.upsert({ date, kpIndex: roundedKpIndex });
      }

      // Загружаем прогнозные данные
      const forecastData = await this.fetchKpIndexForecast(startForecast, endForecast);
      for (const { date, kpIndex } of forecastData) {
        await KpIndex.upsert({ date, kpIndex });
      }

      console.log('Данные KP-индексов успешно обновлены');
    } catch (error) {
      console.error('Ошибка при обновлении данных KP-индексов:', error.message);
    }
  };

  // Получить данные KP-индекса за диапазон дат
  getKpIndex = async (req, res, next) => {
    const { start, end } = req.query;

    if (!start || !end) {
      return next(ApiError.badRequest('Необходимо указать start и end даты'));
    }

    try {
      // Получаем данные из базы
      const kpData = await KpIndex.findAll({
        where: {
          date: {
            [Op.between]: [start, end],
          },
        },
        attributes: ['date', 'kpIndex'],
      });

      const roundedKpData = kpData.map((item) => ({
        date: item.date,
        kpIndex: Math.round(item.kpIndex),
      }));

      return res.json(roundedKpData);
    } catch (error) {
      next(ApiError.internal(error.message));
    }
  };

  // Получить прогноз KP-индекса на 25 дней вперед
  getKpIndexForecast = async (req, res, next) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysAhead = 25;
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + daysAhead);

      const start = today.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];

      // Получаем данные из базы
      const forecastData = await KpIndex.findAll({
        where: {
          date: {
            [Op.gte]: start,
            [Op.lte]: end,
          },
        },
        attributes: ['date', 'kpIndex'],
      });

      // Создаем массив всех дат в диапазоне
      const dateRange = [];
      for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
        dateRange.push(d.toISOString().split('T')[0]);
      }

      // Заполняем недостающие даты заглушками (null)
      const result = dateRange.map((date) => {
        const forecastEntry = forecastData.find((item) => item.date === date);
        return {
          date,
          kpIndex: forecastEntry ? forecastEntry.kpIndex : null,
        };
      });

      return res.json(result);
    } catch (error) {
      next(ApiError.internal(error.message));
    }
  };

  // Функция загрузки исторических данных с NOAA
  fetchKpIndexFromNOAA = async (start, end) => {
    try {
      const response = await axios.get('https://services.swpc.noaa.gov/text/daily-geomagnetic-indices.txt');
      const lines = response.data.split('\n');
      const kpData = [];

      let dataSection = false;
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#') || line.startsWith(':')) {
          if (line.toLowerCase().includes('date')) {
            dataSection = true;
          }
          continue;
        }
        if (dataSection && line.match(/^\d{4}\s+\d{2}\s+\d{2}/)) {
          line = line.replace(/-1-1-1-1-1-1-1/g, '-1 -1 -1 -1 -1 -1 -1');
          line = line.replace(/-1-1-1-1-1-1/g, '-1 -1 -1 -1 -1 -1');
          line = line.replace(/-1-1-1-1-1/g, '-1 -1 -1 -1 -1');
          line = line.replace(/-1-1-1-1/g, '-1 -1 -1 -1');
          line = line.replace(/-1-1-1/g, '-1 -1 -1');
          line = line.replace(/-1-1/g, '-1 -1');
          line = line.replace(/1-1-1-1-1-1-1/g, '-1 -1 -1 -1 -1 -1 -1');
          line = line.replace(/1-1-1-1-1-1/g, '-1 -1 -1 -1 -1 -1');
          line = line.replace(/1-1-1-1-1/g, '-1 -1 -1 -1 -1');
          line = line.replace(/1-1-1-1/g, '-1 -1 -1 -1');
          line = line.replace(/1-1-1/g, '-1 -1 -1');
          line = line.replace(/1-1/g, '-1 -1');

          const parts = line.split(/\s+/).filter(Boolean);
          if (parts.length < 27) continue;

          const year = parts[0];
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          const date = `${year}-${month}-${day}`;
          if (date >= start && date <= end) {
            const planetaryKIndices = parts.slice(22, 30);
            const kpValues = planetaryKIndices.map((v) => parseFloat(v)).filter((v) => !isNaN(v) && v >= 0);
            if (kpValues.length === 8) {
              const avgKpIndex = kpValues.reduce((sum, val) => sum + val, 0) / kpValues.length;
              kpData.push({ date, kpIndex: avgKpIndex });
            }
          }
        }
      }
      return kpData;
    } catch (error) {
      console.error('Ошибка при запросе к NOAA:', error.message);
      return [];
    }
  };

  // Функция загрузки прогнозных данных с NOAA
  fetchKpIndexForecast = async (start, end) => {
    try {
      const response = await axios.get('https://services.swpc.noaa.gov/text/27-day-outlook.txt');
      const lines = response.data.split('\n');
      const forecastData = [];

      const monthMap = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
      };

      let dataSection = false;
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#') || line.startsWith(':')) {
          if (line.includes('UTC')) dataSection = true;
          continue;
        }
        if (dataSection && line.match(/^\d{4}\s+[A-Za-z]{3}\s+\d{2}/)) {
          const parts = line.split(/\s+/).filter(Boolean);
          if (parts.length < 6) continue;

          const year = parts[0];
          const monthStr = parts[1];
          const month = monthMap[monthStr];
          if (!month) continue;
          const day = parts[2].padStart(2, '0');
          const date = `${year}-${month}-${day}`;
          if (date >= start && date <= end) {
            const kpIndex = parseInt(parts[5]);
            if (!isNaN(kpIndex)) {
              forecastData.push({ date, kpIndex });
            }
          }
        }
      }
      return forecastData;
    } catch (error) {
      console.error('Ошибка при запросе прогноза к NOAA:', error.message);
      return [];
    }
  };
}

module.exports = new KpController();